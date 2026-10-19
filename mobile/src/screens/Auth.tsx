import { KeyboardAwareScrollView as ScrollView } from '../components/KeyboardAwareScrollView';
﻿import { useEffect, useState } from 'react';
import { Image, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { errorText } from '../domain';
import { WelcomeGallery } from '../components/WelcomeGallery';
import { LegalLinks } from '../components/LegalLinks';
import { isProfessionalApp } from '../appVariant';
import { Brand, Button, Field, Icon, IconButton, Notice, TextButton, ThemeToggle, useTheme } from '../ui';

export function Auth({ onIntent }: { onIntent: (screen: 'home' | 'join' | 'account') => void }) {
  const { colors, styles, theme } = useTheme(); const { width } = useWindowDimensions();
  const wide = width >= 800;
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState(''); const [code, setCode] = useState(''); const [requestedPhone, setRequestedPhone] = useState('');
  const [busy, setBusy] = useState(false); const [googleBusy, setGoogleBusy] = useState(false); const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0); const [seconds, setSeconds] = useState(0);
  const locked = busy || googleBusy;
  useEffect(() => { const tick = () => setSeconds(Math.max(0, Math.ceil((cooldown - Date.now()) / 1000))); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, [cooldown]);
  async function submit() {
    if (locked) return; setBusy(true); setError('');
    try {
      if (stage === 'phone') {
        if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a valid 10-digit Indian mobile number.');
        const number = `+91${phone}`; const { error } = await supabase.auth.signInWithOtp({ phone: number });
        if (error) throw error; setRequestedPhone(number); setCooldown(Date.now() + 60000); setStage('code');
      } else {
        if (!/^\d{6}$/.test(code)) throw new Error('Enter your six-digit verification code.');
        onIntent('home'); const { error } = await supabase.auth.verifyOtp({ phone: requestedPhone, token: code, type: 'sms' }); if (error) throw error;
      }
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function google() {
    if (locked) return; setGoogleBusy(true); setError(''); onIntent('home');
    try { await signInWithGoogle(); } catch (e) { setError(errorText(e)); } finally { setGoogleBusy(false); }
  }
  async function resend() {
    if (locked || Date.now() < cooldown || !requestedPhone) return; setBusy(true); setError('');
    try { const { error } = await supabase.auth.signInWithOtp({ phone: requestedPhone }); if (error) throw error; setCode(''); setCooldown(Date.now() + 60000); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: '100%', maxWidth: 1100, alignSelf: 'center', flexGrow: 1, padding: wide ? 24 : 0 }}>
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 24 : 0, paddingBottom: 24, backgroundColor: wide ? 'transparent' : colors.panel }}>
      <View style={{ flex: wide ? 1 : undefined, backgroundColor: colors.action, padding: 24, paddingBottom: wide ? 32 : 52, gap: 22, overflow: 'hidden' }}>
        <View testID="login-brand-header" style={{ position: 'relative' }}>
          <Brand stacked onAccent />
          <View testID="login-appearance-controls" style={{ position: 'absolute', top: 0, right: 0 }}><ThemeToggle /></View>
        </View>
        <WelcomeGallery wide={wide} compact onAccent />
      </View>
      <View style={{ flex: wide ? 1 : undefined, marginTop: wide ? 0 : -28, backgroundColor: colors.panel, borderRadius: theme === 'gallery' ? 32 : 26, padding: wide ? 32 : 24, gap: 20, borderWidth: wide ? 1 : 0, borderColor: colors.line }}>
        {stage === 'code' && <IconButton name="back" label="Change mobile number" disabled={locked} onPress={() => { setStage('phone'); setCode(''); setError(''); }} />}
        <View style={{ gap: 8 }}><Text style={[styles.title, { fontSize: 27, lineHeight: 33 }]}>{stage === 'code' ? 'Check your phone.' : 'Welcome to your circle.'}</Text><Text style={styles.muted}>{stage === 'code' ? `Enter the six-digit code sent to +91 ••••••${requestedPhone.slice(-4)}.` : isProfessionalApp ? 'Sign in to manage your work, bookings and earnings.' : 'Sign in to find and book your next creative collaborator.'}</Text></View>
        {stage === 'phone' ? <View style={styles.field}><Text style={styles.label}>Mobile number</Text><View style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 24 }]}><Icon name="user" size={18} color={colors.muted} /><Text style={{ color: colors.text, borderRightWidth: 1, borderColor: colors.line, paddingRight: 10 }}>+91</Text><TextInput accessibilityLabel="Mobile number" editable={!locked} autoComplete="tel-national" keyboardType="phone-pad" maxLength={10} value={phone} onChangeText={value => setPhone(value.replace(/\D/g, ''))} placeholder="Your mobile number" placeholderTextColor={colors.muted} style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 14, minHeight: 22 }} onSubmitEditing={() => { void submit(); }} /></View></View>
          : <Field label="6-digit verification code" value={code} onChange={value => setCode(value.replace(/\D/g, ''))} editable={!locked} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} placeholder="000000" style={{ borderRadius: 24, letterSpacing: 10, textAlign: 'center', fontSize: 24 }} onSubmitEditing={() => { void submit(); }} />}
        <Notice message={error} /><Button title={stage === 'phone' ? 'Continue with mobile' : 'Verify & continue'} icon="arrow" onPress={submit} busy={busy} disabled={googleBusy} />
        {stage === 'phone' ? <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={[styles.divider, { flex: 1 }]} /><Text style={[styles.muted, { fontSize: 11 }]}>or continue with</Text><View style={[styles.divider, { flex: 1 }]} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Continue with Google" accessibilityState={{ disabled: locked, busy: googleBusy }} disabled={locked} onPress={() => { void google(); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 50, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 25, opacity: locked || pressed ? .6 : 1 })}><Image accessible={false} source={require('../../assets/icons/google.png')} style={{ width: 20, height: 20 }} /><Text style={[styles.text, { fontWeight: '600' }]}>{googleBusy ? 'Connecting to Google…' : 'Continue with Google'}</Text></Pressable>
        </> : <View style={{ alignItems: 'center' }}><TextButton title={seconds ? `Resend code in ${seconds}s` : 'Resend code'} disabled={locked || seconds > 0} onPress={resend} /></View>}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}><Icon name="shield" size={15} color={colors.muted} /><Text style={[styles.muted, { fontSize: 10, textAlign: 'center', flexShrink: 1 }]}>No password needed. New here? We’ll create your account.</Text></View>
        <LegalLinks />
      </View>
    </View>
  </ScrollView>;
}
