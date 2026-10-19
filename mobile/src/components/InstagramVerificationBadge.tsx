import { View } from 'react-native';
import { useResource } from '../hooks';
import { professionalPresentation } from '../lib/professionalPresentation';
import { useTheme } from '../ui';

export function VerifiedTickBadge() {
  const { colors } = useTheme();
  return <View accessible accessibilityLabel="Instagram account connected. Identity and work quality have not been checked."
    style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {[0, 30, 60].map(angle => <View key={angle} accessible={false} style={{
      position: 'absolute', width: 17, height: 17, borderRadius: 4,
      backgroundColor: colors.text, transform: [{ rotate: `${angle}deg` }],
    }} />)}
    <View accessible={false} style={{
      width: 7, height: 11, borderRightWidth: 2.5, borderBottomWidth: 2.5,
      borderColor: colors.panel, transform: [{ rotate: '45deg' }], marginTop: -3,
    }} />
  </View>;
}

export function InstagramVerificationBadge({ professionalId }: { professionalId: string }) {
  const result = useResource(() => professionalPresentation(professionalId), professionalId, 'professional-presentation');
  if (!result.data?.verified || result.error) return null;
  return <VerifiedTickBadge />;
}
