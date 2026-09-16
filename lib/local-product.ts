import type { FeedWord, WurdReply, WordColor, WordStyle } from './supabase';

export const LOCAL_PRODUCT_KEY = 'wurd:local-product:v1';
export const thresholds = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5200];
export const rewards = ['Your daily Wurd', 'New fonts', 'A little emoji', 'More colors', 'Profile photo', 'Three more fonts', 'The full color palette', 'Any emoji', 'Wurd animations', 'More to come'];
export const localCities = ['Harish, Israel', 'Jerusalem, Israel', 'Tel Aviv, Israel', 'Haifa, Israel', 'New York, United States', 'London, United Kingdom', 'Paris, France', 'Berlin, Germany', 'Toronto, Canada', 'Sydney, Australia'];
export const people = [
  { id: 'noa', name: 'noa', city: 'Jerusalem', word: 'GROUNDED' },
  { id: 'ari', name: 'ari', city: 'London', word: 'CURIOUS' },
  { id: 'maya', name: 'maya', city: 'Tel Aviv', word: 'ENOUGH' },
  { id: 'leo', name: 'leo', city: 'New York', word: 'AGAIN' },
  { id: 'ella', name: 'ella', city: 'Paris', word: 'SLOW' },
];
export type LocalPost = { id: number; word: string; at: number; day: string; color: WordColor; style: WordStyle; emoji: string; city: string; animation: 'still' | 'pulse' | 'float' | 'shimmer'; replaced?: boolean };
export type LocalState = {
  version: 1; signedIn: boolean; profile: { username: string; city: string; joined: number; photo: string } | null;
  posts: LocalPost[]; feed: FeedWord[]; friends: string[]; incoming: string[]; outgoing: string[]; blocked: string[];
  ledger: { id: string; label: string; xp: number; at: number }[];
  reports: { user: string; reason: string; at: number }[];
  feedback: { text: string; at: number }[];
  notifications: { requests: boolean; posts: boolean; replies: boolean; enabled: boolean };
  game: { id: number; ends: number; answer: string; revealed: boolean; settled: boolean; seen: boolean; results: string[] };
  offset: number; emptyFeed: boolean; offline: boolean; discoverySeen: boolean; events: { name: string; at: number }[];
  ownActivity: Record<number, { echoes: number; replies: WurdReply[] }>;
};
export const localDay = (at: number) => new Date(at).toLocaleDateString('en-CA');
export function seedLocalState(now = Date.now()): LocalState {
  const words = ['SAME', 'YES', 'FELT', 'EXACTLY', 'HOPE', 'WOW', 'MOOD', 'REALLY'];
  return {
    version: 1, signedIn: false, profile: null, posts: [], friends: ['noa'], incoming: ['maya'], outgoing: [], blocked: [], ledger: [], reports: [], feedback: [],
    notifications: { requests: true, posts: true, replies: true, enabled: false },
    game: { id: 0, ends: now + 5 * 3600000, answer: '', revealed: false, settled: false, seen: false, results: ['orange', 'orange', 'apple', 'banana', 'orange', 'mango'] },
    offset: 0, emptyFeed: false, offline: false, discoverySeen: false, events: [], ownActivity: {},
    feed: people.map((p, i) => ({ id: i + 1, user_id: p.id, username: p.name, display_name: null, avatar_url: null, city: p.city, country_code: null, word: p.word, emoji: null, color: 'mint', word_style: 'bold', created_at: new Date(now - (i + 1) * 3600000).toISOString(), local_date: localDay(now), echo_count: [8, 3, 6, 1, 0][i], reply_count: i === 0 ? 20 : 3, spoke_count: 5, echoed_by_me: false, my_echo_strength: 0,
      replies: Array.from({ length: i === 0 ? 20 : 3 }, (_, j): WurdReply => ({ id: 100 + i * 100 + j, daily_word_id: i + 1, user_id: `reply-${j}`, username: ['sam', 'jules', 'robin', 'alex'][j % 4], avatar_url: null, word: words[j % words.length], created_at: new Date(now - 50000).toISOString() })) })),
  };
}
export function levelProgress(total: number) {
  let index = 0;
  while (index < thresholds.length - 1 && total >= thresholds[index + 1]) index++;
  const required = index < 9 ? thresholds[index + 1] - thresholds[index] : null;
  return { level: index + 1, current: total - thresholds[index], required, remaining: required === null ? 0 : Math.max(0, thresholds[index + 1] - total) };
}
export function award(state: LocalState, id: string, label: string, xp: number, at: number): LocalState {
  if (state.ledger.some(row => row.id === id)) return state;
  return { ...state, ledger: [...state.ledger, { id, label, xp, at }] };
}
export function activePost(state: LocalState, now: number) {
  return state.posts.find(post => !post.replaced && post.at <= now && now - post.at < 86400000);
}
export function canPost(state: LocalState, now: number) {
  return !state.posts.some(post => post.day === localDay(now));
}
export function addPost(state: LocalState, word: string, now: number, color: WordColor = 'mint', style: WordStyle = 'bold', emoji = '', animation: LocalPost['animation'] = 'still'): LocalState {
  if (!canPost(state, now)) throw new Error('You’ve already posted today. Come back tomorrow.');
  if (!word.trim() || /\s/.test(word.trim()) || [...word.trim()].length > 20) throw new Error('One Wurd, up to 20 characters. No spaces.');
  const next = { ...state, posts: [{ id: now, word: word.trim().toUpperCase(), at: now, day: localDay(now), color, style, emoji, animation, city: state.profile?.city || '' }, ...state.posts.map(p => ({ ...p, replaced: true }))] };
  return award(next, `post:${localDay(now)}`, 'Posted your Wurd', 5, now);
}
export function localEcho(state: LocalState, id: number, strength: number): LocalState {
  if (!Number.isInteger(strength) || strength < 0 || strength > 3) throw new Error('Choose an echo from 0 to 3.');
  return { ...state, feed: state.feed.map(p => p.id === id ? { ...p, echo_count: p.echo_count - (p.my_echo_strength || 0) + strength, my_echo_strength: strength, echoed_by_me: strength > 0 } : p) };
}
export function localReply(state: LocalState, id: number, word: string, now: number): LocalState {
  if (!word.trim() || /\s/.test(word.trim()) || [...word.trim()].length > 20) throw new Error('One Wurd, up to 20 characters.');
  return { ...state, feed: state.feed.map(p => {
    if (p.id !== id) return p;
    if (p.replies?.some(r => r.user_id === 'local-you')) throw new Error('You’ve already replied to this Wurd.');
    return { ...p, reply_count: p.reply_count + 1, replies: [...(p.replies || []), { id: now, daily_word_id: id, user_id: 'local-you', username: state.profile?.username || 'you', avatar_url: null, word: word.toUpperCase(), created_at: new Date(now).toISOString() }] };
  }) };
}
export function revealGame(state: LocalState, now: number): LocalState {
  const count = state.game.answer ? state.game.results.filter(a => a === state.game.answer).length + 1 : 0;
  const next = { ...state, game: { ...state.game, revealed: true, settled: true } };
  return count ? award(next, `game:${state.game.id}`, 'The common wurd · matched answers', count, now) : next;
}
export function streak(state: LocalState, now: number) {
  const days = new Set(state.posts.map(p => p.day));
  const date = new Date(now);
  if (!days.has(localDay(+date))) date.setDate(date.getDate() - 1);
  let count = 0;
  while (days.has(localDay(+date))) { count++; date.setDate(date.getDate() - 1); }
  return count;
}
