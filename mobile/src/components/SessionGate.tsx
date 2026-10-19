import { ServiceLoader as ActivityIndicator } from './ServiceLoader';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { checkAppSession } from '../lib/appSessions';
import { Button, Notice, useTheme } from '../ui';

export function SessionGate({ children, onReplaced }: { children: ReactNode; onReplaced: () => void }) {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const replaced = useRef(onReplaced); replaced.current = onReplaced;
  useEffect(() => {
    let active = true, activated = false, checking = false;
    async function check() {
      if (!active || checking || AppState.currentState !== 'active') return;
      checking = true;
      try {
        const current = await checkAppSession(!activated);
        if (!active) return;
        if (!current) { active = false; setReady(false); replaced.current(); return; }
        activated = true; setReady(true); setError('');
      } catch (cause) { if (active && !activated) setError(cause instanceof Error ? cause.message : 'Unable to verify this device.'); }
      finally { checking = false; }
    }
    void check();
    const timer = setInterval(() => { void check(); }, 5000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    return () => { active = false; clearInterval(timer); listener.remove(); };
  }, [retry]);
  if (ready) return children;
  return <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: 'center' }}>
    {error ? <><Notice message={error} /><Button title="Try again" onPress={() => setRetry(value => value + 1)} /></> : <ActivityIndicator color={colors.accent} />}
  </View>;
}
