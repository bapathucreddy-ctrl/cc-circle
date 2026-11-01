import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { Category } from '../domain';
import { useServiceImages, useServiceNames } from '../lib/useServiceImages';
import { Icon, useTheme } from '../ui';
const picks: { category: Category; key: string; label: string }[] = [
  { category: 'Makeup', key: 'party-makeup', label: 'Party-ready makeup' },
  { category: 'Photographer', key: 'portrait-photography', label: 'Your next portrait' },
  { category: 'ContentCreator', key: 'event-reels', label: 'Moments into reels' },
  { category: 'HairStylist', key: 'party-hair', label: 'A fresh hair look' },
];
export function CirclePicks({ onChoose }: { onChoose: (category: Category, key: string) => void }) {
  const serviceImages = useServiceImages();
  const names = useServiceNames();
  const { styles, colors } = useTheme();
  return <View style={{ gap: 12, marginTop: 4 }}><Text style={[styles.heading, { fontSize: 17 }]}>Artist House top picks</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
      {picks.map(original => { const pick = {...original,label:names[original.key] || original.label}; return <Pressable key={pick.key} accessibilityRole="button" accessibilityLabel={pick.label} onPress={() => onChoose(pick.category, pick.key)} style={({ pressed }) => ({ width: 156, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, opacity: pressed ? .75 : 1 })}>
        <Image accessible={false} source={serviceImages[pick.key]} resizeMode="cover" style={{ width: '100%', height: 120 }} />
        <View style={{ padding: 11, gap: 10 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: '600', minHeight: 32 }}>{pick.label}</Text><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: colors.muted, fontSize: 11 }}>Explore</Text><Icon name="arrow" size={16} /></View></View>
      </Pressable>; })}
    </ScrollView>
  </View>;
}
