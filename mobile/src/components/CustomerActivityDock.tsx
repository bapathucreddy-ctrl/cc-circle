import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { bookingActivity, bookingParticipants, tracking } from '../lib/api';
import { supabase } from '../lib/supabase';
import { drivingRoute } from '../lib/routes';
import { useForegroundRefresh, useResource } from '../hooks';
import type { Booking } from '../domain';
import { Icon, useTheme } from '../ui';
import { genericRiderImage, riderImages } from './mapArtwork';
import { customerActivity } from '../lib/customerActivity';

export function CustomerActivityDock({ userId, currentBookingId, refreshVersion, reviewedBookingIds, onOpen }: { userId: string; currentBookingId?: string; refreshVersion: number; reviewedBookingIds: string[]; onOpen: (booking: Booking) => void }) {
  const activity = useResource(async () => {
    return customerActivity(await bookingActivity(), new Set(reviewedBookingIds));
  }, `${userId}-${refreshVersion}`);
  useForegroundRefresh(activity.refresh);
  useEffect(() => {
    const channel = supabase.channel(`customer-activity-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `client_id=eq.${userId}` }, () => { void activity.refresh(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, activity.refresh]);
  if (!activity.data || activity.data.id === currentBookingId || (activity.data.status === 'completed' && !(activity.data.billing_mode==='hourly'&&!activity.data.paid_at) && (Boolean(activity.error) || reviewedBookingIds.includes(activity.data.id)))) return null;
  return <ActivityCard key={activity.data.id} booking={activity.data} onOpen={onOpen} />;
}
function ActivityCard({ booking, onOpen }: { booking: Booking; onOpen: (booking: Booking) => void }) {
  const { colors } = useTheme();
  const live = ['en_route', 'arrived'].includes(booking.status) && !booking.service_started_at;
  const result = useResource(async () => {
    const [person, point] = await Promise.all([bookingParticipants(booking.id), live ? tracking(booking.id) : Promise.resolve(null)]);
    return { person, point };
  }, `${booking.id}-${booking.status}-${booking.service_started_at}`);
  useForegroundRefresh(result.refresh);
  const [estimate, setEstimate] = useState('');
  const point = result.data?.point;
  const fresh = Boolean(point && Date.now() - new Date(point.updated_at).getTime() < 90000);
  useEffect(() => {
    setEstimate('');
    if (!point || !live || !fresh) return;
    const controller = new AbortController();
    void drivingRoute([point.longitude, point.latitude], [booking.venue_longitude, booking.venue_latitude], controller.signal).then(route => {
      if (route && !controller.signal.aborted) setEstimate(`${Math.ceil(route.durationSeconds / 60)} min · ${(route.distanceMeters / 1000).toFixed(1)} km`);
    }).catch(() => {});
    return () => controller.abort();
  }, [point?.longitude, point?.latitude, point?.updated_at, fresh, live, booking.venue_longitude, booking.venue_latitude]);
  const name = result.data?.person?.professional_name || booking.service_name;
  const caption = booking.billing_mode==='hourly'&&booking.status==='completed'&&!booking.paid_at?'Service complete - Pay final invoice':booking.billing_mode==='hourly'&&booking.status==='accepted'?'Hourly rate agreed - Awaiting your professional':booking.status === 'completed' ? 'Service complete · Rate your experience' : booking.status === 'arrived' ? booking.completion_requested_at ? 'Service finished ? Share your end OTP' : booking.service_started_at ? 'Service in progress' : 'Arrived ? Share your start OTP' : booking.status === 'en_route' ? estimate || 'On the way · Waiting for a fresh location' : booking.status === 'accepted' ? booking.paid_at ? 'Accepted · Waiting for your professional' : 'Accepted · Pay before your service' : 'Waiting for acceptance';
  return <Pressable testID="customer-tracking-dock" accessibilityRole="button" accessibilityLabel={booking.status==='completed'&&booking.billing_mode==='hourly'&&!booking.paid_at?'Pay final invoice':booking.status === 'completed' ? 'Rate completed service' : 'Open current booking'} onPress={() => onOpen(booking)} style={{ marginHorizontal: 14, marginBottom: 8, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: 1052, alignSelf: 'center', width: '94%' }}>
    <Image accessible={false} source={result.data?.person?.category ? riderImages[result.data.person.category] : genericRiderImage} style={{ width: 50, height: 50 }} />
    <View style={{ flex: 1, minWidth: 0, gap: 5 }}><Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{name}</Text><Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>{caption}</Text></View><Icon name="chevron" color={colors.accent} />
  </Pressable>;
}
