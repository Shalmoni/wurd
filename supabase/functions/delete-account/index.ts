import { createClient } from 'npm:@supabase/supabase-js@2.114.0';

// Target identity comes exclusively from Auth, never from a supplied user ID.
Deno.serve(async request => {
  const origin = request.headers.get('Origin');
  const allowed = new Set(['https://shalmoni.github.io', 'http://localhost:3001', 'http://localhost:3000']);
  const headers = { 'Access-Control-Allow-Origin': origin && allowed.has(origin) ? origin : 'https://shalmoni.github.io', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Vary': 'Origin' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return reply({ error: 'Sign in to continue' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return reply({ error: 'Sign in again to delete your account' }, 401);
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const session = await caller.rpc('account_session_active');
  if (session.error || session.data !== true) return reply({ error: 'Sign in again to delete your account' }, 401);
  let body;
  try { body = await request.json(); } catch { return reply({ error: 'Invalid request' }, 400); }
  if (body.confirm !== 'DELETE') return reply({ error: 'Confirmation required' }, 400);
  const removedPhoto = await admin.storage.from('avatars').remove([`${data.user.id}/avatar.webp`]);
  if (removedPhoto.error) return reply({ error: 'Could not remove your photo. Your account has not been deleted. Try again.' }, 503);
  const revoked = await admin.auth.admin.signOut(token, 'global');
  if (revoked.error) return reply({ error: 'Could not secure your sessions. Please sign in again and retry.' }, 503);
  const deleted = await admin.auth.admin.deleteUser(data.user.id);
  if (deleted.error) return reply({ error: 'Could not finish deleting your account. Please sign in again and retry.' }, 503);
  return reply({ ok: true });
});
