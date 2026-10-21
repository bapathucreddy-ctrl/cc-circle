import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useForegroundRefresh, useResource } from '../hooks';
import { portfolioAction } from '../lib/portfolio';
import { preparePortfolioImage } from '../lib/preparePortfolioImage';
import { professionalAvatar } from '../lib/professionalPresentation';
import { supabase } from '../lib/supabase';
import { errorText } from '../domain';
import { Notice, TextButton, useTheme } from '../ui';

export function ProfessionalAvatar({ professionalId, name, editable = false, size = 80 }: { professionalId: string; name: string; editable?: boolean; size?: number }) {
  const { colors, styles } = useTheme();
  const photo = useResource(() => professionalAvatar(professionalId), professionalId, 'professional-avatar');
  useForegroundRefresh(photo.refresh, 45 * 60000);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const recovered = useRef(false);
  async function retryPhoto(manual = false) {
    if (manual) { recovered.current = false; setError(''); }
    await photo.refresh(); setRevision(value => value + 1);
  }
  async function choose() {
    if (busy) return; setBusy(true); setError('');
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1, exif: false });
      if (picked.canceled || !picked.assets[0]) return;
      const bytes = await preparePortfolioImage(picked.assets[0]);
      const target = await portfolioAction<{ path: string; token: string }>('upload_url', { mime: 'image/jpeg' });
      const { error } = await supabase.storage.from('portfolio-work').uploadToSignedUrl(target.path, target.token, bytes, { contentType: 'image/jpeg' });
      if (error) throw error;
      await portfolioAction('set_avatar', { path: target.path }); await photo.refresh();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  const avatar = <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.selected, borderWidth: 1, borderColor: colors.line }}>
    {photo.data?.src ? <Image key={revision} accessibilityLabel={`${name}'s profile photo`} source={{ uri: photo.data.src }} onLoad={() => { setFailedUri(null); setError(''); }} onError={() => { setFailedUri(photo.data!.src); setError('Profile photo could not be loaded.'); if (!recovered.current) { recovered.current = true; void retryPhoto(); } }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
    {(!photo.data?.src || failedUri === photo.data.src) && <Text style={{ position: 'absolute', color: colors.text, fontSize: size * .38, fontWeight: '700' }}>{name.slice(0, 1).toUpperCase()}</Text>}
    {busy && <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.panel, opacity: .85, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.text} /></View>}
  </View>;
  return <View style={{ gap: 6, alignItems: 'flex-start' }}>{editable ? <Pressable accessibilityRole="button" accessibilityLabel="Update profile photo" onPress={() => { void choose(); }} disabled={busy}>{avatar}<Text style={[styles.muted, { fontSize: 11, textAlign: 'center', marginTop: 6 }]}>Edit photo</Text></Pressable> : avatar}<Notice message={error || photo.error} />{(error || photo.error) && <TextButton title="Retry photo" onPress={() => { void retryPhoto(true); }} />}</View>;
}
