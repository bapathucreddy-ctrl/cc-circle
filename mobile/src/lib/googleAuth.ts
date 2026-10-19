import { Linking, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { isProfessionalApp } from '../appVariant';
import { sessionStorage } from './sessionStorage';
import { authEndpoint, authPublishableKey, authStorageKey, backendConfigured, supabase } from './supabase';

const pendingKey = `${authStorageKey}-google-pkce`;
type Pending = { verifier: string; createdAt: number; redirectTo: string };
let completing: { code: string; promise: Promise<boolean> } | null = null;

export function googleRedirectUrl() {
  return Platform.OS === 'web' ? `${window.location.origin}/auth/callback` : `${isProfessionalApp ? 'cccircle-pro' : 'cccircle'}://auth/callback`;
}

export async function completeGoogleSignIn(rawUrl?: string | null): Promise<boolean> {
  if (!rawUrl) return false;
  const url = new URL(rawUrl); const expected = new URL(googleRedirectUrl());
  if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname) return false;
  const code = url.searchParams.get('code'); const oauthError = url.searchParams.get('error');
  // Keep one-time codes out of the browser address/history and crash reports.
  if (Platform.OS === 'web') window.history.replaceState(null, '', '/');
  if (oauthError) { await sessionStorage.removeItem(pendingKey); throw new Error(oauthError === 'access_denied' ? 'Google sign-in was cancelled. Try again or use your mobile number.' : 'Google sign-in did not complete. Please try again.'); }
  if (!code) return false;
  if (completing?.code === code) return completing.promise;
  const promise = (async () => {
    const stored = await sessionStorage.getItem(pendingKey);
    const pending = stored ? JSON.parse(stored) as Pending : null;
    if (!pending || typeof pending.verifier !== 'string' || !/^[0-9a-f]{64}$/.test(pending.verifier) || !Number.isFinite(pending.createdAt) || pending.createdAt > Date.now() || pending.redirectTo !== googleRedirectUrl() || Date.now() - pending.createdAt > 15 * 60000) {
      throw new Error('Your Google sign-in session expired. Please start again.');
    }
    // Supabase's PKCE token endpoint; tokens are never passed through a URL.
    const response = await fetch(`${authEndpoint}/token?grant_type=pkce`, {
      method: 'POST', headers: { apikey: authPublishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_code: code, code_verifier: pending.verifier }),
    });
    if (!response.ok) throw new Error('Google sign-in could not be verified. Please try again.');
    const tokens = await response.json();
    if (!tokens.access_token || !tokens.refresh_token) throw new Error('Google sign-in returned an incomplete session. Please try again.');
    const { error } = await supabase.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
    if (error) throw error;
    await sessionStorage.removeItem(pendingKey); return true;
  })();
  completing = { code, promise };
  try { return await promise; } catch (error) { completing = null; await sessionStorage.removeItem(pendingKey); throw error; }
}

export async function restoreGoogleSignIn() {
  return completeGoogleSignIn(Platform.OS === 'web' ? window.location.href : await Linking.getInitialURL());
}

export async function signInWithGoogle() {
  if (!backendConfigured) throw new Error('Sign-in is not configured yet.');
  if (Platform.OS === 'web' && !window.isSecureContext) throw new Error('Google sign-in needs HTTPS, or localhost during development.');
  const settingsResponse = await fetch(`${authEndpoint}/settings`, { headers: { apikey: authPublishableKey } });
  if (!settingsResponse.ok) throw new Error('Unable to connect to sign-in. Try again or use your mobile number.');
  const settings = await settingsResponse.json();
  if (!settings.external?.google) throw new Error('Google sign-in is not available yet. Please use your mobile number.');
  // Expo Crypto provides secure random bytes and SHA-256 on native as well as
  // web. This avoids falling back to Math.random/plain PKCE on native engines.
  const verifier = Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('');
  const challenge = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const redirectTo = googleRedirectUrl();
  await sessionStorage.setItem(pendingKey, JSON.stringify({ verifier, createdAt: Date.now(), redirectTo }));
  const url = new URL(`${authEndpoint}/authorize`);
  Object.entries({ provider: 'google', redirect_to: redirectTo, code_challenge: challenge, code_challenge_method: 's256', prompt: 'select_account' }).forEach(([key, value]) => url.searchParams.set(key, value));
  if (Platform.OS === 'web') { window.location.assign(url.toString()); return; }
  try {
    const result = await WebBrowser.openAuthSessionAsync(url.toString(), redirectTo);
    if (result.type === 'success') {
      if (!await completeGoogleSignIn(result.url)) throw new Error('Google sign-in returned to an unexpected screen. Please try again.');
    } else await sessionStorage.removeItem(pendingKey);
  } catch (error) { await sessionStorage.removeItem(pendingKey); throw error; }
}
