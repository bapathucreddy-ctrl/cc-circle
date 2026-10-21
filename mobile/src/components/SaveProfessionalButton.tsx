import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { savedIds, toggleSaved } from '../lib/api';
import { useResource } from '../hooks';
import { errorText } from '../domain';
import { Button, Icon, Notice, useTheme } from '../ui';

export function SaveProfessionalButton({ userId, professionalId, compact = false }: {
  userId: string; professionalId: string; compact?: boolean;
}) {
  const saved = useResource(() => savedIds(userId), userId, 'saved');
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const confirmed = saved.data?.includes(professionalId) || false;
  const selected = optimistic ?? confirmed;
  async function toggle() {
    if (pending.current || saved.loading || saved.error) return;
    pending.current = true; setBusy(true); setError('');
    setOptimistic(!confirmed);
    try { await toggleSaved(userId, professionalId, confirmed); await saved.refresh(); }
    catch (e) { setError(errorText(e)); }
    finally { pending.current = false; setBusy(false); setOptimistic(null); }
  }
  const disabled = busy || saved.loading || Boolean(saved.error);
  return <View style={{ gap: 6 }}>
    <Pressable testID="save-professional-button" accessibilityRole="button" accessibilityLabel={selected ? 'Unsave professional' : 'Save professional'} accessibilityState={{ selected, disabled, busy }} disabled={disabled} onPress={toggle} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, paddingHorizontal: compact ? 0 : 12, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', opacity: pressed || disabled ? .6 : 1 })}>
      {selected ? <View testID="saved-heart" accessible={false} style={{ width: 28, height: 28 }}>
        <View style={{ position: 'absolute', left: 7, top: 7, width: 14, height: 14, backgroundColor: '#ED4956', transform: [{ rotate: '-45deg' }] }}>
          <View style={{ position: 'absolute', left: 0, top: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: '#ED4956' }} />
          <View style={{ position: 'absolute', left: 7, top: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#ED4956' }} />
        </View>
      </View> : <Icon name="heart" size={26} color={colors.text} />}
      {!compact && <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{selected ? 'Saved professional' : 'Save professional'}</Text>}
    </Pressable>
    <Notice message={error || saved.error} />
    {saved.error && <Button title="Retry saved status" secondary onPress={saved.refresh} />}
  </View>;
}
