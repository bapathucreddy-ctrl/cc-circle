import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bengaluru, categoryLabels, money, type Category, type Coordinate } from '../domain';
import { useForegroundRefresh, useResource } from '../hooks';
import { servicesForCategory } from '../lib/serviceCatalog';
import { serviceDescriptions, serviceImages } from '../lib/servicePresentation';
import { serviceStartingPrices } from '../lib/serviceStartingPrices';
import { Button, Icon, IconButton, Notice, useTheme, welcomeImages } from '../ui';

export function ServiceOptions({ category, center, availableNow, onChoose }: { category: Category; center: Coordinate; availableNow: boolean; onChoose: (key: string) => void }) {
  const { styles, colors } = useTheme();
  const prices = useResource(() => serviceStartingPrices(category, center, availableNow), JSON.stringify([category, center, availableNow]), 'service-starting-prices');
  useForegroundRefresh(prices.refresh, 60000);
  return <View style={{ gap: 12 }}>
    <Notice message={prices.error} />{Boolean(prices.error) && <Button title="Retry prices" secondary onPress={prices.refresh} />}
    {servicesForCategory(category).map(service => {
      const price = prices.data?.[service.key];
      return <Pressable key={service.key} accessibilityRole="button" accessibilityLabel={`${service.label}, ${price != null ? `starts from ${money(price)}` : 'view availability'}`} onPress={() => onChoose(service.key)} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: pressed ? colors.selected : colors.panel })}>
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}><Text style={[styles.heading, { fontSize: 16 }]}>{service.label}</Text><Text numberOfLines={2} style={[styles.muted, { fontSize: 12, lineHeight: 18 }]}>{serviceDescriptions[service.key]}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}><Text style={[styles.label, { flex: 1, fontSize: 13 }]}>{price != null ? `Starts from ${money(price)}` : prices.loading ? 'Checking prices…' : 'View availability'}</Text><View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow" size={17} color={colors.text} /></View></View>
        </View>
        <Image source={serviceImages[service.key] || welcomeImages[category]} style={{ width: 100, height: 110, borderRadius: 15, backgroundColor: colors.selected }} resizeMode="cover" />
      </Pressable>;
    })}
  </View>;
}

export function CraftServices({ category, center = bengaluru, availableNow = true, onChoose }: { category: Category; center?: Coordinate; availableNow?: boolean; onChoose: (key: string) => void }) {
  const { styles } = useTheme();
  return <ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>{categoryLabels[category]}</Text><Text style={styles.title}>Find your perfect session.</Text><ServiceOptions category={category} center={center} availableNow={availableNow} onChoose={onChoose} /></ScrollView>;
}

export function CraftServiceSheet({ category, center, availableNow, onClose, onChoose }: { category: Category | null; center: Coordinate; availableNow: boolean; onClose: () => void; onChoose: (category: Category, key: string) => void }) {
  const { colors, styles } = useTheme();
  if (!category) return null;
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0009' }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close service selection" onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
    <View style={{ maxHeight: '88%', width: '100%', maxWidth: 620, alignSelf: 'center' }}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 12 }}><IconButton name="close" label="Close services" onPress={onClose} /></View>
      <SafeAreaView edges={['bottom']} accessibilityViewIsModal style={{ backgroundColor: colors.panel, borderTopLeftRadius: 30, borderTopRightRadius: 30, flexShrink: 1 }}>
        <View style={{ alignItems: 'center', paddingTop: 12 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line }} /></View>
        <View style={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 16, gap: 6 }}><Text style={[styles.title, { fontSize: 23 }]}>{categoryLabels[category]}</Text><Text style={styles.muted}>Choose your service</Text></View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}><ServiceOptions key={category} category={category} center={center} availableNow={availableNow} onChoose={key => onChoose(category, key)} /></ScrollView>
      </SafeAreaView>
    </View>
  </View></Modal>;
}
