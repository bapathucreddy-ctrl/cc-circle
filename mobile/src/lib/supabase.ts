import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { sessionStorage } from './sessionStorage';
import { appVariant } from '../appVariant';

// Default to online. A missing local configuration never falls back to online.
const onlineFlag = (process.env.EXPO_PUBLIC_SUPABASE_ONLINE || 'true').trim().toLowerCase();
const validMode = onlineFlag === 'true' || onlineFlag === 'false';
const useLocalBackend = onlineFlag === 'false';
export const backendMode = useLocalBackend ? 'local' : 'online';
const url = useLocalBackend ? process.env.EXPO_PUBLIC_LOCAL_SUPABASE_URL : process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = useLocalBackend ? process.env.EXPO_PUBLIC_LOCAL_SUPABASE_KEY
  : process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY;
let privilegedKey = key?.startsWith('sb_secret_') || false;
try {
  const encoded = key?.split('.')[1];
  if (encoded) privilegedKey ||= JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role';
} catch { /* Non-JWT publishable keys are supported. */ }
let permittedUrl = false;
try {
  const parsed = new URL(url || '');
  const host = parsed.hostname;
  const privateHost = host === 'localhost' || host === '127.0.0.1' ||
    /^10\.(\d{1,3}\.){2}\d{1,3}$/.test(host) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
  permittedUrl = parsed.protocol === 'https:' ||
    (__DEV__ && useLocalBackend && parsed.protocol === 'http:' && privateHost && parsed.port === '54321');
} catch { /* Invalid configuration leaves the setup screen visible. */ }
export const backendConfigured = Boolean(validMode && permittedUrl && key && !privilegedKey);
export const authEndpoint = backendConfigured ? `${url!.replace(/\/$/, '')}/auth/v1` : '';
export const authPublishableKey = backendConfigured ? key! : '';
export const authStorageKey = `cc-circle-${appVariant}-${backendMode}-${url ? url.replace(/[^a-z0-9._-]/gi, '_') : 'unconfigured'}-auth`;

// The placeholder allows the setup screen to render. Calls are gated on configuration.
export const supabase = createClient(backendConfigured ? url! : 'https://unconfigured.supabase.co', backendConfigured ? key! : 'unconfigured', {
  auth: { storage: sessionStorage, storageKey: authStorageKey,
    autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
