import { useSyncExternalStore } from 'react';
import { AppState, type ImageSourcePropType } from 'react-native';
import { serviceImages as defaults } from './servicePresentation';
import { supabase } from './supabase';

let snapshot: Record<string, ImageSourcePropType> = defaults;
let names: Record<string, string> = {};
const defaultNames: Record<string, string> = {};
let nameSignature = '';
let signature = '', pending = false;
const listeners = new Set<() => void>();
async function refresh() {
  if (pending || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
  pending = true;
  try {
    const [artwork, catalog] = await Promise.all([
      supabase.from('service_artwork').select('service_key,image_path').order('service_key'),
      supabase.from('service_types').select('key,label').order('key'),
    ]);
    let changed = false;
    if (!artwork.error && artwork.data && JSON.stringify(artwork.data) !== signature) {
      signature = JSON.stringify(artwork.data);snapshot = { ...defaults };
      for (const item of artwork.data) if (defaults[item.service_key]) snapshot[item.service_key] = { uri: supabase.storage.from('service-artwork').getPublicUrl(item.image_path).data.publicUrl };
      changed = true;
    }
    if (!catalog.error && catalog.data && JSON.stringify(catalog.data) !== nameSignature) {
      nameSignature = JSON.stringify(catalog.data);names = {};
      for (const item of catalog.data) if (typeof item.key === 'string' && typeof item.label === 'string') names[item.key] = item.label;
      changed = true;
    }
    if (changed) listeners.forEach(listener => listener());
  } catch { /* Network interruptions retain the last good images. */ }
  finally { pending = false; }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refresh();
    timer = setInterval(() => { void refresh(); }, 30000);
    foreground = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { if (timer) clearInterval(timer); timer = undefined; foreground?.remove(); foreground = undefined; }
  };
}
let timer: ReturnType<typeof setInterval> | undefined;
let foreground: ReturnType<typeof AppState.addEventListener> | undefined;
export function useServiceImages() { return useSyncExternalStore(subscribe, () => snapshot, () => defaults); }
export function useServiceNames() { return useSyncExternalStore(subscribe, () => names, () => defaultNames); }
