import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { appVariant } from '../appVariant';
import { sessionStorage } from './sessionStorage';
import { supabase } from './supabase';

export type CircleNotification = {
  id: string; title: string; body: string; kind: string; created_at: string; read_at: string | null;
  booking_id: string | null; event_id: string | null;
};
export type NotificationTarget = Pick<CircleNotification, 'id' | 'booking_id' | 'event_id' | 'kind'>;
export type NotificationSettings = { push_enabled: boolean; messages_enabled: boolean; events_enabled: boolean };
export const pushConfigured = Platform.OS === 'android' ? Constants.expoConfig?.extra?.androidPushConfigured === true
  : Platform.OS === 'ios' && Constants.expoConfig?.extra?.iosPushConfigured === true;
const storageKey = `circle-notification-installation-${appVariant}`;
let installationPromise: Promise<string> | undefined;
async function installationId() {
  return installationPromise ||= (async () => {
    const saved = await sessionStorage.getItem(storageKey); if (saved) return saved;
    const id = Crypto.randomUUID(); await sessionStorage.setItem(storageKey, id); return id;
  })().catch(error => { installationPromise = undefined; throw error; });
}
export async function saveNotificationToken(token: string, userId: string) {
  const id = await installationId();
  let environment: 'development' | 'production' | null = null;
  if (Platform.OS === 'ios') {
    const application = await import('expo-application');
    environment = await application.getIosPushNotificationServiceEnvironmentAsync();
    if (!environment) throw new Error('Notifications need an Apple-signed build with push enabled.');
  }
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== userId) return;
  const { error } = await supabase.rpc(Platform.OS === 'ios' ? 'register_ios_notification_device' : 'register_notification_device', {
    p_variant: appVariant, p_installation_id: id, p_token: token,
    ...(Platform.OS === 'ios' ? { p_environment: environment === 'development' ? 'sandbox' : 'production' } : {}),
  });
  if (error) throw new Error('Unable to enable device notifications. Please try again.');
}
export async function unregisterNotifications() {
  if (Platform.OS === 'web') return;
  const id = await sessionStorage.getItem(storageKey); if (!id) return;
  const { error } = await supabase.rpc('unregister_notification_device', { p_variant: appVariant, p_installation_id: id });
  if (error) throw error;
}
export async function notificationSettings(settings?: Partial<NotificationSettings>) {
  const { data, error } = await supabase.rpc('notification_settings', { p_variant: appVariant, p_settings: settings || null });
  if (error) throw new Error(error.message);
  return data as NotificationSettings;
}
export async function notificationInbox(userId: string) {
  const [rows, total] = await Promise.all([
    supabase.from('app_notifications').select('id,title,body,kind,created_at,read_at,booking_id,event_id').eq('user_id', userId).eq('app_variant', appVariant).order('created_at', { ascending: false }).limit(100),
    supabase.from('app_notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('app_variant', appVariant).is('read_at', null),
  ]);
  if (rows.error || total.error) throw new Error('Unable to load notifications. Please try again.');
  return { rows: rows.data as CircleNotification[], unread: total.count || 0 };
}
export async function readNotifications(id?: string) {
  const { error } = await supabase.rpc('read_notifications', { p_variant: appVariant, p_id: id || null });
  if (error) throw new Error(error.message);
}
export async function resolveNotification(id: unknown, userId: string) {
  if (typeof id !== 'string' || !/^[\da-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase.from('app_notifications').select('id,booking_id,event_id,kind').eq('id', id).eq('user_id', userId).eq('app_variant', appVariant).maybeSingle();
  if (error) throw new Error('Unable to open this notification.');
  return data as NotificationTarget | null;
}
