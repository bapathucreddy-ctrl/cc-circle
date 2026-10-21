import { useEffect, type ReactNode } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { type Category } from '../domain';
import { useForegroundRefresh, useResource } from '../hooks';
import { campaignImages, serviceImages } from '../lib/servicePresentation';
import { supabase } from '../lib/supabase';
import { serviceCatalog } from '../lib/serviceCatalog';
import { useTheme, welcomeImages } from '../ui';

import { campaignBackground, campaignForeground, blendCampaignColor } from '../lib/campaignColors';
export { seasonalHomeColor } from '../lib/campaignColors';
function gradient(value: string): ViewStyle {
  return Platform.OS === 'web' ? { backgroundImage: value } as ViewStyle : { experimental_backgroundImage: value };
}
type Campaign = { id: string; title: string; subtitle: string; category: Category; service_key: string | null; image_path?: string | null; image_width?: number | null; image_height?: number | null; background_color?: string | null; featured_service_keys?: string[] | null };
type SeasonalService = { label: string; category: Category; key: string };
function relatedServices(item: Campaign): SeasonalService[] {
  if (Array.isArray(item.featured_service_keys)) return item.featured_service_keys.flatMap(key => {const service=serviceCatalog.find(s=>s.key===key);return service ? [{key:service.key,label:service.label,category:service.category}] : [];});
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
  if (item.image_path) return { uri: supabase.storage.from('home-banners').getPublicUrl(item.image_path).data.publicUrl };
  if (/garba|navratri|dandiya/i.test(item.id)) return campaignImages.navratri;
  if (/diwali/i.test(item.id)) return campaignImages.diwali;
  if (/wedding/i.test(item.id)) return campaignImages.wedding;
  return item.service_key && serviceImages[item.service_key] || welcomeImages[item.category];
}
export function OccasionBanners({ onChoose, children, onColorChange }: { onChoose: (category: Category, serviceKey?: string) => void; children?: ReactNode; onColorChange?: (color: string) => void }) {
  const { colors } = useTheme();
  const result = useResource(async () => {
    // RLS restricts this query to enabled campaigns within their active dates.
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('home_campaigns').select('id,title,subtitle,category,service_key,image_path,image_width,image_height,background_color,featured_service_keys').eq('enabled', true).lte('starts_at', now).gt('ends_at', now).order('priority', { ascending: false }).order('updated_at', { ascending: false }).limit(1);
    if (error) throw error;
    return data as Campaign[];
  }, 'active', 'home-campaigns');
  useForegroundRefresh(result.refresh, 30000);
  const item = result.data?.[0];
  const seasonalBannerColor = campaignBackground(item?.id, item?.background_color);
  const foreground = campaignForeground(seasonalBannerColor);
  useEffect(() => { onColorChange?.(seasonalBannerColor); }, [seasonalBannerColor, onColorChange]);
  return <View style={{ backgroundColor: seasonalBannerColor, width: '100%', paddingBottom: item ? 0 : 16 }}>
    <View style={{ width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 14, gap: 5 }}>{children}</View>
    {item && <View style={{ width: '100%', maxWidth: 1080, alignSelf: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={item.title} accessibilityHint={item.subtitle} onPress={() => onChoose(item.category, item.service_key || undefined)} style={({ pressed }) => ({ width: '100%', maxWidth: 720, alignSelf: 'center', aspectRatio: item.image_width && item.image_height ? item.image_width / item.image_height : 1.5, overflow: 'hidden', marginTop: 12, transform: [{ scale: pressed ? .995 : 1 }] })}>
        <Image accessible={false} source={artwork(item)} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="contain" />
      </Pressable>
      <View style={[{ paddingTop: 16, paddingBottom: 12, backgroundColor: colors.panel }, gradient('linear-gradient(180deg, ' + seasonalBannerColor + ' 0%, ' + blendCampaignColor(seasonalBannerColor, colors.panel, .25) + ' 25%, ' + blendCampaignColor(seasonalBannerColor, colors.panel, .65) + ' 65%, ' + blendCampaignColor(seasonalBannerColor, colors.panel, .9) + ' 90%, ' + colors.panel + ' 100%)')]}>
      {relatedServices(item).length > 0 && <Text style={{ color: foreground, fontSize: 16, fontWeight: '600', letterSpacing: -.2, paddingHorizontal: 16, paddingBottom: 4 }}>Festive picks</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        {relatedServices(item).map(service => <Pressable key={service.key} accessibilityRole="button" accessibilityLabel={'Explore ' + service.label} onPress={() => onChoose(service.category, service.key)} style={({ pressed }) => ({ width: 112, borderRadius: 12, borderWidth: 1, borderColor: blendCampaignColor(seasonalBannerColor, '#FFFFFF', .7), backgroundColor: '#FFFFFF', overflow: 'hidden', opacity: pressed ? .8 : 1 })}>
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
