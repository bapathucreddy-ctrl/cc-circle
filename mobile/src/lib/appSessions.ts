import { supabase } from './supabase';
import { appVariant } from '../appVariant';
import { toByteArray } from 'base64-js';

// This decoding identifies a local session for race checks only. The server
// validates the JWT and obtains login times from auth.sessions, never this data.
export function appSessionId(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload || payload.length > 65536) return null;
    const encoded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = toByteArray(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='));
    const claims = JSON.parse(decodeURIComponent(Array.from(bytes, byte => '%' + byte.toString(16).padStart(2, '0')).join('')));
    return typeof claims.session_id === 'string' ? claims.session_id : null;
  }
  catch { return null; }
}
export async function checkAppSession(activate = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const { data, error } = await supabase.rpc(activate ? 'activate_app_session' : 'app_session_is_current', { p_variant: appVariant }).abortSignal(controller.signal);
    if (error) throw error;
    return data === true;
  } catch { throw new Error('Unable to verify this device. Check your connection and try again.'); }
  finally { clearTimeout(timer); }
}
export async function releaseAppSession() {
  const { error } = await supabase.rpc('release_app_session', { p_variant: appVariant });
  if (error) throw error;
}
export async function expireAppSession(expectedId: string | null, onReplaced: () => void, stopTracking?: () => Promise<unknown>) {
  const { data } = await supabase.auth.getSession();
  if (!data.session || appSessionId(data.session.access_token) !== expectedId) return;
  onReplaced();
  if (stopTracking) await stopTracking().catch(() => {});
  const latest = await supabase.auth.getSession();
  if (latest.data.session && appSessionId(latest.data.session.access_token) === expectedId) await supabase.auth.signOut({ scope: 'local' });
}
