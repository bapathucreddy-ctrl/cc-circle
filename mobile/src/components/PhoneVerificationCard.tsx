import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useResource } from '../hooks';
import { errorText } from '../domain';
import { Button, Card, Field, Notice, useTheme } from '../ui';

export function PhoneVerificationCard({ onVerified, purpose = 'payment' }: { onVerified?: (verified: boolean) => void; purpose?: 'payment' | 'registration' }) {
  const { styles } = useTheme();
  const result = useResource(() => supabase.auth.getUser(), 'account-phone');
  const [phone, setPhone] = useState(''); const [code, setCode] = useState(''); const [sent, setSent] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [retryAt, setRetryAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const verifiedPhone = result.data?.data.user?.phone_confirmed_at ? result.data.data.user.phone : null;
  useEffect(() => { if (result.data) onVerified?.(Boolean(verifiedPhone)); }, [result.data, verifiedPhone, onVerified]);
  useEffect(() => { const tick = () => setSeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, [retryAt]);
  async function send() {
    if (busy || Date.now() < retryAt) return; setBusy(true); setError('');
    try {
      if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a valid 10-digit Indian mobile number.');
      const { error } = await supabase.auth.updateUser({ phone: `+91${phone}` });
      if (error) throw error; setSent(true); setRetryAt(Date.now() + 60000);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function verify() {
    if (busy) return; setBusy(true); setError('');
    try {
      if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit verification code.');
      const { error } = await supabase.auth.verifyOtp({ phone: `+91${phone}`, token: code, type: 'phone_change' });
      if (error) throw error; await result.refresh();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <Card><Text style={styles.heading}>{verifiedPhone ? 'Verified mobile number' : purpose === 'registration' ? 'Verify your mobile number' : 'Mobile number for payments'}</Text>
    {verifiedPhone ? <Text style={styles.muted}>+91 ••••••{verifiedPhone.slice(-4)}</Text> : <>
      <Text style={styles.muted}>{purpose === 'registration' ? 'Google sign-in does not share a phone number. Add your mobile number and verify it with an OTP to complete registration.' : 'Add and verify your mobile number before paying for your booking.'}</Text>
      <Field label={purpose === 'registration' ? 'Mobile number' : 'Payment mobile number'} value={phone} onChange={value => { setPhone(value.replace(/\D/g, '')); setSent(false); setCode(''); }} keyboardType="phone-pad" maxLength={10} editable={!sent && !busy} placeholder="10-digit Indian mobile number" />
      {sent && <><Field label="Mobile verification code" value={code} onChange={value => setCode(value.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" /><Button title="Verify mobile number" onPress={verify} busy={busy} /></>}
      <Button title={sent ? seconds ? `Resend code in ${seconds}s` : 'Resend mobile code' : 'Send mobile verification code'} secondary={sent} onPress={send} busy={busy} disabled={seconds > 0} />
      {sent && <Button title="Use a different mobile number" secondary disabled={busy} onPress={() => { setSent(false); setCode(''); }} />}
    </>}
    <Notice message={error || result.error || result.data?.error?.message || ''} />
  </Card>;
}
