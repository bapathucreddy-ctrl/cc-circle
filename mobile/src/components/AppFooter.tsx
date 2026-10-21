import { Text, View } from 'react-native';
import { useTheme } from '../ui';

export function AppFooter() {
  const { colors } = useTheme();
  return <View accessibilityLabel="App credits" style={{ paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', gap: 2, backgroundColor: colors.bg }}>
    <Text style={{ color: colors.muted, fontSize: 9, lineHeight: 12, textAlign: 'center' }}>{'\u00a9'} {new Date().getFullYear()} The Vivaha Stories</Text>
    <Text style={{ color: colors.muted, fontSize: 9, lineHeight: 12, textAlign: 'center' }}>Created by C C Creative Labs</Text>
  </View>;
}
