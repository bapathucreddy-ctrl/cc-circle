import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Modal, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notificationSettings, pushConfigured, readNotifications, resolveNotification, saveNotificationToken, unregisterNotifications, type NotificationSettings, type NotificationTarget } from '../lib/notifications';
import { Button, Icon, IconButton, Notice, useTheme } from '../ui';

type NativeNotifications = typeof import('expo-notifications');
const InboxContext = createContext({ open: () => {} });
export function NotificationBell() {
  const { open } = useContext(InboxContext); const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={open} style={{ minWidth: 44, minHeight: 44, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, justifyContent: 'center', alignItems: 'center' }}>
    <Icon name="bell" />
  </Pressable>;
}
export function NotificationCenter({ userId, children, onNavigate }: { userId: string; children: ReactNode; onNavigate: (target: NotificationTarget) => void }) {
  const { colors, styles } = useTheme();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(); const [error, setError] = useState(''); const [loadError, setLoadError] = useState(''); const [busy, setBusy] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState('');
  const alive = useRef(true); const navigate = useRef(onNavigate); navigate.current = onNavigate;
  const refresh = useCallback(async () => {
    if (AppState.currentState !== 'active') return;
    try { const value = await notificationSettings(); if (alive.current) { setSettings(value); setLoadError(''); } }
    catch (cause) { if (alive.current) setLoadError(cause instanceof Error ? cause.message : 'Unable to load notification settings.'); }
  }, [userId]);
  const openTarget = useCallback(async (id: unknown) => {
    try {
      const target = await resolveNotification(id, userId);
      if (!alive.current) return;
      if (!target) { setOpen(true); setError('This notification has expired or the conversation has closed.'); return; }
      await readNotifications(target.id); if (!alive.current) return;
      setOpen(false); navigate.current(target); void refresh();
    } catch (cause) { if (alive.current) { setOpen(true); setError(cause instanceof Error ? cause.message : 'Unable to open notification.'); } }
  }, [userId, refresh]);
  useEffect(() => {
    alive.current = true; void refresh();
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { alive.current = false; foreground.remove(); };
  }, [userId, refresh]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true; const subscriptions: { remove: () => void }[] = [];
    void (async () => {
      // Lazy native import keeps web and previously installed native runtimes safe.
      const notifications: NativeNotifications = await import('expo-notifications');
      if (!active) return;
      notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
      if (Platform.OS === 'android') await notifications.setNotificationChannelAsync('circle-activity', { name: 'Bookings and messages', importance: notifications.AndroidImportance.HIGH });
      if (!active) return;
      subscriptions.push(notifications.addNotificationResponseReceivedListener(response => { void openTarget(response.notification.request.content.data?.notification_id); }));
      const last = await notifications.getLastNotificationResponseAsync();
      if (last && active) { await notifications.clearLastNotificationResponseAsync(); void openTarget(last.notification.request.content.data?.notification_id); }
      if (pushConfigured && (await notifications.getPermissionsAsync()).granted && active) {
        const token = await notifications.getDevicePushTokenAsync();
        if (active && token.type === Platform.OS) await saveNotificationToken(token.data, userId);
      }
      if (active && pushConfigured) subscriptions.push(notifications.addPushTokenListener(token => { if (active && token.type === Platform.OS) void saveNotificationToken(token.data, userId).catch(() => {}); }));
    })().catch(() => { if (active) setDeviceStatus('Phone notifications are currently unavailable. Try again in phone settings.'); });
    return () => { active = false; subscriptions.forEach(subscription => subscription.remove()); };
  }, [userId, refresh, openTarget]);
  async function enableDevice() {
    setBusy(true); setError('');
    try {
      if (!pushConfigured) throw new Error(Platform.OS === 'web' ? 'Phone notifications require the Android or iPhone app.' : 'Phone notifications are not available in this version yet. Try again after updating Circle.');
      const notifications = await import('expo-notifications');
      const permission = await notifications.requestPermissionsAsync();
      if (!permission.granted) throw new Error('Allow notifications in your phone settings to receive booking updates when Circle is closed.');
      const token = await notifications.getDevicePushTokenAsync();
      if (token.type !== Platform.OS) throw new Error('Unable to register this phone for notifications.');
      await saveNotificationToken(token.data, userId);
      const value = await notificationSettings({ push_enabled: true });
      if (alive.current) { setSettings(value); setDeviceStatus('Notifications enabled on this phone.'); }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Unable to enable notifications.'); }
    finally { if (alive.current) setBusy(false); }
  }
  async function changeSetting(key: keyof NotificationSettings, value: boolean) {
    setBusy(true); setError('');
    try { const updated = await notificationSettings({ [key]: value }); if (key === 'push_enabled' && !value) await unregisterNotifications(); if (alive.current) setSettings(updated); }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Unable to save notification settings.'); }
    finally { if (alive.current) setBusy(false); }
  }
  return <InboxContext.Provider value={{ open: () => { setError(''); setOpen(true); void refresh(); } }}>{children}
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.page}>
        <View style={[styles.between, { padding: 20 }]}><Text style={styles.heading}>Notifications</Text><IconButton name="close" label="Close notifications" onPress={() => setOpen(false)} /></View>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: 0 }]}>
          <Notice message={error || loadError} />
          <View style={styles.card}><Button title="Enable phone notifications" disabled={busy} onPress={() => { void enableDevice(); }} />{Boolean(deviceStatus) && <Text style={styles.muted}>{deviceStatus}</Text>}
            {settings && (['push_enabled', 'messages_enabled', 'events_enabled'] as const).map(key => <View key={key} style={styles.between}><Text style={styles.text}>{({ push_enabled: 'Phone notifications', messages_enabled: 'Booking messages', events_enabled: 'Event opportunities & applications' })[key]}</Text><Switch accessibilityLabel={key} value={settings[key]} disabled={busy} onValueChange={value => { if (key === 'push_enabled' && value) void enableDevice(); else void changeSetting(key, value); }} trackColor={{ false: colors.line, true: colors.text }} thumbColor={colors.panel} /></View>)}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </InboxContext.Provider>;
}
