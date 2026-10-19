import { ServiceLoader as ActivityIndicator } from '../components/ServiceLoader';
import { useEffect, useRef, useState } from 'react';
import { AppState, RefreshControl, ScrollView, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { categoryLabels, errorText, money, type Booking, type Coordinate, type TrackingLocation } from '../domain';
import { Button, Card, Field, Icon, Notice, Segmented, useTheme } from '../ui';
import { useForegroundRefresh, useResource } from '../hooks';
import * as api from '../lib/api';
import { supabase } from '../lib/supabase';
import { drivingRoute } from '../lib/routes';
import { openPayment } from '../lib/payments';
import { TalentMap } from '../components/TalentMap';
import { statusLabels } from './Marketplace';
import { currentLocation } from '../lib/currentLocation';
import { isProfessionalApp } from '../appVariant';
import { PhoneVerificationCard } from '../components/PhoneVerificationCard';
import { BookingReviewCard } from '../components/BookingReviewCard';
import { ServiceVerification } from '../components/ServiceVerification';
import { bookingChatOpen } from '../lib/bookingChat';
import { canPayBooking,isHourly } from '../lib/billing';
import { BookingCharges } from '../components/BookingCharges';
import { latestBookingLocation } from '../lib/bookingLocation';
import { openGoogleMaps } from '../lib/externalMaps';

async function journeyLocation() {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([currentLocation(), new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error('Could not get your GPS location. Check location services and try again.')), 20000);
    })]);
  } finally { if (deadline) clearTimeout(deadline); }
}

export function BookingDetail({ initial, userId, onReviewSubmitted }: { initial: Booking; userId: string; onReviewSubmitted?: () => void }) {
  const { styles, colors } = useTheme();
  const result = useResource(async () => {
    const { data, error } = await supabase.from('bookings').select('*').eq('id', initial.id).single();
    if (error) throw new Error(error.message);
    return data as Booking;
  }, initial.id);
  const location = useResource(() => api.tracking(initial.id), initial.id);
  const refund = useResource(async () => {
    const { data, error } = await supabase.from('refund_requests').select('status').eq('booking_id', initial.id).maybeSingle();
    if (error) throw error; return data as { status: string } | null;
  }, `${initial.id}-${result.data?.status}-${result.data?.paid_at}`);
  const booking = result.data || initial;
  const hourly=isHourly(booking);
  const messagingEnabled = bookingChatOpen(booking);
  const conversation = useResource(() => messagingEnabled ? api.messages(initial.id) : Promise.resolve([]), `${initial.id}-${messagingEnabled}`);
  const participants = useResource(() => api.bookingParticipants(booking.id), booking.id);
  useForegroundRefresh(result.refresh);
  useForegroundRefresh(location.refresh, 2000);
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [paymentPhoneReady, setPaymentPhoneReady] = useState(false);
  const [route, setRoute] = useState<Coordinate[] | null>(null); const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null); const [tab, setTab] = useState('details');
  const [guidance, setGuidance] = useState<Awaited<ReturnType<typeof drivingRoute>> | null>(null);
  const [routeError, setRouteError] = useState('');
  const [ownLocation, setOwnLocation] = useState<TrackingLocation | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [sharing, setSharing] = useState(false);
  const sharingVersion = useRef(0);
  const journeyVersion = useRef(0);
  const journeyPending = useRef(false);
  const journeyFix = useRef<Location.LocationObject | null>(null);
  useEffect(() => () => { journeyVersion.current++; journeyPending.current = false; journeyFix.current = null; }, [initial.id]);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const trackingActive = ['en_route', 'arrived'].includes(booking.status) && !booking.service_started_at;
  const isProfessional = isProfessionalApp && booking.professional_id === userId;
  const destination: Coordinate = [booking.venue_longitude, booking.venue_latitude];
  // Stale coordinates are labelled with their timestamp rather than reported as a live ETA.
  const latestLocation = latestBookingLocation(booking.id, location.data, isProfessional ? ownLocation : null);
  const point: Coordinate | null = latestLocation ? [latestLocation.longitude, latestLocation.latitude] : null;
  const fixAge = latestLocation ? Date.now() - Date.parse(latestLocation.updated_at) : Infinity;
  const fresh = fixAge >= -5000 && fixAge < 15000;
  const active = !['completed', 'cancelled', 'declined'].includes(booking.status);
  useEffect(() => { if (!messagingEnabled) { setTab('details'); setMessage(''); } }, [messagingEnabled]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 2000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const channel = supabase.channel(`booking-${initial.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${initial.id}` }, () => { void result.refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_locations', filter: `booking_id=eq.${initial.id}` }, () => { void location.refresh(); });
    if (messagingEnabled) channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${initial.id}` }, () => { void conversation.refresh(); });
    channel.subscribe(status => { if (status === 'SUBSCRIBED') { void result.refresh(); void location.refresh(); } });
    const appListener = AppState.addEventListener('change', state => {
      if (state === 'active') { void result.refresh(); void conversation.refresh(); void location.refresh(); void participants.refresh(); }
      else { sharingVersion.current++; watcher.current?.remove(); watcher.current = null; setSharing(false); }
    });
    return () => { sharingVersion.current++; void supabase.removeChannel(channel); appListener.remove(); watcher.current?.remove(); watcher.current = null; };
  }, [initial.id, result.refresh, conversation.refresh, location.refresh, messagingEnabled]);
  useEffect(() => {
    if (!trackingActive) { sharingVersion.current++; watcher.current?.remove(); watcher.current = null; setSharing(false); }
  }, [trackingActive]);
  useEffect(() => {
    if (!point || !trackingActive || !fresh) {
      setRoute(null); setEta(null); setDistance(null); setGuidance(null); setRouteError(''); return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void drivingRoute(point, destination, controller.signal).then(result => {
        if (!controller.signal.aborted) {
          if (result) { setRoute(result.coordinates); setEta(Math.ceil(result.durationSeconds / 60)); setDistance(result.distanceMeters); setGuidance(result); setRouteError(''); }
          else { setRoute(null); setEta(null); setDistance(null); setGuidance(null); setRouteError('Driving directions unavailable. Your location is still shown.'); }
        }
      }).catch(() => { if (!controller.signal.aborted) { setRoute(null); setEta(null); setDistance(null); setGuidance(null); setRouteError('Driving directions unavailable. Your location is still shown.'); } });
    }, 1200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [latestLocation?.longitude, latestLocation?.latitude, booking.venue_longitude, booking.venue_latitude, trackingActive, fresh]);
  async function change(status: Booking['status']) {
    setBusy(true); setError('');
    try { await api.transitionBooking(booking.id, status); await result.refresh(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function send() {
    if (!messagingEnabled || !message.trim()) return;
    setBusy(true); setError('');
    try { await api.sendMessage(booking.id, userId, message); setMessage(''); await conversation.refresh(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function pay() {
    setBusy(true); setError('');
    try {
      await openPayment(booking.id, () => { setBusy(false); void result.refresh(); }, message => { setBusy(false); setError(message); });
    } catch (e) { setError(errorText(e)); setBusy(false); }
  }
  async function publishLocation(value: Location.LocationObject, version: number) {
    if (version !== sharingVersion.current) return;
    const heading = value.coords.heading !== null && value.coords.heading >= 0 ? value.coords.heading : null;
    const { error } = await supabase.rpc('share_booking_location', { p_booking_id: booking.id,
      p_longitude: value.coords.longitude, p_latitude: value.coords.latitude, p_heading: heading });
    if (error) throw new Error(error.message);
    if (version === sharingVersion.current) { setOwnLocation({ booking_id: booking.id, longitude: value.coords.longitude,
      latitude: value.coords.latitude, heading, updated_at: new Date().toISOString() }); setClock(Date.now()); setSharing(true); }
  }
  async function watchJourney(version: number) {
    const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 }, value => {
      void publishLocation(value, version).catch(() => {
        if (version !== sharingVersion.current) return;
        sharingVersion.current++; watcher.current?.remove(); watcher.current = null; setSharing(false);
        setError('Location sharing interrupted. Reconnecting automatically while this booking is open.');
      });
    });
    if (version !== sharingVersion.current) { subscription.remove(); return; }
    watcher.current = subscription;
  }
  async function startJourney() {
    if (busy || journeyPending.current) return;
    const version = ++journeyVersion.current;
    journeyPending.current = true;
    setBusy(true); setError('');
    try {
      // Permission dialogs can change AppState. Only leaving this booking cancels
      // the action; pausing its location watcher must not cancel the transition.
      const value = await journeyLocation();
      if (version !== journeyVersion.current) return;
      await api.transitionBooking(booking.id, 'en_route');
      if (version !== journeyVersion.current) return;
      journeyFix.current = value;
      // Share the fix already acquired for Start journey. Do not wait for a
      // second native GPS request before the customer receives their first pin.
      try { await publishLocation(value, ++sharingVersion.current); }
      finally { await result.refresh(); await location.refresh(); }
      if (version !== journeyVersion.current) return;
      // The active-journey effect starts sharing and reconnects on re-entry.
      setTab('details');
    } catch (e) { if (version === journeyVersion.current) setError(errorText(e)); }
    finally {
      if (version === journeyVersion.current) { journeyPending.current = false; setBusy(false); }
    }
  }
  useEffect(() => {
    if (!isProfessional || !trackingActive) return;
    let active = true; let connecting = false;
    async function connect() {
      if (!active || connecting || watcher.current || AppState.currentState !== 'active') return;
      connecting = true;
      const version = ++sharingVersion.current;
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) throw new Error('Enable location permission in your device settings to share this journey.');
        // Subscribe first: a slow one-shot GPS request must not prevent movement
        // fixes from reaching the booking, even when discovery GPS is working.
        await watchJourney(version);
        const cached = journeyFix.current;
        const value = cached && Date.now() - cached.timestamp < 30000 ? cached : await journeyLocation();
        if (!active || version !== sharingVersion.current) return;
        await publishLocation(value, version);
      } catch (e) { if (active && version === sharingVersion.current) setError(errorText(e)); }
      finally { connecting = false; }
    }
    void connect();
    const timer = setInterval(() => { void connect(); }, 15000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void connect(); });
    return () => { active = false; clearInterval(timer); listener.remove(); sharingVersion.current++; watcher.current?.remove(); watcher.current = null; setSharing(false); };
  }, [booking.id, isProfessional, trackingActive]);
  const otherName = (isProfessional ? participants.data?.client_name : participants.data?.professional_name) || (isProfessional ? 'Customer' : 'Professional');
  const otherRole = isProfessional ? 'Customer' : participants.data?.category ? categoryLabels[participants.data.category] : 'Professional';
  const stage = ['requested', 'accepted', 'en_route', 'arrived', 'completed'].indexOf(booking.status);
  const journeyTitle = booking.status === 'arrived' && booking.service_started_at ? booking.completion_requested_at ? 'Confirm your completed service.' : 'Your service is in progress.' : booking.status === 'requested' ? 'Waiting for acceptance.' : booking.status === 'accepted' ? isProfessional ? (booking.paid_at||hourly) ? 'Ready to start your journey.' : 'Waiting for booking confirmation.' : (booking.paid_at||hourly) ? 'Your professional accepted.' : 'Accepted. Pay before your service.' : booking.status === 'en_route' ? isProfessional ? 'Navigate to your client.' : 'Your professional is on the way.' : booking.status === 'arrived' ? isProfessional ? 'You have arrived.' : 'Your professional has arrived.' : booking.status === 'completed' ? 'A collaboration, complete.' : `Booking ${statusLabels[booking.status].toLowerCase()}.`;
  const mapStatus = !trackingActive ? 'Service location' : point ? fresh ? 'Location recently updated' : 'Last known location · update delayed' : 'Awaiting shared location';
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={result.loading} onRefresh={() => { void result.refresh(); void conversation.refresh(); void location.refresh(); void participants.refresh(); }} />}>
    <Text style={styles.eyebrow}>BOOKING #{booking.id.slice(0, 8)}</Text><Text style={styles.title}>{journeyTitle}</Text>
    <Card><Text style={styles.eyebrow}>{otherRole}</Text><Text style={styles.heading}>{otherName}</Text>{Boolean(participants.error) && <Text style={styles.muted}>Name unavailable. Pull to refresh.</Text>}</Card>
    {messagingEnabled && <Segmented options={[{ id: 'details', label: 'Booking & tracking' }, { id: 'messages', label: `Messages${conversation.data?.length ? ` (${conversation.data.length})` : ''}` }]} value={tab} onChange={setTab} />}
    <Notice message={error || result.error || location.error} />
    {(tab === 'details' || !messagingEnabled) && <>
    {!isProfessional && booking.status === 'completed' && (!hourly||Boolean(booking.paid_at)) && <BookingReviewCard bookingId={booking.id} onSubmitted={onReviewSubmitted} />}
    {isProfessional && booking.status === 'en_route' && fresh && guidance?.instruction && <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center', backgroundColor: colors.action, padding: 22, borderRadius: 20 }}>
      <Text accessibilityElementsHidden style={{ color: '#fff', fontSize: 36 }}>{guidance.modifier?.includes('left') ? '↰' : guidance.modifier?.includes('right') ? '↱' : guidance.modifier?.includes('uturn') ? '↶' : '↑'}</Text>
      <View style={{ flex: 1, gap: 5 }}><Text style={{ color: '#fff', fontWeight: '600', fontSize: 19 }}>{guidance.instruction}</Text><Text style={{ color: '#fff', fontSize: 12 }}>{guidance.stepDistanceMeters != null ? guidance.stepDistanceMeters >= 1000 ? `${(guidance.stepDistanceMeters / 1000).toFixed(1)} km on this road` : `${Math.round(guidance.stepDistanceMeters)} m on this road` : 'Follow the highlighted route'}</Text><Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{eta} min · {distance !== null ? `${(distance / 1000).toFixed(1)} km remaining` : ''}</Text></View>
    </View>}
    {active && <TalentMap trackingCategory={participants.data?.category} centerIsLocation={!trackingActive || !point} center={trackingActive && point ? point : destination} destination={trackingActive && point ? destination : undefined} tracking={trackingActive && Boolean(point)} heading={latestLocation?.heading} route={route} height={trackingActive ? 560 : 400} label={trackingActive ? 'Your journey · 3D navigation' : 'Your service location'} status={mapStatus} distanceLabel={distance !== null && fresh ? distance >= 1000 ? `${(distance / 1000).toFixed(1)} km remaining` : `${Math.round(distance)} m remaining` : undefined} />}
    {isProfessional && trackingActive && <Button title="Open in Google Maps" icon="pin" secondary onPress={() => { void openGoogleMaps(destination).catch(e => setError(errorText(e))); }} />}
    {trackingActive && <Card><View style={styles.between}><View style={{ flex: 1 }}><Text style={styles.heading}>{booking.status === 'arrived' ? 'Arrived at your venue' : eta !== null && fresh ? `${eta} min estimated drive` : point ? fresh ? routeError ? 'Route unavailable' : 'Finding your route…' : 'Waiting for a fresh update' : 'Location not shared yet'}</Text><Text style={styles.muted}>{distance !== null && fresh ? `${(distance / 1000).toFixed(1)} km remaining · ` : ''}{point ? `Last update ${new Date(latestLocation!.updated_at).toLocaleTimeString()}` : 'Location appears when the professional starts their journey.'}</Text></View><Icon name="pin" color={colors.accent} /></View><Text style={styles.text}>{booking.venue}</Text>{Boolean(routeError) && <Text style={styles.muted}>{routeError}</Text>}</Card>}
    {stage >= 0 && <View style={{ flexDirection: 'row', gap: 5 }}>{['Request', 'Accepted', 'Journey', 'Arrived', 'Done'].map((label, index) => <View key={label} style={{ flex: 1, gap: 7 }}><View style={{ height: 3, borderRadius: 2, backgroundColor: index <= stage ? colors.accent : colors.line }} /><Text style={{ fontSize: 10, color: index <= stage ? colors.accent : colors.muted }}>{label}</Text></View>)}</View>}
    <Card><View style={styles.between}><Text style={styles.heading}>{booking.service_name}</Text><Text style={{ color: colors.accent, fontSize: 11 }}>{statusLabels[booking.status]}</Text></View>
      <BookingCharges booking={booking} professional={isProfessional} now={clock} detailed/>{!isProfessional&&!hourly&&<Text style={styles.muted}>{booking.paid_at?'Paid':'Pay after acceptance, before service'}</Text>}
      {!isProfessional && refund.data && <Text style={styles.muted}>Refund: {refund.data.status}</Text>}

      <Text style={styles.muted}>{new Date(booking.starts_at).toLocaleString()} · {booking.venue}</Text><Text style={styles.text}>{booking.notes}</Text></Card>
    {isProfessional && booking.status === 'requested' && <><Button title="Accept request" onPress={() => change('accepted')} busy={busy} /><Button title="Decline request" secondary onPress={() => change('declined')} busy={busy} /></>}
    {!isProfessional && canPayBooking(booking) && <><PhoneVerificationCard onVerified={setPaymentPhoneReady} /><Button title="Pay with Cashfree" onPress={pay} busy={busy} disabled={!paymentPhoneReady} /></>}
    {isProfessional && booking.status === 'accepted' && (Boolean(booking.paid_at)||hourly) && <Button title="Start journey" icon="arrow" onPress={startJourney} busy={busy} />}

    {sharing && <Text style={styles.muted}>Sharing your journey location. With background sharing enabled and availability on, updates continue when you leave this screen or lock your phone.</Text>}
    {isProfessional && booking.status === 'en_route' && <Button title="I have arrived" onPress={() => change('arrived')} busy={busy} />}
    {booking.status === 'arrived' && (Boolean(booking.paid_at)||hourly) && <ServiceVerification booking={booking} professional={isProfessional} onChange={result.refresh} />}
    {['requested', 'accepted'].includes(booking.status) && <Button title="Cancel booking" secondary onPress={() => change('cancelled')} busy={busy} />}
    {messagingEnabled && <Button title={`Message ${otherName}`} icon="chat" secondary onPress={() => setTab('messages')} />}
    </>}
    {tab === 'messages' && messagingEnabled && <><Text style={styles.heading}>Conversation with {otherName}</Text><Notice message={conversation.error} />
    {conversation.loading && <ActivityIndicator color={colors.accent} />}
    {!conversation.loading && !conversation.error && !conversation.data?.length && <Text style={styles.muted}>Start with a hello. Share project details here.</Text>}
    {conversation.data?.map(item => <View key={item.id} style={[styles.card, { maxWidth: '86%', alignSelf: item.sender_id === userId ? 'flex-end' : 'flex-start', backgroundColor: item.sender_id === userId ? colors.selected : colors.panel }]}><Text style={[styles.muted, { fontSize: 10 }]}>{item.sender_id === userId ? 'You' : otherName} · {new Date(item.created_at).toLocaleTimeString()}</Text><Text style={styles.text}>{item.body}</Text></View>)}
    <Field label="Message" value={message} onChange={setMessage} multiline placeholder="Type your message…" maxLength={1000} /><Button title="Send message" icon="arrow" onPress={send} busy={busy} disabled={!message.trim()} />
    </>}
  </ScrollView>;
}
