import { AppFooter } from './AppFooter';
import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { legalContact, legalOperator, legalUpdated, policies, providerPrivacyLinks, type PolicyId } from '../legal';
import { Button, IconButton, Notice, useTheme } from '../ui';

export function LegalLinks({ account = false }: { account?: boolean }) {
  const { styles, colors } = useTheme();
  const [selected, setSelected] = useState<PolicyId | null>(null);
  const [error, setError] = useState('');
  const policy = selected ? policies[selected] : null;
  async function open(url: string) {
    setError('');
    try { await Linking.openURL(url); } catch { setError('Unable to open this link. Please try again.'); }
  }
  return <View style={{ gap: 10 }}>
    {account ? <Text style={styles.heading}>Legal & privacy</Text> : <Text style={[styles.muted, { textAlign: 'center', fontSize: 11 }]}>By continuing, you agree to our Terms and Conditions and acknowledge our Privacy Policy.</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: account ? 'flex-start' : 'center', gap: 4 }}>
      {(Object.keys(policies) as PolicyId[]).map(id => <Pressable key={id} accessibilityRole="button" onPress={() => { setError(''); setSelected(id); }} style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 8, minHeight: 44, opacity: pressed ? .55 : 1 })}><Text style={{ color: colors.text, fontSize: 12, textDecorationLine: 'underline' }}>{policies[id].title}</Text></Pressable>)}
    </View>
    <Modal visible={Boolean(policy)} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setSelected(null)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[styles.between, { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line }]}><Text style={[styles.heading, { flex: 1 }]}>{policy?.title}</Text><IconButton name="close" label="Close policy" onPress={() => setSelected(null)} /></View>
        {policy && <ScrollView key={selected} contentContainerStyle={[styles.content, { width: '100%', maxWidth: 780, alignSelf: 'center', paddingBottom: 32 }]}>
          <Text style={styles.eyebrow}>{legalOperator.toUpperCase()}</Text><Text style={styles.title}>{policy.title}</Text><Text style={styles.muted}>Last updated: {legalUpdated}</Text><Text style={styles.text}>{policy.summary}</Text>
          {policy.sections.map(section => <View key={section.title} style={{ gap: 8 }}><Text accessibilityRole="header" style={styles.heading}>{section.title}</Text><Text selectable style={[styles.text, { lineHeight: 24 }]}>{section.text}</Text></View>)}
          {selected !== 'terms' && <><Text style={styles.heading}>Provider privacy notices</Text>{providerPrivacyLinks.map(link => <Button key={link.title} secondary title={`${link.title} privacy notice ↗`} onPress={() => { void open(link.url); }} />)}</>}
          <Notice message={error} /><Button secondary title={`Contact ${legalContact}`} onPress={() => { void open(`mailto:${legalContact}`); }} /><Button title="Done" onPress={() => setSelected(null)} />
        </ScrollView>}
        <AppFooter />
      </SafeAreaView>
    </Modal>
  </View>;
}
