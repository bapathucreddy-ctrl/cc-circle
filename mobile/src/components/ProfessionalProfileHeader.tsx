import { Pressable, Text, View } from 'react-native';
import { categoryLabels, type Professional } from '../domain';
import { useResource } from '../hooks';
import { professionalReviews } from '../lib/api';
import { loadPortfolio } from '../lib/portfolio';
import { Button, Icon, useTheme } from '../ui';
import { ProfessionalAvatar } from './ProfessionalAvatar';
import { InstagramVerificationBadge } from './InstagramVerificationBadge';

export function ProfessionalProfileHeader({ person, serviceCount, workCount, owner = false, onEdit, onSignOut, online = false, availabilityBusy = false, onAvailabilityChange }: { person: Professional; serviceCount: number; workCount?: number; owner?: boolean; onEdit?: () => void; onSignOut?: () => void; online?: boolean; availabilityBusy?: boolean; onAvailabilityChange?: (online: boolean) => void }) {
  const { styles, colors } = useTheme();
  const work = useResource(() => loadPortfolio(person.id), person.id, 'portfolio');
  const reviews = useResource(() => professionalReviews(person.id), person.id, 'professional-reviews');
  return <View style={{ gap: 14, paddingVertical: 8 }}>
    <View style={styles.between}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, paddingTop: owner ? 8 : 0 }}><Text style={[styles.heading, { flexShrink: 1, fontSize: owner ? 20 : 23 }]}>{person.display_name}</Text><InstagramVerificationBadge professionalId={person.id} /></View>
      {owner && <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        {onAvailabilityChange && <View style={{ width: 48, alignItems: 'center', gap: 4 }}>
          <Pressable accessibilityRole="switch" accessibilityLabel="Professional availability" accessibilityHint={online ? 'Go offline' : 'Go online'} accessibilityState={{ checked: online, disabled: availabilityBusy }} disabled={availabilityBusy} onPress={() => onAvailabilityChange(!online)} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', opacity: pressed || availabilityBusy ? .5 : 1 })}>
            <Icon name="power" size={24} color={online ? colors.text : colors.muted} />
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={{ color: online ? colors.text : colors.muted, fontSize: 10, lineHeight: 13 }}>{online ? 'Online' : 'Offline'}</Text>
        </View>}
        {onSignOut && <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={onSignOut} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="logout" size={24} color={colors.text} />
        </Pressable>}
      </View>}
    </View>
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}><ProfessionalAvatar professionalId={person.id} name={person.display_name} editable={owner} />
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around', gap: 6 }}>{[
        [workCount !== undefined ? String(workCount) : work.data ? String(work.data.media.filter(item => !item.needsReview).length) : '—', 'Works'],
        [String(serviceCount), 'Services'], [reviews.data?.count ? String(reviews.data.average) : '—', 'Rating'],
      ].map(([value, label]) => <View key={label} style={{ alignItems: 'center', gap: 5 }}><Text style={styles.heading}>{value}</Text><Text style={[styles.muted, { fontSize: 11 }]}>{label}</Text></View>)}</View>
    </View>
    <View style={{ gap: 5 }}><Text style={styles.text}>{categoryLabels[person.category]} · {person.city}</Text><Text numberOfLines={2} style={styles.muted}>{person.bio}</Text></View>
    {owner && onEdit && <Button title="Update professional details" secondary onPress={onEdit} />}
  </View>;
}
