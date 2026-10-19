import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';
import { sessionStorage } from './sessionStorage';
import { isProfessionalApp } from '../appVariant';
import { errorText } from '../domain';

export const PROFESSIONAL_LOCATION_TASK = 'cc-circle-available-professional-location-v1';
const preferenceKey = 'professional-location-service-v1';
type Preference = { userId: string; enabled: boolean; backgroundConsent: boolean };
export type LiveLocationState = { fix: Location.LocationObject | null; error: string; background: boolean; sharing: boolean };
let state: LiveLocationState = { fix: null, error: '', background: false, sharing: false };
const listeners = new Set<(state: LiveLocationState) => void>();
let watcher: Location.LocationSubscription | null = null;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let activeUser: string | null = null;
let generation = 0;
let operations = Promise.resolve();
let publication = Promise.resolve();
let lastTimestamp = 0;
let lastPublished = 0;
let requestingBackground = false;
function update(value: Partial<LiveLocationState>) { state = { ...state, ...value }; listeners.forEach(listener => listener(state)); }
export function observeProfessionalLocation(listener: (state: LiveLocationState) => void) {
  listeners.add(listener); listener(state); return () => { listeners.delete(listener); };
}
async function preference(): Promise<Preference | null> {
  const value = await sessionStorage.getItem(preferenceKey);
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}
export async function backgroundLocationConsented(userId: string) {
  const saved = await preference(); return saved?.userId === userId && saved.backgroundConsent;
}
async function clearPin(expectedUser?: string) {
  const { data } = await supabase.auth.getSession();
  if (!data.session || (expectedUser && data.session.user.id !== expectedUser)) return;
  const { error } = await supabase.rpc('clear_professional_location');
  if (error) throw error;
}
// Serialise writes so an old GPS response cannot replace a newer fix or the offline clear.
export function publishProfessionalFix(fix: Location.LocationObject, expectedUser?: string) {
  const run = generation;
  const work = publication.catch(() => {}).then(async () => {
    if (run !== generation) return;
    const saved = await preference();
    if (!saved?.enabled || (expectedUser && saved.userId !== expectedUser)) return;
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== saved.userId) return;
    const age = Date.now() - fix.timestamp;
    if (age > 60000 || age < -5000 || fix.timestamp < lastTimestamp) return;
    if (Date.now() - lastPublished < 2000) return;
    // Offline/unpublished professionals are also rejected by the authenticated RPC.
    const { error } = await supabase.rpc('publish_professional_location_fix', {
      p_longitude: fix.coords.longitude, p_latitude: fix.coords.latitude, p_accuracy: fix.coords.accuracy,
    });
    if (error) {
      if (error.message.includes('Go online with a published') || error.message.includes('session was replaced')) void stopProfessionalLocation(saved.userId).catch(() => {});
      throw error;
    }
    // The OS invokes this task without a booking screen mounted. Discovery and
    // booking tracking are different records; both need the real GPS fix.
    const { data: journeys, error: journeyError } = await supabase.from('bookings')
      .select('id').eq('professional_id', saved.userId).in('status', ['en_route', 'arrived'])
      .is('service_started_at', null).limit(1);
    if (journeyError) throw journeyError;
    for (const journey of journeys || []) {
      if (run !== generation) return;
      const { data: auth } = await supabase.auth.getSession();
      if (auth.session?.user.id !== saved.userId) return;
      const { error: shareError } = await supabase.rpc('share_booking_location', {
        p_booking_id: journey.id, p_longitude: fix.coords.longitude, p_latitude: fix.coords.latitude,
        p_heading: fix.coords.heading != null && fix.coords.heading >= 0 ? fix.coords.heading : null,
      });
      // Service start/end can race the lookup. The server denies late updates;
      // keep discovery GPS running while the next fix rechecks eligibility.
      if (shareError && !shareError.message.includes('Location sharing requires an active journey')) throw shareError;
    }
    if (run !== generation) return;
    lastTimestamp = fix.timestamp; lastPublished = Date.now();
    update({ fix, sharing: true, error: '' });
  });
  publication = work;
  return work;
}
async function haltDeviceUpdates() {
  watcher?.remove(); watcher = null;
  if (heartbeat) clearInterval(heartbeat); heartbeat = undefined;
  if (Platform.OS !== 'web' && await Location.hasStartedLocationUpdatesAsync(PROFESSIONAL_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(PROFESSIONAL_LOCATION_TASK);
  }
  activeUser = null; lastTimestamp = 0; lastPublished = 0;
  update({ background: false, sharing: false });
}
// Called immediately on availability off, pause, or sign-out. Navigation does not stop it.
export function stopProfessionalLocation(userId?: string) {
  generation++;
  const work = operations.catch(() => {}).then(async () => {
    const saved = await preference();
    if (userId && saved && saved.userId !== userId) return;
    if (saved) await sessionStorage.setItem(preferenceKey, JSON.stringify({ ...saved, enabled: false }));
    await haltDeviceUpdates();
    await publication.catch(() => {});
    update({ fix: null, error: '' });
    await clearPin(saved?.userId || userId);
  });
  operations = work; return work;
}
export function startProfessionalLocation(userId: string, requestBackground = false) {
  if (requestingBackground && !requestBackground) return operations;
  if (requestBackground) requestingBackground = true;
  const run = ++generation;
  const work = operations.catch(() => {}).then(async () => {
    if (run !== generation) return;
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== userId) return;
    if (!requestBackground && await sessionStorage.getItem(`live-location-${userId}`) === 'off') {
      throw new Error('You previously paused location sharing. Use the location button to enable it again.');
    }
    let foreground = await Location.getForegroundPermissionsAsync();
    if (!foreground.granted && AppState.currentState === 'active') foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) throw new Error('Allow location access to appear on the customer map.');
    if (requestBackground) await sessionStorage.setItem(`live-location-${userId}`, 'on');
    const saved = await preference();
    let backgroundConsent = saved?.userId === userId && saved.backgroundConsent;
    let background = false;
    if (Platform.OS !== 'web') {
      let permission = await Location.getBackgroundPermissionsAsync();
      // Only the explicit disclosure button opens Android's Always allow settings.
      if (requestBackground && AppState.currentState === 'active') {
        permission = await Location.requestBackgroundPermissionsAsync();
        backgroundConsent = permission.granted;
      }
      background = Boolean(backgroundConsent && permission.granted);
    }
    if (run !== generation) return;
    await sessionStorage.setItem(preferenceKey, JSON.stringify({ userId, enabled: true, backgroundConsent }));
    if (activeUser === userId && state.background === background &&
        (watcher || (background && await Location.hasStartedLocationUpdatesAsync(PROFESSIONAL_LOCATION_TASK)))) return;
    await haltDeviceUpdates();
    if (run !== generation) return;
    activeUser = userId;
    update({ error: '', background });
    if (background) {
      if (AppState.currentState !== 'active') throw new Error('Open the app to restart live location sharing.');
      await Location.startLocationUpdatesAsync(PROFESSIONAL_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 0,
        pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true,
        ...(Platform.OS === 'android' ? { foregroundService: { notificationTitle: 'Circle · You are online',
          notificationBody: 'Sharing your live location. Go offline in Circle to stop.',
          notificationColor: '#000000', killServiceOnDestroy: false } } : {}),
        ...(Platform.OS === 'ios' ? { activityType: Location.ActivityType.AutomotiveNavigation, deferredUpdatesDistance: 0, deferredUpdatesInterval: 0 } : {}),
      });
    } else {
      watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
        fix => { void publishProfessionalFix(fix, userId).catch(error => update({ error: errorText(error) })); },
        reason => update({ error: reason, sharing: false }));
      // Keep stationary pins fresh too. Browser tabs may throttle this timer.
      heartbeat = setInterval(() => {
        if (Platform.OS !== 'web' && AppState.currentState !== 'active') return;
        void freshFix(userId);
      }, 25000);
    }
    if (run !== generation) { await haltDeviceUpdates(); return; }
    void freshFix(userId);
    if (requestBackground && Platform.OS !== 'web' && !background) {
      update({ error: Platform.OS === 'ios'
        ? 'Background access was not granted. In iPhone Settings → Circle → Location, choose Always and enable Precise Location. Sharing currently works while Circle is open.'
        : 'Background access was not granted. Sharing works while this app is open. Enable Allow all the time in location settings to share in the background.' });
    }
  });
  operations = work.finally(() => { if (requestBackground) requestingBackground = false; });
  return operations.catch(error => { update({ error: errorText(error), sharing: false, background: false }); throw error; });
}
async function freshFix(userId: string) {
  try {
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High,
      ...(Platform.OS === 'web' ? { maximumAge: 0, timeout: 15000 } : {}) });
    if (activeUser === userId) await publishProfessionalFix(fix, userId);
  } catch (error) { if (activeUser === userId) update({ error: errorText(error) }); }
}
// Defined during entry-point evaluation: the OS can invoke this without mounting React.
if (Platform.OS !== 'web' && isProfessionalApp && !TaskManager.isTaskDefined(PROFESSIONAL_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(PROFESSIONAL_LOCATION_TASK, async ({ data, error }) => {
    if (error) { update({ error: error.message, sharing: false }); return; }
    const saved = await preference();
    if (!saved?.enabled || !saved.backgroundConsent) { await haltDeviceUpdates(); return; }
    const { data: auth } = await supabase.auth.getSession();
    if (auth.session?.user.id !== saved.userId) { await stopProfessionalLocation(saved.userId).catch(() => {}); return; }
    const latest = data?.locations?.reduce<Location.LocationObject | null>((newest, fix) => !newest || fix.timestamp > newest.timestamp ? fix : newest, null);
    if (latest) await publishProfessionalFix(latest, saved.userId).catch(error => update({ error: errorText(error) }));
  });
}
