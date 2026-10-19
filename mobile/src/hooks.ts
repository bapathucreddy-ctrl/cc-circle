import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from './domain';
import { AppState } from 'react-native';
import { professionalAvailability } from './lib/api';
import { fetchResource, resourceEntry } from './lib/resourceCache';

export function useForegroundRefresh(refresh: () => Promise<void>, interval = 15000) {
  useEffect(() => {
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, interval);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [refresh, interval]);
}

export function useAvailability(id: string, durationMinutes = 15) {
  const result = useResource(() => professionalAvailability(id, durationMinutes), `${id}-${durationMinutes}`, 'availability');
  useForegroundRefresh(result.refresh);
  return result;
}

export function useResource<T>(load: () => Promise<T>, key: string, namespace?: string) {
  const loader = useRef(load); loader.current = load;
  const version = useRef(0);
  const entry = namespace ? resourceEntry(`${namespace}:${key}`) : null;
  const [data, setData] = useState<T | null>(() => entry?.loaded ? entry.value as T : null);
  const loaded = useRef(Boolean(entry?.loaded));
  const pending = useRef<Promise<void> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!entry?.loaded);
  const refresh = useCallback(async () => {
    if (pending.current) return pending.current;
    const current = ++version.current;
    const loadCurrent = loader.current;
    // Polls update existing content quietly. A spinner is only for the first load.
    setLoading(!loaded.current);
    const work = (async () => {
      try {
        const result = entry ? await fetchResource(entry, loadCurrent) : await loadCurrent();
        if (current === version.current) { loaded.current = true; setData(result); setError(''); }
      } catch (e) { if (current === version.current) setError(errorText(e)); }
      finally { if (current === version.current) setLoading(false); }
    })();
    pending.current = work;
    try { await work; } finally { if (pending.current === work) pending.current = null; }
  }, [key, entry]);
  useEffect(() => {
    pending.current = null;
    loaded.current = Boolean(entry?.loaded); setData(entry?.loaded ? entry.value as T : null); setError(''); setLoading(!entry?.loaded);
    const update = () => { loaded.current = true; setData(entry!.value as T); setLoading(false); setError(''); };
    entry?.listeners.add(update);
    // Show cached content immediately, but revalidate after navigation/mutations.
    void refresh();
    return () => { version.current++; entry?.listeners.delete(update); };
  }, [refresh]);
  return { data, error, loading, refresh };
}
