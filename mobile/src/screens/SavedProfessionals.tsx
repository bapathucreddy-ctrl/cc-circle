import { useEffect } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { KeyboardAwareScrollView as ScrollView } from '../components/KeyboardAwareScrollView';
import { ProfessionalAvatar } from '../components/ProfessionalAvatar';
import { InstagramVerificationBadge } from '../components/InstagramVerificationBadge';
import { SaveProfessionalButton } from '../components/SaveProfessionalButton';
import { savedIds, savedProfessionals } from '../lib/api';
import { useForegroundRefresh, useResource } from '../hooks';
import { categoryLabels, type Professional } from '../domain';
import { Button, Card, EmptyState, Notice, useTheme } from '../ui';

export function SavedProfessionals({ userId, onProfile }: { userId: string; onProfile: (person: Professional) => void }) {
  const { styles, colors } = useTheme();
  const ids = useResource(() => savedIds(userId), userId, 'saved');
  const result = useResource(() => savedProfessionals(userId), userId, 'saved-professionals');
  useForegroundRefresh(ids.refresh);
  useEffect(() => { if (ids.data) void result.refresh(); }, [ids.data, result.refresh]);
  const people = result.data?.filter(person => !ids.data || ids.data.includes(person.id)) || [];
  return <ScrollView contentContainerStyle={[styles.content, { paddingTop: 80 }]} refreshControl={<RefreshControl refreshing={result.loading} onRefresh={async () => { await ids.refresh(); await result.refresh(); }} />}>
    <Text style={styles.heading}>Saved professionals</Text>
    <Notice message={result.error || ids.error} />
    {(result.error || ids.error) && <Button title="Retry" secondary onPress={async () => { await ids.refresh(); await result.refresh(); }} />}
    {result.loading && <Text style={styles.muted}>Loading saved professionals...</Text>}
    {people.map(person => <Card key={person.id}>
      <View style={styles.between}><View style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <ProfessionalAvatar professionalId={person.id} name={person.display_name} size={54} />
        <View style={{ flex: 1, gap: 5 }}><View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><Text numberOfLines={1} style={{ flexShrink: 1, color: colors.text, fontWeight: '600', fontSize: 14 }}>{person.display_name}</Text><InstagramVerificationBadge professionalId={person.id} /></View><Text style={styles.muted}>{categoryLabels[person.category]}</Text><Text style={[styles.muted, { fontSize: 11 }]}>{person.available_now ? 'Online' : 'Offline'}</Text></View>
      </View><SaveProfessionalButton compact userId={userId} professionalId={person.id} /></View>
      <Button title="View profile & services" secondary onPress={() => onProfile(person)} />
    </Card>)}
    {!result.loading && !result.error && !ids.error && !people.length && <EmptyState icon="heart" title="Your favourites belong here" message="Tap the heart on a professional’s profile or save them after reviewing your service." />}
  </ScrollView>;
}
