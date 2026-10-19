import { ServiceLoader as ActivityIndicator } from './components/ServiceLoader';
import { useEffect, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { ProfessionalReviewsScreen } from './components/ProfessionalReviews';
import { ProfessionalPayouts } from './screens/ProfessionalPayouts';
import { Account, Join } from './screens/Account';
import { BookingDetail } from './screens/BookingDetail';
import { Bookings, statusLabels } from './screens/Marketplace';
import { bengaluru, money, type Booking, type Professional } from './domain';
import { Brand, Button, Card, EmptyState, Icon, IconButton, Notice, ThemeToggle, craftImages, useTheme } from './ui';
import { professionalProfile } from './lib/professionalProfile';
import { useAvailability, useForegroundRefresh, useResource } from './hooks';
import { supabase } from './lib/supabase';
import { myBookings } from './lib/api';
import { ProfessionalTeamRequests } from './screens/TeamRequests';
import { BookingCharges } from './components/BookingCharges';
import { InstagramVerificationBadge } from './components/InstagramVerificationBadge';
import { ProfessionalEarnings } from './components/ProfessionalEarnings';
import { ProfessionalLiveLocation, ProfessionalLocationCard } from './components/ProfessionalLiveLocation';
import { useInitialDeviceLocation } from './useInitialDeviceLocation';
import { NotificationBell } from './components/NotificationCenter';
import type { NotificationTarget } from './lib/notifications';

type Route = { screen: 'work' | 'bookings' | 'account' | 'join' | 'events' | 'payouts' } | { screen: 'reviews'; professionalId: string } | { screen: 'detail'; booking: Booking };
export function ProfessionalWorkspace({ userId, initialScreen, notificationTarget }: { userId: string; initialScreen: 'home' | 'join' | 'account'; notificationTarget?: NotificationTarget }) {
  const { colors, styles } = useTheme();
  const { center } = useInitialDeviceLocation();
  const [routes, setRoutes] = useState<Route[]>([{ screen: initialScreen === 'join' ? 'join' : 'work' }]);
  const route = routes[routes.length - 1]!;
  const navigate = (next: Route) => setRoutes(previous => [...previous, next]);
  const reset = (next: Route) => setRoutes([next]);
  const [notificationError, setNotificationError] = useState('');
  useEffect(() => {
    if (!notificationTarget) return;
    let active = true; setNotificationError('');
    if (notificationTarget.booking_id) {
      void supabase.from('bookings').select('*').eq('id', notificationTarget.booking_id).eq('professional_id', userId).maybeSingle().then(({ data, error }) => {
        if (!active) return;
        if (error || !data) setNotificationError('This job is no longer available.'); else navigate({ screen: 'detail', booking: data as Booking });
      });
    } else if (notificationTarget.event_id) reset({ screen: 'events' });
    else if (notificationTarget.kind === 'payout') reset({ screen: 'payouts' });
    else if (notificationTarget.kind === 'portfolio') reset({ screen: 'account' });
    return () => { active = false; };
  }, [notificationTarget, userId]);
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => {
    if (routes.length <= 1) return false; setRoutes(previous => previous.slice(0, -1)); return true;
  }); return () => listener.remove(); }, [routes.length]);
  const open = (booking: Booking) => navigate({ screen: 'detail', booking });
  const activeTab = route.screen === 'detail' ? 'bookings' : ['join', 'reviews'].includes(route.screen) ? 'account' : route.screen;
  return <View style={styles.page}>
    <View style={[styles.between, { paddingHorizontal: 24, paddingVertical: 12, maxWidth: 1080, width: '100%', alignSelf: 'center' }]}>
      {routes.length > 1 ? <IconButton name="back" label="Back" onPress={() => setRoutes(previous => previous.slice(0, -1))} /> : <Brand compact />}<View style={styles.row}><NotificationBell /><ThemeToggle /></View>
    </View>
    <Notice message={notificationError} />
    <ProfessionalLiveLocation userId={userId} />
    <View key={JSON.stringify(route)} style={{ flex: 1 }}>
      {route.screen === 'work' && <ProfessionalHome userId={userId} onOpen={open} onJoin={() => navigate({ screen: 'join' })} onAccount={() => reset({ screen: 'account' })} />}
      {route.screen === 'payouts' && <ProfessionalPayouts userId={userId} />}
      {route.screen === 'events' && <ProfessionalTeamRequests userId={userId} onBooking={open} />}
      {route.screen === 'bookings' && <Bookings onOpen={open} />}
      {route.screen === 'detail' && <BookingDetail initial={route.booking} userId={userId} />}
      {route.screen === 'join' && <Join userId={userId} center={center} onDone={() => reset({ screen: 'work' })} />}
      {route.screen === 'reviews' && <ProfessionalReviewsScreen professionalId={route.professionalId} />}
      {route.screen === 'account' && <Account onReviews={() => navigate({ screen: 'reviews', professionalId: userId })} userId={userId} onJoin={() => navigate({ screen: 'join' })} onSaved={() => {}} onBookings={() => reset({ screen: 'bookings' })} />}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: colors.panel, borderTopWidth: 1, borderColor: colors.line, paddingVertical: 8 }}>
      {([['work', 'Work', 'home'], ['events', 'Events', 'plus'], ['bookings', 'Bookings', 'calendar'], ['payouts', 'Payouts', 'wallet'], ['account', 'Profile', 'user']] as const).map(([id, label, icon]) => <Pressable key={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: activeTab === id }} onPress={() => reset({ screen: id })} style={{ flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 5 }}><View style={{ backgroundColor: activeTab === id ? colors.selected : 'transparent', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 }}><Icon name={icon} color={activeTab === id ? colors.accent : colors.muted} /></View><Text style={{ fontSize: 10, color: activeTab === id ? colors.accent : colors.muted }}>{label}</Text></Pressable>)}
    </View>
  </View>;
}

function ProfessionalHome({ userId, onOpen, onJoin, onAccount }: { userId: string; onOpen: (booking: Booking) => void; onJoin: () => void; onAccount: () => void }) {
  const { styles, colors } = useTheme();
  const profile = useResource(() => professionalProfile(userId), userId, 'professional-profile');
  const bookings = useResource(myBookings, 'mine', 'bookings');
  const availability = useAvailability(userId);
  useForegroundRefresh(bookings.refresh);
  useEffect(() => {
    const channel = supabase.channel('professional-work').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `professional_id=eq.${userId}` }, () => { void bookings.refresh(); void availability.refresh(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, bookings.refresh, availability.refresh]);
  const active = bookings.data?.filter(booking => ['requested', 'accepted', 'en_route', 'arrived'].includes(booking.status)) || [];
  const unpaid = bookings.data?.filter(booking => booking.status === 'completed' && !booking.paid_at) || [];
  return <ScrollView contentContainerStyle={styles.content}>
    <ProfessionalLocationCard userId={userId} />
    <View style={{ backgroundColor: colors.action, padding: 24, borderRadius: 30, borderBottomRightRadius: 54, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 170 }}><View style={{ flex: 1, gap: 12 }}><Text style={{ color: '#ffffffcc', fontSize: 10, letterSpacing: 1.6 }}>CIRCLE</Text><Text style={[styles.title, { color: '#fff', fontSize: 30 }]}>Your workday.</Text></View><Image accessible={false} source={craftImages[profile.data?.category || 'Makeup']} style={{ width: 84, height: 84, transform: [{ rotate: '-10deg' }] }} /></View><Notice message={profile.error || bookings.error} />
    {(profile.loading || bookings.loading) && <ActivityIndicator color={colors.accent} />}
    {!profile.loading && !profile.error && !profile.data ? <EmptyState title="Bring your craft into the circle." message="Create your professional profile, packages and portfolio to receive requests." action="Create professional profile" onAction={onJoin} /> : profile.data && <>
      <Card><View style={styles.row}><Text style={styles.heading}>{profile.data.display_name}</Text><InstagramVerificationBadge professionalId={userId} /></View><Notice message={availability.error} /><Text style={[styles.heading, { color: availability.data?.available_now ? colors.success : colors.muted }]}>{availability.data?.is_busy ? 'Busy · unavailable now' : availability.data?.available_now ? 'Online · available now' : 'Offline · scheduled requests only'}</Text><Button title="Manage availability" secondary onPress={onAccount} /></Card>
      <ProfessionalEarnings userId={userId} />
      <Text style={styles.heading}>{active.length} requests & upcoming jobs</Text>
      {active.map(booking => <Card key={booking.id}><Text style={styles.eyebrow}>{statusLabels[booking.status]}</Text><Text style={styles.heading}>{booking.service_name}</Text><Text style={styles.muted}>{new Date(booking.starts_at).toLocaleString()} · {booking.venue}</Text><BookingCharges booking={booking} professional/><Button title={booking.status === 'requested' ? 'Review request' : booking.status === 'accepted' ? 'Open job & start journey' : 'Open active job'} onPress={() => onOpen(booking)} /></Card>)}
      {!active.length && <EmptyState title="Ready for your next project." message="New customer requests will appear here." />}
      {unpaid.length > 0 && <Card><Text style={styles.heading}>{unpaid.length} completed services to review</Text><Text style={styles.muted}>Your earnings are released after completion and booking confirmation.</Text>{unpaid.map(booking => <Button key={booking.id} title={`View ${booking.service_name}`} secondary onPress={() => onOpen(booking)} />)}</Card>}
    </>}
  </ScrollView>;
}
