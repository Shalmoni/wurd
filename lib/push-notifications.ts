import { supabase } from '@/lib/supabase';

export type NotificationPreferences = { requests: boolean; friendWords: boolean };
export type PushStatus = 'unsupported' | 'prompt' | 'denied' | 'enabled';

const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(Array.from(raw, character => character.charCodeAt(0)));
}

export function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export function supportsPushNotifications() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
}

async function subscription() {
  if (!supportsPushNotifications()) return null;
  const worker = await registration();
  return worker.pushManager.getSubscription();
}

export async function readPushSettings(): Promise<{ status: PushStatus; preferences: NotificationPreferences }> {
  const defaults = { requests: true, friendWords: true };
  if (!supportsPushNotifications()) return { status: 'unsupported', preferences: defaults };
  if (Notification.permission === 'denied') return { status: 'denied', preferences: defaults };
  const current = await subscription();
  if (!current || !supabase) return { status: 'prompt', preferences: defaults };
  const result = await supabase.from('push_subscriptions').select('friend_requests, friend_words').eq('endpoint', current.endpoint).maybeSingle();
  if (result.error) throw result.error;
  return {
    status: 'enabled',
    preferences: result.data ? { requests: result.data.friend_requests, friendWords: result.data.friend_words } : defaults,
  };
}

export async function enablePushNotifications(userId: string, preferences: NotificationPreferences) {
  if (!supportsPushNotifications()) throw new Error('Notifications are not supported on this device.');
  if (!publicVapidKey) throw new Error('Notifications are not configured yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. You can enable them later in Settings.');
  const worker = await registration();
  const current = await worker.pushManager.getSubscription() || await worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(publicVapidKey),
  });
  const json = current.toJSON();
  if (!json.keys?.p256dh || !json.keys.auth) throw new Error('This device did not provide notification keys.');
  if (!supabase) throw new Error('Sign in to turn on notifications.');
  const result = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: current.endpoint,
    p256dh: json.keys.p256dh,
    auth_secret: json.keys.auth,
    friend_requests: preferences.requests,
    friend_words: preferences.friendWords,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (result.error) throw result.error;
}

export async function savePushSettings(userId: string, preferences: NotificationPreferences) {
  const current = await subscription();
  if (!current || !supabase) return enablePushNotifications(userId, preferences);
  const result = await supabase.from('push_subscriptions').update({
    friend_requests: preferences.requests,
    friend_words: preferences.friendWords,
    last_seen_at: new Date().toISOString(),
  }).eq('endpoint', current.endpoint).eq('user_id', userId);
  if (result.error) throw result.error;
}

export async function disablePushNotifications(userId: string) {
  const current = await subscription();
  if (!current) return;
  if (supabase) {
    const result = await supabase.from('push_subscriptions').delete().eq('endpoint', current.endpoint).eq('user_id', userId);
    if (result.error) throw result.error;
  }
  await current.unsubscribe();
}

export async function dispatchPushEvent(event: 'friend_request' | 'friend_word', sourceId: number) {
  if (!supabase) return;
  const result = await supabase.functions.invoke('send-push', { body: { event, sourceId } });
  if (result.error) console.error('Notification delivery failed', result.error);
}
