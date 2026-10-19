import { useState } from 'react';
import { Text } from 'react-native';
import type { Booking } from '../domain';
import { errorText } from '../domain';
import { useForegroundRefresh, useResource } from '../hooks';
import { supabase } from '../lib/supabase';
import { Button, Card, Field, Notice, useTheme } from '../ui';

export function ServiceVerification({ booking, professional, onChange }: { booking: Booking; professional: boolean; onChange: () => Promise<void> }) {
  const { styles, colors } = useTheme();
  const phase = booking.service_started_at ? booking.completion_requested_at ? 'end' : null : 'start';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const otp = useResource(async () => {
    if (professional || !phase) return null;
    const { data, error } = await supabase.rpc('service_otp', { p_booking_id: booking.id, p_phase: phase });
    if (error) throw error;
    return data as { code: string | null; expires_at: string; locked: boolean };
  }, `${booking.id}-${professional}-${phase}`);
  useForegroundRefresh(otp.refresh);
  async function act(action: 'start' | 'end' | 'request_completion') {
    setBusy(true); setError('');
    try {
      const { data, error } = await supabase.rpc('service_action', { p_booking_id: booking.id, p_action: action, p_code: code });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Unable to verify this code.');
      setCode(''); await onChange();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <Card>
    <Text style={styles.heading}>{phase === 'start' ? 'Start service verification' : phase === 'end' ? 'Confirm service completion' : 'Service in progress'}</Text>
    <Notice message={error || otp.error} />
    {professional ? phase ? <>
      <Text style={styles.text}>Ask the customer for their {phase === 'start' ? 'start' : 'end'} OTP.</Text>
      <Field label={`${phase === 'start' ? 'Start' : 'End'} service OTP`} value={code} onChange={value => setCode(value.replace(/\D/g, '').slice(0, 6))} numeric maxLength={6} autoComplete="off" />
      <Button title={phase === 'start' ? 'Verify OTP & start service' : 'Verify OTP & finish service'} busy={busy} disabled={code.length !== 6} onPress={() => act(phase)} />
    </> : <><Text style={styles.text}>When your work is finished, request the customer's end OTP.</Text><Button title="Complete service" busy={busy} onPress={() => act('request_completion')} /></> : phase ? <>
      <Text style={styles.text}>{phase === 'start' ? 'Share this code only when your professional has arrived and you are ready to begin.' : 'Share this code only after your service is complete. Verification marks the booking done.'}</Text>
      {otp.data?.code && <Text selectable accessibilityLabel={`${phase} service OTP ${otp.data.code.split('').join(' ')}`} style={{ color: colors.accent, fontSize: 36, fontWeight: '700', letterSpacing: 7 }}>{otp.data.code}</Text>}
      {otp.data && <Text style={styles.muted}>{otp.data.locked ? 'Too many incorrect attempts. A new code becomes available after' : 'Code expires at'} {new Date(otp.data.expires_at).toLocaleTimeString()}.</Text>}
      <Button title="Refresh code" secondary busy={otp.loading} onPress={() => { void otp.refresh(); }} />
    </> : <Text style={styles.text}>Your service has started. Your end OTP will appear here when the professional taps Complete service. You can rate the work after completion.</Text>}
  </Card>;
}
