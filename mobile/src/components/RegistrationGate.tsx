import { ServiceLoader as ActivityIndicator } from './ServiceLoader';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { isProfessionalApp } from '../appVariant';
import { errorText } from '../domain';
import { useResource } from '../hooks';
import { myRegistration, completeRegistration, type Registration } from '../lib/registration';
import { supabase } from '../lib/supabase';
import { Brand, Button, Field, Notice, ThemeToggle, useTheme } from '../ui';
import { PhoneVerificationCard } from './PhoneVerificationCard';

export function RegistrationGate({ userId, children }: { userId: string; children: ReactNode }) {
  const result = useResource(myRegistration, userId);
  const { styles } = useTheme();
  if (result.loading && !result.data) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Loading your account profile" /></View>;
  if (!result.data) return <View style={styles.content}><Notice message={result.error} /><Button title="Retry account profile" onPress={result.refresh} /><Button title="Sign out" secondary onPress={() => { void supabase.auth.signOut(); }} /></View>;
  if (result.data.completed_at && (!isProfessionalApp || result.data.professional_name)) return children;
  return <CompleteProfile key={userId} initial={result.data} onCompleted={result.refresh} />;
}

function CompleteProfile({ initial, onCompleted }: { initial: Registration; onCompleted: () => Promise<void> }) {
  const { styles } = useTheme();
  const [fullName, setFullName] = useState(initial.full_name); const [email, setEmail] = useState(initial.email);
  const [phoneVerified, setPhoneVerified] = useState(initial.phone_verified);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const aliasOnly = Boolean(initial.completed_at) && isProfessionalApp;
  // Verification updates the Auth session; keep this form mounted while the OTP finishes.
  useEffect(() => { if (initial.phone_verified) setPhoneVerified(true); }, [initial.phone_verified]);
  async function save() {
    setBusy(true); setError('');
    try {
      if (fullName.trim().length < 2) throw new Error('Enter your full name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address.');
      if (!phoneVerified) throw new Error('Verify your mobile number before continuing.');
      await completeRegistration(fullName, email, null, isProfessionalApp);
      await onCompleted();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.between}><Brand compact /><ThemeToggle /></View>
    <Text style={styles.title}>{aliasOnly ? 'Finish your profile.' : 'Complete your account.'}</Text>
    <Text style={styles.muted}>{aliasOnly ? 'Circle assigns a private public username to your professional profile.' : 'Add these details once to finish registration. Your contact details stay private.'}</Text>
    {!aliasOnly && <>
      <Field label="Full name" value={fullName} onChange={setFullName} autoComplete="name" maxLength={120} editable={!busy} placeholder="Your full name" />
      <Field label="Email address" value={email} onChange={setEmail} autoComplete="email" keyboardType="email-address" autoCapitalize="none" maxLength={254} editable={!initial.email_from_sign_in && !busy} placeholder="you@example.com" />
      {initial.email_from_sign_in && <Text style={styles.muted}>Email provided by Google sign-in.</Text>}
      <PhoneVerificationCard purpose="registration" onVerified={setPhoneVerified} />
    </>}
    {isProfessionalApp && <Text style={styles.muted}>Circle assigns your public username. Your full name and contact details stay private.</Text>}
    <Notice message={error} /><Button title="Save & continue" onPress={save} busy={busy} disabled={!phoneVerified} />
    <Button title="Sign out" secondary disabled={busy} onPress={() => { void supabase.auth.signOut(); }} />
  </ScrollView>;
}
