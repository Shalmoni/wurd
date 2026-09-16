import { createClient } from 'npm:@supabase/supabase-js@2.114.0';
import webpush from 'npm:web-push@3.6.7';

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'https://shalmoni.github.io',
]);

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://shalmoni.github.io',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async request => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'https://shalmoni.github.io/wurd/';
  if (!supabaseUrl || !serviceKey || !vapidPublicKey || !vapidPrivateKey) {
    return json({ error: 'Notification service is not configured' }, 503, origin);
  }

  const authorization = request.headers.get('Authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Authentication required' }, 401, origin);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userResult = await admin.auth.getUser(token);
  const actor = userResult.data.user;
  if (userResult.error || !actor) return json({ error: 'Invalid session' }, 401, origin);

  let input: { event?: string; sourceId?: number };
  try { input = await request.json(); } catch { return json({ error: 'Invalid request' }, 400, origin); }
  if (!Number.isInteger(input.sourceId) || !['friend_request', 'friend_word', 'wurd_reply'].includes(input.event || '')) {
    return json({ error: 'Invalid notification event' }, 400, origin);
  }

  let recipientIds: string[] = [];
  let username = '';
  let preference: 'friend_requests' | 'friend_words' | 'replies';
  let payload: { title: string; body: string; tag: string; url: string };

  const profileResult = await admin.from('profiles').select('username').eq('id', actor.id).single();
  if (profileResult.error) return json({ error: 'Profile not found' }, 404, origin);
  username = profileResult.data.username;

  if (input.event === 'friend_request') {
    const friendship = await admin.from('friendships').select('id, requester_id, addressee_id, status').eq('id', input.sourceId).single();
    if (friendship.error || friendship.data.requester_id !== actor.id || friendship.data.status !== 'pending') {
      return json({ error: 'Friend request not found' }, 404, origin);
    }
    recipientIds = [friendship.data.addressee_id];
    preference = 'friend_requests';
    payload = {
      title: 'New friend request',
      body: `@${username} wants to be friends.`,
      tag: `friend-request-${input.sourceId}`,
      url: '?open=friends',
    };
  } else if (input.event === 'wurd_reply') {
    const reply = await admin.from('wurd_replies').select('id,user_id,daily_word_id,created_at').eq('id', input.sourceId).single();
    if (reply.error || reply.data.user_id !== actor.id || Date.parse(reply.data.created_at) < Date.now() - 86400000) return json({ error: 'Reply not found' }, 404, origin);
    const word = await admin.from('daily_words').select('user_id,created_at,replaced_at').eq('id', reply.data.daily_word_id).single();
    if (word.error || word.data.replaced_at || Date.parse(word.data.created_at) < Date.now() - 86400000 || word.data.user_id === actor.id) return json({ error: 'Wurd not available' }, 404, origin);
    recipientIds = [word.data.user_id];
    preference = 'replies';
    payload = { title: 'A reply to your Wurd', body: `@${username} replied to your Wurd.`, tag: `wurd-reply-${input.sourceId}`, url: '?open=replies' };
  } else {
    const word = await admin.from('daily_words').select('id, user_id, created_at, replaced_at').eq('id', input.sourceId).single();
    const isCurrent = word.data && !word.data.replaced_at && new Date(word.data.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
    if (word.error || word.data?.user_id !== actor.id || !isCurrent) return json({ error: 'Active Wurd not found' }, 404, origin);
    const friendships = await admin.from('friendships').select('requester_id, addressee_id').eq('status', 'accepted').or(`requester_id.eq.${actor.id},addressee_id.eq.${actor.id}`);
    if (friendships.error) return json({ error: 'Could not load friends' }, 500, origin);
    recipientIds = [...new Set(friendships.data.map(item => item.requester_id === actor.id ? item.addressee_id : item.requester_id))];
    preference = 'friend_words';
    payload = {
      title: 'A friend posted',
      body: `@${username} posted a new Wurd.`,
      tag: `friend-word-${input.sourceId}`,
      url: '?feed=friends',
    };
  }

  if (!recipientIds.length) return json({ sent: 0 }, 200, origin);
  // Re-check blocks using the caller's identity, not the service role.
  const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const visible = await caller.from('profiles').select('id').in('id', recipientIds);
  if (visible.error) return json({ error: 'Could not verify recipients' }, 503, origin);
  recipientIds = visible.data.map(person => person.id);
  if (!recipientIds.length) return json({ sent: 0 }, 200, origin);
  const subscriptions = await admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth_secret').in('user_id', recipientIds).eq(preference, true);
  if (subscriptions.error) return json({ error: 'Could not load devices' }, 500, origin);

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  let sent = 0;
  for (const device of subscriptions.data) {
    const delivery = await admin.from('push_deliveries').insert({
      event_kind: input.event,
      source_id: input.sourceId,
      recipient_id: device.user_id,
      subscription_id: device.id,
    }).select('id').single();
    if (delivery.error?.code === '23505') continue;
    if (delivery.error) continue;

    try {
      await webpush.sendNotification({
        endpoint: device.endpoint,
        keys: { p256dh: device.p256dh, auth: device.auth_secret },
      }, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: 'normal' });
      sent += 1;
      await admin.from('push_deliveries').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', delivery.data.id);
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
      await admin.from('push_deliveries').update({ status: 'failed', error_message: error instanceof Error ? error.message.slice(0, 500) : 'Push failed' }).eq('id', delivery.data.id);
      if (statusCode === 404 || statusCode === 410) await admin.from('push_subscriptions').delete().eq('id', device.id);
    }
  }

  return json({ sent }, 200, origin);
});
