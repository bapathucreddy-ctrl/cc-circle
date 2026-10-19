import { ServiceLoader as ActivityIndicator } from './src/components/ServiceLoader';
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, StatusBar, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { backendConfigured, supabase } from './src/lib/supabase';
import { bengaluru, type Booking, type Coordinate, type Professional, type Service } from './src/domain';
import { Brand, Button, Icon, IconButton, Notice, ThemeProvider, ThemeToggle, useTheme } from './src/ui';
import { Auth } from './src/screens/Auth';
import { BookingForm, Bookings, Comparison, Discover, Home, Profile } from './src/screens/Marketplace';
import { ProfessionalReviewsScreen } from './src/components/ProfessionalReviews';
import { seasonalHomeColor } from './src/components/OccasionBanners';
import { CraftServices } from './src/screens/CraftServices';
import { BookingDetail } from './src/screens/BookingDetail';
import { Account } from './src/screens/Account';
import { TeamRequests } from './src/screens/TeamRequests';
import { isProfessionalApp } from './src/appVariant';
import { ProfessionalWorkspace } from './src/ProfessionalWorkspace';
import { completeGoogleSignIn, restoreGoogleSignIn } from './src/lib/googleAuth';
import { LaunchSplash } from './src/components/LaunchSplash';
import * as SplashScreen from 'expo-splash-screen';
import { CustomerActivityDock } from './src/components/CustomerActivityDock';
import { RegistrationGate } from './src/components/RegistrationGate';
import { scopeResourceCache } from './src/lib/resourceCache';
import { stopProfessionalLocation } from './src/lib/professionalLocation';
import { useInitialDeviceLocation } from './src/useInitialDeviceLocation';
import { NotificationBell, NotificationCenter } from './src/components/NotificationCenter';
import type { NotificationTarget } from './src/lib/notifications';
import { SessionGate } from './src/components/SessionGate';
import { appSessionId, expireAppSession } from './src/lib/appSessions';

void SplashScreen.preventAutoHideAsync().catch(() => {});

type Route = { screen: 'home' | 'bookings' | 'account' | 'saved' | 'compare' | 'request' }
  | { screen: 'discover'; category?: Professional['category']; now?: boolean; query?: string; serviceKey?: string }
  | { screen: 'reviews'; professionalId: string }
  | { screen: 'craft-services'; category: Professional['category']; now?: boolean }
  | { screen: 'profile'; person: Professional; serviceKey?: string } | { screen: 'booking'; service: Service; person: Professional } | { screen: 'detail'; booking: Booking };
function Marketplace({ userId, notificationTarget, onHomeChange }: { userId: string; notificationTarget?: NotificationTarget; onHomeChange: (active: boolean) => void }) {
  const [activityVersion, setActivityVersion] = useState(0);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<string[]>([]);
  const { styles, colors } = useTheme();
  const [routes, setRoutes] = useState<Route[]>([{ screen: 'home' }]);
  const { center, label: locationLabel, error: locationError, changeLocation } = useInitialDeviceLocation();
  const setCenter = (point: Coordinate) => changeLocation(point, `${point[1].toFixed(5)}, ${point[0].toFixed(5)}`);
  const [shortlist, setShortlist] = useState<Professional[]>([]); const [error, setError] = useState('');
  const route = routes[routes.length - 1]!;
  useEffect(() => { onHomeChange(route.screen === 'home'); return () => onHomeChange(false); }, [route.screen, onHomeChange]);
  const navigate = (next: Route) => { setError(''); setRoutes(previous => [...previous, next]); };
  const reset = (next: Route) => { setError(''); setRoutes([next]); };
  useEffect(() => {
    if (!notificationTarget) return;
    let active = true;
    if (notificationTarget.booking_id) {
      void supabase.from('bookings').select('*').eq('id', notificationTarget.booking_id).eq('client_id', userId).maybeSingle().then(({ data, error }) => {
        if (!active) return;
        if (error || !data) setError('This booking is no longer available.'); else navigate({ screen: 'detail', booking: data as Booking });
      });
    } else if (notificationTarget.event_id) reset({ screen: 'request' });
    else if (notificationTarget.kind === 'portfolio') reset({ screen: 'account' });
    return () => { active = false; };
  }, [notificationTarget, userId]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (routes.length <= 1) return false;
      setRoutes(previous => previous.slice(0, -1)); return true;
    });
    return () => subscription.remove();
  }, [routes.length]);
  function compare(person: Professional) {
    setError('');
    if (shortlist.some(p => p.id === person.id)) { setShortlist(previous => previous.filter(p => p.id !== person.id)); return; }
    if (shortlist.length >= 3) { setError('Compare up to three professionals.'); return; }
    if (shortlist.length && shortlist[0]!.category !== person.category) { setError('Select professionals in the same service category.'); return; }
    setShortlist(previous => [...previous, person]);
  }
  let screen: ReactNode;
  switch (route.screen) {
    case 'home': screen = <Home center={center} setCenter={setCenter} locationLabel={locationLabel} onLocationChange={changeLocation} onDiscover={(category, now, query, serviceKey) => category && !query && !serviceKey ? navigate({ screen: 'craft-services', category, now }) : navigate({ screen: 'discover', category, now, query, serviceKey })} onRequest={() => reset({ screen: 'request' })} onBooking={booking => navigate({ screen: 'detail', booking })} onBookings={() => reset({ screen: 'bookings' })} />; break;
    case 'craft-services': screen = <CraftServices category={route.category} center={center} availableNow={route.now ?? true} onChoose={serviceKey => navigate({ screen: 'discover', category: route.category, now: route.now, serviceKey })} />; break;
    case 'discover': case 'saved': screen = <Discover userId={userId} center={center} setCenter={setCenter} locationLabel={locationLabel} onLocationChange={changeLocation} shortlist={shortlist} toggleCompare={compare} onCompare={() => navigate({ screen: 'compare' })}
      initialCategory={route.screen === 'discover' ? route.category : undefined} initialNow={route.screen === 'discover' ? (route.now ?? true) : false} initialQuery={route.screen === 'discover' ? route.query : ''}
      serviceKey={route.screen === 'discover' ? route.serviceKey : undefined} savedOnly={route.screen === 'saved'} onProfile={person => navigate({ screen: 'profile', person, serviceKey: route.screen === 'discover' ? route.serviceKey : undefined })} />; break;
    case 'reviews': screen = <ProfessionalReviewsScreen professionalId={route.professionalId} />; break;
    case 'profile': screen = <Profile onReviews={() => navigate({ screen: 'reviews', professionalId: route.person.id })} preferredServiceKey={route.serviceKey} person={route.person} userId={userId} selectedForCompare={shortlist.some(p => p.id === route.person.id)} onCompare={() => compare(route.person)} onBook={service => navigate({ screen: 'booking', service, person: route.person })} />; break;
    case 'booking': screen = <BookingForm service={route.service} person={route.person} center={center} onManageProfile={() => navigate({ screen: 'account' })} onCreated={booking => reset({ screen: 'detail', booking })} />; break;
    case 'detail': screen = <BookingDetail initial={route.booking} userId={userId} onReviewSubmitted={() => { setReviewedBookingIds(previous => [...new Set([...previous, route.booking.id])]); setActivityVersion(value => value + 1); }} />; break;
    case 'bookings': screen = <Bookings onOpen={booking => navigate({ screen: 'detail', booking })} />; break;
    case 'compare': screen = <Comparison people={shortlist} onProfile={person => navigate({ screen: 'profile', person })} />; break;
    case 'request': screen = <TeamRequests userId={userId} center={center} initialEventId={notificationTarget?.event_id || undefined} onBooking={booking => navigate({ screen: 'detail', booking })} onProfile={person => navigate({ screen: 'profile', person })} />; break;
    case 'account': screen = <Account userId={userId} onJoin={() => {}} onSaved={() => navigate({ screen: 'saved' })} onBookings={() => reset({ screen: 'bookings' })} />; break;
  }
  const activeTab = ['profile', 'booking', 'compare', 'saved', 'craft-services', 'reviews'].includes(route.screen) ? 'discover' : route.screen === 'detail' ? 'bookings' : route.screen;
  return <View style={styles.page}>
    {route.screen !== 'home' && <View style={[styles.between, { paddingHorizontal: 24, paddingVertical: 12, maxWidth: 1080, width: '100%', alignSelf: 'center' }]}>
      <IconButton name="back" label="Back" onPress={() => routes.length > 1 ? setRoutes(previous => previous.slice(0, -1)) : reset({ screen: 'home' })} /><View style={styles.row}><NotificationBell /><ThemeToggle /></View>
    </View>}
    {Boolean(error) && <View style={{ paddingHorizontal: 22 }}><Notice message={error} /></View>}
    {Boolean(locationError) && <View style={{ paddingHorizontal: 22 }}><Notice message={locationError} /></View>}
    <View key={JSON.stringify(route)} style={{ flex: 1 }}>{screen}</View>
    <CustomerActivityDock userId={userId} currentBookingId={route.screen === 'detail' ? route.booking.id : undefined} refreshVersion={activityVersion} reviewedBookingIds={reviewedBookingIds} onOpen={booking => navigate({ screen: 'detail', booking })} />
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: colors.panel, borderTopWidth: 1, borderColor: colors.line, paddingVertical: 8 }}>
      {([['home', 'Home', 'home'], ['discover', 'Discover', 'search'], ['request', 'Request', 'plus'], ['bookings', 'Bookings', 'calendar'], ['account', 'Circle', 'user']] as const).map(([id, label, icon]) =>
        <Pressable key={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: activeTab === id }} onPress={() => reset({ screen: id })} style={{ flex: 1, maxWidth: 160, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 5 }}><View style={{ backgroundColor: activeTab === id ? colors.selected : 'transparent', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 }}><Icon name={icon} color={activeTab === id ? colors.accent : colors.muted} /></View><Text style={{ fontSize: 10, color: activeTab === id ? colors.accent : colors.muted, fontWeight: '500' }}>{label}</Text></Pressable>)}
    </View>
  </View>;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 20 }}><Text>Unable to open this screen.</Text><Button title="Try again" onPress={() => this.setState({ failed: false })} /></View>;
    return this.props.children;
  }
}

export default function App() { return <ThemeProvider><Application /></ThemeProvider>; }
function HomeSafeAreaColor({ active }: { active: boolean }) {
  const insets = useSafeAreaInsets();
  return active ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: seasonalHomeColor }} /> : null;
}
function Application() {
  const [homeChrome, setHomeChrome] = useState(false);
  // Native launch is an unbranded matching background; this is the single logo reveal.
  const [splashVisible, setSplashVisible] = useState(true);
  const [layoutReady, setLayoutReady] = useState(false);
  const finishSplash = useCallback(() => setSplashVisible(false), []);
  const { styles, colors, mode } = useTheme();
  const [intent, setIntent] = useState<'home' | 'join' | 'account'>('home');
  const [notificationTarget, setNotificationTarget] = useState<NotificationTarget>();
  const [session, setSession] = useState<Session | null>(null); const [loading, setLoading] = useState(backendConfigured); const [error, setError] = useState('');
  async function sessionReplaced(expectedId: string | null) {
    await expireAppSession(expectedId, () => {
      scopeResourceCache(null); setError('You signed in on another device. Please sign in again.');
      setSession(current => current && appSessionId(current.access_token) === expectedId ? null : current);
    }, isProfessionalApp ? () => stopProfessionalLocation() : undefined);
  }
  useEffect(() => { setNotificationTarget(undefined); }, [session?.user.id]);
  useEffect(() => {
    if (!backendConfigured) return;
    let active = true;
    void restoreGoogleSignIn().then(() => supabase.auth.getSession()).then(({ data, error }) => {
      if (!active) return; scopeResourceCache(data.session?.user.id || null); setSession(data.session); if (error) setError(error.message); setLoading(false);
    }).catch((error) => { if (active) { setError(error instanceof Error ? error.message : 'Unable to restore your session.'); setLoading(false); } });
    const deepLinks = Linking.addEventListener('url', ({ url }) => { void completeGoogleSignIn(url).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Unable to complete Google sign-in.'); }); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => { if (!active) return; scopeResourceCache(session?.user.id || null); if (event === 'SIGNED_OUT' && isProfessionalApp) void stopProfessionalLocation().catch(() => {}); setSession(session); setLoading(false); });
    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
    });
    return () => { active = false; data.subscription.unsubscribe(); subscription.remove(); deepLinks.remove(); supabase.auth.stopAutoRefresh(); };
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' && layoutReady) {
      SplashScreen.setOptions({ fade: false, duration: 0 });
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [layoutReady]);
  return <SafeAreaProvider><SafeAreaView style={styles.page} onLayout={() => setLayoutReady(true)}><StatusBar barStyle={homeChrome && session && !splashVisible || mode === 'dark' ? 'light-content' : 'dark-content'} />
    <AppErrorBoundary><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {!backendConfigured ? <View style={[styles.content, { flex: 1, justifyContent: 'center' }]}><Brand />
        <Text style={styles.text}>The app is awaiting its service configuration.</Text><Text style={styles.muted}>Connect the Supabase project and Mapbox token, then rebuild the development app.</Text></View>
        : loading ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>
        : session ? <SessionGate key={session.user.id + ':' + appSessionId(session.access_token)} onReplaced={() => { void sessionReplaced(appSessionId(session.access_token)); }}><NotificationCenter key={session.user.id} userId={session.user.id} onNavigate={setNotificationTarget}><RegistrationGate userId={session.user.id}>{isProfessionalApp ? <ProfessionalWorkspace userId={session.user.id} initialScreen={intent} notificationTarget={notificationTarget} /> : <Marketplace key={session.user.id} userId={session.user.id} notificationTarget={notificationTarget} onHomeChange={setHomeChrome} />}</RegistrationGate></NotificationCenter></SessionGate> : <><Notice message={error} /><Auth onIntent={setIntent} /></>}
    </KeyboardAvoidingView></AppErrorBoundary>
    {splashVisible && <LaunchSplash ready={layoutReady} onFinish={finishSplash} />}
  </SafeAreaView><HomeSafeAreaColor active={homeChrome && Boolean(session) && !splashVisible} /></SafeAreaProvider>;
}
