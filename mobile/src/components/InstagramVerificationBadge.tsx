import { View } from 'react-native';
import { useForegroundRefresh, useResource } from '../hooks';
import { professionalPresentation } from '../lib/professionalPresentation';
import { useTheme } from '../ui';

export function VerifiedTickBadge({ kind = 'approval' }: { kind?: 'approval' | 'instagram' }) {
  const { colors } = useTheme();
  const gold = kind === 'instagram';
  return <View accessible accessibilityLabel={gold ? 'Instagram account connected. This does not confirm identity or work ownership.' : 'Profile reviewed and approved by Artist House.'}
    style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {[0, 30, 60].map(angle => <View key={angle} accessible={false} style={{
      position: 'absolute', width: 17, height: 17, borderRadius: 4,
      backgroundColor: gold ? '#D4A72C' : colors.text, transform: [{ rotate: `${angle}deg` }],
    }} />)}
    <View accessible={false} style={{
      width: 7, height: 11, borderRightWidth: 2.5, borderBottomWidth: 2.5,
      borderColor: gold ? '#231A05' : colors.panel, transform: [{ rotate: '45deg' }], marginTop: -3,
    }} />
  </View>;
}

export function InstagramVerificationBadge({ professionalId }: { professionalId: string }) {
  const result = useResource(() => professionalPresentation(professionalId), professionalId, 'professional-presentation');
  useForegroundRefresh(result.refresh, 30000);
  if (result.error || !result.data || (!result.data.verified && !result.data.instagram_connected)) return null;
  return <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
    {result.data.verified && <VerifiedTickBadge />}
    {result.data.instagram_connected && <VerifiedTickBadge kind="instagram" />}
  </View>;
}
