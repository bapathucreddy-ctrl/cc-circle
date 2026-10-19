import type { ReactNode } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { type Category } from '../domain';
import { useForegroundRefresh, useResource } from '../hooks';
import { campaignImages, serviceImages } from '../lib/servicePresentation';
import { supabase } from '../lib/supabase';
import { Icon, useTheme, welcomeImages } from '../ui';

// Sampled from the main Navratri artwork's teal background.
export const seasonalHomeColor = '#013832';
const seasonalBannerColor = seasonalHomeColor;
function gradient(value: string): ViewStyle {
  return Platform.OS === 'web' ? { backgroundImage: value } as ViewStyle : { experimental_backgroundImage: value };
}
type Campaign = { id: string; title: string; subtitle: string; category: Category; service_key: string | null };
type SeasonalService = { label: string; category: Category; key: string };
function relatedServices(item: Campaign): SeasonalService[] {
  if (/wedding/i.test(item.id)) return [
    { label: 'Bridal makeup', category: 'Makeup', key: 'bridal-makeup' },
    { label: 'Wedding photos', category: 'Photographer', key: 'wedding-photography' },
    { label: 'Bridal hair', category: 'HairStylist', key: 'bridal-hair' },
    { label: 'Wedding reels', category: 'ContentCreator', key: 'event-reels' },
  ];
  return [
    { label: 'Festive makeup', category: 'Makeup', key: 'festive-makeup' },
    { label: 'Party hair', category: 'HairStylist', key: 'party-hair' },
    { label: 'Event photos', category: 'Photographer', key: 'event-photography' },
    { label: 'Celebration reels', category: 'ContentCreator', key: 'event-reels' },
  ];
}
function artwork(item: Campaign) {
  if (/garba|navratri|dandiya/i.test(item.id)) return campaignImages.navratri;
  if (/diwali/i.test(item.id)) return campaignImages.diwali;
  if (/wedding/i.test(item.id)) return campaignImages.wedding;
  return item.service_key && serviceImages[item.service_key] || welcomeImages[item.category];
}
export function OccasionBanners({ onChoose, children }: { onChoose: (category: Category, serviceKey?: string) => void; children?: ReactNode }) {
  const { colors } = useTheme();
  const result = useResource(async () => {
    // RLS restricts this query to enabled campaigns within their active dates.
    const { data, error } = await supabase.from('home_campaigns').select('id,title,subtitle,category,service_key').order('priority', { ascending: false }).order('id').limit(1);
    if (error) throw error;
    return data as Campaign[];
  }, 'active', 'home-campaigns');
  useForegroundRefresh(result.refresh, 3600000);
  const item = result.data?.[0];
  const integratedLettering = item && /garba|navratri|dandiya/i.test(item.id);
  return <View style={{ backgroundColor: seasonalBannerColor, width: '100%', paddingBottom: item ? 0 : 16 }}>
    <View style={{ width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 14, gap: 5 }}>{children}</View>
    {item && <View style={{ width: '100%', maxWidth: 1080, alignSelf: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={item.title} accessibilityHint={item.subtitle} onPress={() => onChoose(item.category, item.service_key || undefined)} style={({ pressed }) => ({ width: '100%', maxWidth: 720, alignSelf: 'center', aspectRatio: 1.5, overflow: 'hidden', marginTop: 12, opacity: pressed ? .9 : 1 })}>
        <Image accessible={false} source={artwork(item)} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="contain" />
        {integratedLettering && <View pointerEvents="none" accessible={false} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
          <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: 36 }, gradient('linear-gradient(180deg, ' + seasonalBannerColor + ' 0%, ' + seasonalBannerColor + '00 100%)')]} />
          <View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 42 }, gradient('linear-gradient(180deg, ' + seasonalBannerColor + '00 0%, ' + seasonalBannerColor + ' 100%)')]} />
        </View>}
        {!integratedLettering && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 9, backgroundColor: '#003F43B8' }}>
          <Text style={{ color: '#FFE7AC', fontSize: 10, letterSpacing: 3, fontWeight: '600' }}>CELEBRATE WITH CIRCLE</Text>
          <Text numberOfLines={2} style={{ color: '#FFE7AC', fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 32, lineHeight: 38, textAlign: 'center' }}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ color: '#FFF6DD', fontSize: 12, fontWeight: '600' }}>Explore artists</Text><Icon name="arrow" color="#FFF6DD" size={15} /></View>
        </View>}
      </Pressable>
      <View style={[{ paddingTop: 16, paddingBottom: 12, backgroundColor: colors.panel }, gradient('linear-gradient(180deg, ' + seasonalBannerColor + ' 0%, ' + (colors.panel.toLowerCase() === '#ffffff' ? '#315C50 20%, #78998A 42%, #B9CFC2 65%, #E5EEE8 85%, ' : '#123F33 35%, #1D3D32 70%, ') + colors.panel + ' 100%)')]}>
      <Text style={{ color: '#FFF6DD', fontSize: 16, fontWeight: '600', letterSpacing: -.2, paddingHorizontal: 16, paddingBottom: 4 }}>Festive picks</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        {relatedServices(item).map(service => <Pressable key={service.key} accessibilityRole="button" accessibilityLabel={'Explore ' + service.label} onPress={() => onChoose(service.category, service.key)} style={({ pressed }) => ({ width: 112, borderRadius: 12, borderWidth: 1, borderColor: '#D5E6D9', backgroundColor: '#FFFFFF', overflow: 'hidden', opacity: pressed ? .8 : 1 })}>
          <View style={{ height: 90, overflow: 'hidden', borderTopLeftRadius: 11, borderTopRightRadius: 11 }}>
            <Image accessible={false} source={serviceImages[service.key]} style={{ width: '100%', height: 90 }} resizeMode="cover" />
          </View>
          <Text numberOfLines={2} style={{ color: '#102F25', backgroundColor: 'transparent', fontSize: 11, lineHeight: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 7, paddingHorizontal: 3 }}>{service.label}</Text>
        </Pressable>)}
      </ScrollView>
      </View>
    </View>}
  </View>;
}
