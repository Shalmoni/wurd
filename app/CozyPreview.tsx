'use client';

import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  CircleUserRound, Flame, Globe2, Lock,
  Sparkles, Sun, Waves,
} from 'lucide-react';
import { geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countries110 from 'world-atlas/countries-110m.json';
import type { FeatureCollection } from 'geojson';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { isSupabaseConfigured, supabase, type FeedWord, type WordColor, type WurdProfile } from '@/lib/supabase';

type Tab = 'today' | 'world' | 'you';
type Scope = 'World' | 'Israel' | 'Nearby';
type PostWordInput = { word: string; emoji: string | null; color: WordColor };
type DiaryWord = { id: number; local_date: string; word: string; emoji: string | null; color: WordColor; echo_count: number };

const wordColorValues: Record<WordColor, string> = {
  mint: '#00b979',
  blue: '#3378d4',
  coral: '#ef6b5b',
};

const emojiChoices = ['🙂', '🔥', '✨', '❤️', '🌱', '💭'];

const atlas = countries110 as unknown as { objects: { countries: Parameters<typeof feature>[1] } };
const worldGeo = feature(countries110 as unknown as Parameters<typeof feature>[0], atlas.objects.countries) as unknown as FeatureCollection;

const livePeople = [
  ['Noa','NO','HOPEFUL','Tel Aviv','just now','#ffe4ee',18], ['Eli','EL','COFFEE','Haifa','1m','#fff0bd',7], ['Maya','MA','RAIN','London','1m','#e8e3ff',24],
  ['Jon','JO','FOCUS','New York','2m','#dff0ff',13], ['Sofia','SO','HOME','Lisbon','2m','#d8fff1',31], ['Ari','AR','TIRED','Jerusalem','3m','#ffe8cf',84],
  ['Lea','LE','SUMMER','Paris','3m','#ffe4ee',16], ['Ben','BE','BUILDING','Austin','4m','#d8fff1',29], ['Hana','HA','WORK','Tokyo','4m','#e8e3ff',42],
  ['Mika','MI','CHANGE','Berlin','5m','#dff0ff',11], ['Sam','SA','FAMILY','Toronto','5m','#fff0bd',38], ['Lior','LI','HOT','Eilat','6m','#ffe8cf',22],
] as const;

const friends = [
  { id: 'friend-becky', name: 'Becky', handle: '@becky', initials: 'BE', word: 'EXHAUSTED', echoes: 24, time: '8:42', color: '#ffe4ee' },
  { id: 'friend-daniel', name: 'Daniel', handle: '@daniel', initials: 'DA', word: 'BUILDING', echoes: 18, time: '8:17', color: '#d8fff1' },
  { id: 'friend-ari', name: 'Ari', handle: '@ari', initials: 'AR', word: 'HOPEFUL', echoes: 11, time: '7:54', color: '#fff0bd' },
  { id: 'friend-rachel', name: 'Rachel', handle: '@rachel', initials: 'RA', word: 'BABY', echoes: 36, time: '7:21', color: '#e8e3ff' },
  { id: 'friend-david', name: 'David', handle: '@david', initials: 'DV', word: 'FOCUS', echoes: 9, time: '6:48', color: '#dff0ff' },
  { id: 'friend-noa', name: 'Noa', handle: '@noa', initials: 'NO', word: 'CALM', echoes: 17, time: '6:31', color: '#e2fff4' },
  { id: 'friend-mika', name: 'Mika', handle: '@mika', initials: 'MI', word: 'CHANGE', echoes: 12, time: '6:04', color: '#ffe6d9' },
  { id: 'friend-sam', name: 'Sam', handle: '@sam', initials: 'SA', word: 'FAMILY', echoes: 28, time: '5:42', color: '#e6ecff' },
];

const friendCities: Record<string, string> = {
  'friend-becky': 'Tel Aviv', 'friend-daniel': 'San Francisco', 'friend-ari': 'Jerusalem', 'friend-rachel': 'London',
  'friend-david': 'New York', 'friend-noa': 'Haifa', 'friend-mika': 'Berlin', 'friend-sam': 'Toronto',
};

const wordSets: Record<Scope, { word: string; count: number; coordinates: [number, number]; size: string }[]> = {
  World: [
    { word: 'TIRED', count: 184291, coordinates: [12, 48], size: 'map-xl' },
    { word: 'WAR', count: 143882, coordinates: [35, 31], size: 'map-lg' },
    { word: 'SCHOOL', count: 98441, coordinates: [138, 36], size: 'map-md' },
    { word: 'HOT', count: 77102, coordinates: [-61, -15], size: 'map-sm' },
    { word: 'HAPPY', count: 61934, coordinates: [80, 18], size: 'map-sm' },
  ],
  Israel: [
    { word: 'TIRED', count: 18422, coordinates: [34.78, 32.08], size: 'map-xl' },
    { word: 'WAR', count: 14388, coordinates: [35.21, 31.77], size: 'map-lg' },
    { word: 'HEAT', count: 8912, coordinates: [34.95, 29.56], size: 'map-md' },
    { word: 'HOME', count: 7204, coordinates: [35.09, 32.79], size: 'map-sm' },
  ],
  Nearby: [
    { word: 'BUILDING', count: 842, coordinates: [34.78, 32.08], size: 'map-xl' },
    { word: 'COFFEE', count: 534, coordinates: [34.81, 32.10], size: 'map-lg' },
    { word: 'WORK', count: 413, coordinates: [34.77, 32.05], size: 'map-md' },
    { word: 'SEA', count: 288, coordinates: [34.75, 32.09], size: 'map-sm' },
    { word: 'HOME', count: 244, coordinates: [34.79, 32.07], size: 'map-md' },
    { word: 'HOT', count: 191, coordinates: [34.76, 32.11], size: 'map-sm' },
    { word: 'BABY', count: 152, coordinates: [34.80, 32.06], size: 'map-sm' },
    { word: 'CALM', count: 141, coordinates: [34.74, 32.08], size: 'map-sm' },
  ],
};

const nearbyPositions = [
  ['27%', '12%'], ['74%', '21%'], ['22%', '38%'], ['70%', '43%'],
  ['30%', '60%'], ['75%', '64%'], ['24%', '82%'], ['69%', '84%'],
] as const;

const wordDays = [
  ['Friday', '21', 'CLEAR', 12], ['Saturday', '22', 'REST', 8], ['Sunday', '23', 'SLOW', 6], ['Monday', '24', 'WORK', 14],
  ['Tuesday', '25', 'OPEN', 9], ['Wednesday', '26', 'SUN', 18], ['Thursday', '27', 'BUSY', 11], ['Friday', '28', 'EXCITED', 22],
  ['Saturday', '29', 'TIRED', 31], ['Sunday', '30', 'FAMILY', 27], ['Monday', '31', 'GEMS', 8], ['Tuesday', '1', 'HOME', 19],
  ['Wednesday', '2', 'CALM', 16], ['Thursday', '3', 'TODAY', 0],
] as const;

function localDayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function todayLabel() {
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
}

function multiplierForStreak(streak: number) {
  if (streak >= 60) return 1.5;
  if (streak >= 30) return 1.4;
  if (streak >= 14) return 1.3;
  if (streak >= 7) return 1.2;
  if (streak >= 3) return 1.1;
  return 1;
}

function levelProgressFor(xp: number, level: number) {
  if (level >= 3) return 100;
  const floor = level === 1 ? 0 : 100;
  const ceiling = level === 1 ? 100 : 300;
  return Math.min(100, Math.max(0, ((xp - floor) / (ceiling - floor)) * 100));
}

function BrandHeader({ submitted, emoji, color, echoes, xp, level, streak }: { submitted: string; emoji: string | null; color: WordColor; echoes: number; xp: number; level: number; streak: number }) {
  const levelProgress = levelProgressFor(xp, level);
  const multiplier = multiplierForStreak(streak);
  if (submitted) return (
    <header className="today-app-header">
      <div className="today-brand-row"><div className="today-brand">WURD</div><div className="header-xp"><span className="xp-label">XP</span><strong>{xp}</strong><em>{multiplier.toFixed(1)}×</em><i className="xp-bar"><b style={{ width: `${levelProgress}%` }} /></i><span className="xp-streak"><Flame />{streak}</span></div></div>
      <strong className="today-word" style={{ color: wordColorValues[color] }}>{submitted}{emoji && <span className="today-emoji"> {emoji}</span>}</strong>
      <div className="today-meta-row"><p>{todayLabel()}</p><span><Waves />{echoes}</span></div>
    </header>
  );
  return <header className="cozy-header"><div className="cozy-logo">wurd</div><p>{todayLabel()}</p></header>;
}

function LiveCard({ person, echoed, onEcho }: { person: typeof livePeople[number]; echoed: boolean; onEcho: () => void }) {
  const [name, initials, word, city, time, color, count] = person;
  return (
    <button className={`live-card ${echoed ? 'echoed' : ''}`} aria-pressed={echoed} aria-label={`${name} chose ${word}. Tap to echo.`} onClick={onEcho}>
      <div className="live-person"><Avatar><AvatarFallback style={{ background: color }}>{initials}</AvatarFallback></Avatar><span><strong>{name}</strong><small>{city} · {time}</small></span></div>
      <strong className="live-word">{word}</strong>
      <span className="echo-count"><Waves />{count + (echoed ? 1 : 0)}</span>
    </button>
  );
}

function initialsFor(name: string) {
  return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function FeedCard({ item, ownWord, onEcho }: { item: FeedWord; ownWord: string; onEcho: () => void }) {
  const name = item.display_name || item.username;
  const match = item.word.toLocaleUpperCase() === ownWord.toLocaleUpperCase();
  const content = <><div className="live-person"><Avatar><AvatarFallback>{initialsFor(name)}</AvatarFallback></Avatar><span><strong>{name}</strong><small>{item.city || 'Somewhere'} · {timeAgo(item.created_at)}</small></span></div><strong className="live-word" style={{ color: wordColorValues[item.color] }}>{item.word}{item.emoji && <span> {item.emoji}</span>}</strong>{match && <span className="same-word-label"><Sparkles /> Same word</span>}<span className="echo-count"><Waves />{item.echo_count}</span></>;
  if (match) return <article className="live-card friend-square exact-match" aria-label={`${name} chose the same word as you`}>{content}</article>;
  return <button className={`live-card friend-square ${item.echoed_by_me ? 'echoed' : ''}`} aria-pressed={item.echoed_by_me} aria-label={`${name} chose ${item.word}. Tap to echo.`} onClick={onEcho}>{content}</button>;
}

type TodayTabProps = {
  submitted: string;
  level: number;
  feed: FeedWord[];
  feedLoading: boolean;
  feedMode: 'Top today' | 'Friends';
  setFeedMode: (mode: 'Top today' | 'Friends') => void;
  setSubmitted: (post: PostWordInput) => Promise<void>;
  echoed: string[];
  toggleEcho: (id: number | string, echoed?: boolean) => Promise<void>;
};

function TodayTab({ submitted, level, feed, feedLoading, feedMode, setFeedMode, setSubmitted, echoed, toggleEcho }: TodayTabProps) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [color, setColor] = useState<WordColor>('mint');
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean || /\s/.test(clean)) { setError('Just one word — no spaces.'); return; }
    setPending(clean.toUpperCase());
  }
  if (!submitted) return (
    <section className="tab-view today-view"><div className="daily-prompt">
      {!pending ? <><span className="soft-icon"><Sun /></span><p>YOUR ONE POST TODAY</p><h1>What&apos;s your<br />word?</h1><small>Choose the single word that represents your day.</small><form onSubmit={submit}><Input maxLength={20} value={draft} onChange={event => { setDraft(event.target.value); setError(''); }} placeholder="TYPE YOUR WORD" /><Button type="submit">Continue</Button></form><em>{error || 'One word, up to 20 letters. Everything else unlocks after you post.'}</em></> :
      <div className="confirm-word"><span>YOUR WORD FOR {todayLabel().toUpperCase()}</span><h2 style={{ color: wordColorValues[color] }}>{pending}{emoji && ` ${emoji}`}</h2><p>This is the only word you can post today. At midnight, you&apos;ll get a new one.</p>
        <div className="reward-customizer">
          <section className={level < 2 ? 'locked-reward' : ''}><b>{level < 2 ? 'LEVEL 2 · EMOJI' : 'ADD ONE EMOJI'}</b><div className="emoji-options"><button className={!emoji ? 'active' : ''} onClick={() => setEmoji(null)}>None</button>{emojiChoices.map(item => <button disabled={level < 2} className={emoji === item ? 'active' : ''} onClick={() => setEmoji(item)} key={item}>{item}</button>)}</div></section>
          <section className={level < 3 ? 'locked-reward' : ''}><b>{level < 3 ? 'LEVEL 3 · COLORS' : 'WORD COLOR'}</b><div className="color-options">{(Object.keys(wordColorValues) as WordColor[]).map(item => <button disabled={level < 3 && item !== 'mint'} className={color === item ? 'active' : ''} style={{ background: wordColorValues[item] }} aria-label={`${item} word color`} onClick={() => setColor(item)} key={item} />)}</div></section>
        </div>
        {error && <em className="post-error">{error}</em>}
        <div className="confirm-actions"><Button variant="outline" disabled={posting} onClick={() => setPending('')}>Go back</Button><Button disabled={posting} onClick={async () => { setPosting(true); setError(''); try { await setSubmitted({ word: pending, emoji, color }); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not post your word.'); } finally { setPosting(false); } }}>{posting ? 'Posting…' : 'Post my word'}</Button></div>
      </div>}
    </div></section>
  );
  const topPeople = [...livePeople].sort((left, right) => right[6] - left[6]).slice(0, 8);
  return (
    <section className="tab-view live-view">
      <div className="today-toolbar"><span><i />{isSupabaseConfigured ? `${feed[0]?.spoke_count || 0} spoke` : feedMode === 'Top today' ? '1,284 spoke' : '8 of 12 spoke'}</span><div className="today-mode cozy-segments"><button className={feedMode === 'Top today' ? 'active' : ''} onClick={() => setFeedMode('Top today')}>Top</button><button className={feedMode === 'Friends' ? 'active' : ''} onClick={() => setFeedMode('Friends')}>Friends</button></div></div>
      {isSupabaseConfigured ? <div className={feedMode === 'Top today' ? 'live-grid' : 'friends-card-grid'}>{feedLoading ? <p className="feed-empty">Finding today&apos;s words…</p> : feed.length ? feed.map(item => <FeedCard key={item.id} item={item} ownWord={submitted} onEcho={() => toggleEcho(item.id, item.echoed_by_me)} />) : <p className="feed-empty">{feedMode === 'Friends' ? 'Your friends have not spoken yet.' : 'You are early. Today’s words will appear here.'}</p>}</div> : feedMode === 'Top today' ? <div className="live-grid">{topPeople.map((person, index) => <LiveCard key={`${person[0]}-${person[2]}`} person={person} echoed={echoed.includes(`live-${index}`)} onEcho={() => void toggleEcho(`live-${index}`)} />)}</div> : <div className="friends-card-grid">{friends.map(friend => <FriendCard key={friend.id} friend={friend} match={friend.word === submitted} echoed={echoed.includes(friend.id)} onEcho={() => void toggleEcho(friend.id)} />)}</div>}
    </section>
  );
}

function FriendCard({ friend, match, echoed, onEcho }: { friend: typeof friends[number]; match: boolean; echoed: boolean; onEcho: () => void }) {
  const content = <><div className="live-person"><Avatar><AvatarFallback style={{ background: friend.color }}>{friend.initials}</AvatarFallback></Avatar><span><strong>{friend.name}</strong><small>{friendCities[friend.id]} · {friend.time} ago</small></span></div><strong className="live-word">{friend.word}</strong>{match && <span className="same-word-label"><Sparkles /> Same word</span>}<span className="echo-count"><Waves />{friend.echoes + (echoed ? 1 : 0)}</span></>;
  if (match) return <article className="live-card friend-square exact-match" aria-label={`${friend.name} chose the same word as you`}>{content}</article>;
  return <button className={`live-card friend-square ${echoed ? 'echoed' : ''}`} aria-pressed={echoed} aria-label={`${friend.name} chose ${friend.word}. Tap to echo.`} onClick={onEcho}>{content}</button>;
}

function WorldMap({ scope }: { scope: Scope }) {
  if (scope === 'Nearby') return (
    <div className="nearby-cloud" aria-label="Words near you today">
      {wordSets.Nearby.map((item, index) => <div className={`nearby-word nearby-${index + 1}`} style={{ left: nearbyPositions[index][0], top: nearbyPositions[index][1] }} key={item.word}>
        <strong>{item.word}</strong><span><i />{item.count.toLocaleString()}</span>
      </div>)}
    </div>
  );
  const width = 700;
  const height = 360;
  const projection = scope === 'World'
    ? geoNaturalEarth1().fitExtent([[12, 12], [width - 12, height - 12]], worldGeo)
    : geoMercator().center([34.82, 31.9]).scale(5200).translate([width / 2, height / 2]);
  const makePath = geoPath(projection);
  return (
    <div className="real-map">
      <svg viewBox={`0 0 ${width} ${height}`} aria-label={`${scope} word map`}>
        <g className="countries">{worldGeo.features.map((country, index) => <path d={makePath(country) || ''} key={index} />)}</g>
      </svg>
      <div className="map-label-layer">{wordSets[scope].map(item => {
        const point = projection(item.coordinates);
        if (!point) return null;
        return <div className={`real-map-word ${item.size}`} style={{ left: `${point[0] / width * 100}%`, top: `${point[1] / height * 100}%` }} key={item.word}><strong>{item.word}</strong><span><i />{item.count.toLocaleString()} today</span></div>;
      })}</div>
    </div>
  );
}

function WorldTab() {
  const [scope, setScope] = useState<Scope>('World');
  const [day, setDay] = useState(4);
  return (
    <section className="tab-view world-view"><div className="cozy-title"><div><span>THE WORLD&apos;S WORDS</span><h1>World today</h1></div><b><i /> LIVE</b></div>
      <div className="cozy-segments three scope-only">{(['World','Israel','Nearby'] as Scope[]).map(item => <button className={scope === item ? 'active' : ''} onClick={() => setScope(item)} key={item}>{item}</button>)}</div>
      <WorldMap scope={scope} />
      <div className="rewind-strip"><span>REWIND</span>{['AUG 29','30','31','SEP 1','TODAY'].map((date, index) => <button className={day === index ? 'active' : ''} onClick={() => setDay(index)} key={date}><i />{date}</button>)}</div>
    </section>
  );
}

function YouTab({ submitted, history }: { submitted: string; history: DiaryWord[] }) {
  const dayTrack = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (dayTrack.current) dayTrack.current.scrollTop = dayTrack.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const diary = history.length ? [...history].reverse().map(item => {
    const date = new Date(`${item.local_date}T12:00:00`);
    return { id: item.id, weekday: new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date), day: new Intl.DateTimeFormat('en', { day: 'numeric' }).format(date), month: new Intl.DateTimeFormat('en', { month: 'short' }).format(date), word: item.word, emoji: item.emoji, color: item.color, echoes: item.echo_count, isToday: item.local_date === localDayKey() };
  }) : wordDays.map(([weekday, date, storedWord, echoes], index) => ({ id: index, weekday, day: date, month: index < wordDays.length - 2 ? 'Aug' : 'Sep', word: index === wordDays.length - 1 ? submitted : storedWord, emoji: null, color: 'mint' as WordColor, echoes: index === wordDays.length - 1 ? 37 + submitted.length * 11 : echoes, isToday: index === wordDays.length - 1 }));
  return (
    <section className="tab-view you-view"><div className="profile-placeholder" aria-hidden="true" />
      <div className="calendar-swipe-cue">SWIPE DAYS ↑</div>
      <div className="day-ribbon" ref={dayTrack} aria-label="Your recent words">{diary.map(item => <article className={`diary-day-card ${item.isToday ? 'is-today' : ''}`} key={item.id}><span>{item.weekday}</span><div className="day-date"><i>{item.month}</i><strong>{item.day}</strong></div><b style={{ color: wordColorValues[item.color] }}>{item.word}{item.emoji && ` ${item.emoji}`}</b><small><Waves />{item.echoes}</small>{item.isToday && <em>TODAY</em>}</article>)}</div>
    </section>
  );
}

const tabs: { id: Tab; label: string; icon: typeof Sun }[] = [
  { id: 'today', label: 'Today', icon: Sun }, { id: 'world', label: 'World', icon: Globe2 }, { id: 'you', label: 'You', icon: CircleUserRound },
];

export default function CozyPreview() {
  const [tab, setTab] = useState<Tab>('today');
  const [dayKey, setDayKey] = useState(localDayKey);
  const [submitted, setSubmittedState] = useState('');
  const [submittedEmoji, setSubmittedEmoji] = useState<string | null>(null);
  const [submittedColor, setSubmittedColor] = useState<WordColor>('mint');
  const [echoed, setEchoed] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<WurdProfile | null>(null);
  const [feed, setFeed] = useState<FeedWord[]>([]);
  const [history, setHistory] = useState<DiaryWord[]>([]);
  const [feedMode, setFeedMode] = useState<'Top today' | 'Friends'>('Top today');
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [feedLoading, setFeedLoading] = useState(false);
  const [appError, setAppError] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');

  async function loadAccount(activeUser: User) {
    if (!supabase) return;
    setFeedLoading(true);
    const [profileResult, wordResult, historyResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', activeUser.id).single(),
      supabase.from('daily_words').select('id, local_date, word, emoji, color').eq('user_id', activeUser.id).eq('local_date', localDayKey()).maybeSingle(),
      supabase.rpc('my_word_history', { p_limit: 14 }),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (historyResult.error) throw historyResult.error;
    setProfile(profileResult.data as WurdProfile);
    setHistory((historyResult.data || []) as DiaryWord[]);
    if (wordResult.data) {
      setSubmittedState(wordResult.data.word);
      setSubmittedEmoji(wordResult.data.emoji);
      setSubmittedColor(wordResult.data.color as WordColor);
    } else {
      setSubmittedState('');
      setSubmittedEmoji(null);
      setSubmittedColor('mint');
    }
    setFeedLoading(false);
  }

  async function loadFeed(mode = feedMode, activeUser = user) {
    if (!supabase || !activeUser) return;
    setFeedLoading(true);
    const result = await supabase.rpc('feed_words', { p_date: localDayKey(), p_limit: 8, p_friends_only: mode === 'Friends' });
    setFeedLoading(false);
    if (result.error) throw result.error;
    setFeed((result.data || []) as FeedWord[]);
  }

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (!live) return;
      if (error) setAppError(error.message);
      setUser(data.user);
      try { if (data.user) await loadAccount(data.user); } catch (reason) { setAppError(reason instanceof Error ? reason.message : 'Could not load your account.'); }
      if (live) setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!live) return;
      setUser(session?.user || null);
      if (session?.user) void loadAccount(session.user).catch(reason => setAppError(reason instanceof Error ? reason.message : 'Could not load your account.'));
      else { setProfile(null); setSubmittedState(''); setFeed([]); setHistory([]); }
    });
    return () => { live = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || !submitted) return;
    void loadFeed(feedMode, user).catch(reason => setAppError(reason instanceof Error ? reason.message : 'Could not load today’s words.'));
  }, [user, submitted, feedMode]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    const word = window.localStorage.getItem(`wurd:daily:${dayKey}`) || '';
    const savedPost = window.localStorage.getItem(`wurd:post:${dayKey}`);
    const savedEchoes = window.localStorage.getItem(`wurd:echoes:${dayKey}`);
    setSubmittedState(word);
    if (savedPost) { try { const post = JSON.parse(savedPost) as PostWordInput; setSubmittedEmoji(post.emoji); setSubmittedColor(post.color); } catch { /* supports older local saves */ } }
    try { setEchoed(savedEchoes ? JSON.parse(savedEchoes) : []); } catch { setEchoed([]); }
    if (!word) setTab('today');
    const timer = window.setInterval(() => {
      const nextDay = localDayKey();
      if (nextDay !== dayKey) { setDayKey(nextDay); setSubmittedState(''); setEchoed([]); setTab('today'); }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [dayKey]);

  async function postWord(post: PostWordInput) {
    if (supabase && user) {
      const result = await supabase.rpc('post_daily_word', { p_word: post.word, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, p_emoji: post.emoji, p_color: post.color, p_city: profile?.city || null, p_country_code: profile?.country_code || null });
      if (result.error) throw result.error;
      setSubmittedState(post.word);
      setSubmittedEmoji(post.emoji);
      setSubmittedColor(post.color);
      await loadAccount(user);
      return;
    }
    setSubmittedState(post.word);
    setSubmittedEmoji(post.emoji);
    setSubmittedColor(post.color);
    window.localStorage.setItem(`wurd:daily:${dayKey}`, post.word);
    window.localStorage.setItem(`wurd:post:${dayKey}`, JSON.stringify(post));
  }
  async function toggleEcho(id: number | string, isEchoed = false) {
    if (supabase && user && typeof id === 'number') {
      const result = isEchoed ? await supabase.rpc('un_echo_word', { p_daily_word_id: id }) : await supabase.rpc('echo_word', { p_daily_word_id: id });
      if (result.error) { setAppError(result.error.message); return; }
      await Promise.all([loadFeed(feedMode, user), loadAccount(user)]);
      return;
    }
    const localId = String(id);
    setEchoed(current => {
      const next = current.includes(localId) ? current.filter(item => item !== localId) : [...current, localId];
      window.localStorage.setItem(`wurd:echoes:${dayKey}`, JSON.stringify(next));
      return next;
    });
  }

  async function signIn() {
    if (!supabase) return;
    setAppError('');
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) setAppError(error.message);
  }

  async function saveUsername(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    const clean = usernameDraft.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(clean)) { setAppError('Use 3–24 letters, numbers, or underscores.'); return; }
    const { error } = await supabase.from('profiles').update({ username: clean }).eq('id', user.id);
    if (error) { setAppError(error.code === '23505' ? 'That username is already taken.' : error.message); return; }
    await loadAccount(user);
  }

  if (authLoading) return <main className="auth-stage"><div className="auth-card"><div className="cozy-logo">wurd</div><p>Opening your day…</p></div></main>;
  if (isSupabaseConfigured && !user) return <main className="auth-stage"><div className="auth-card"><div className="cozy-logo">wurd</div><h1>One word.<br />Once a day.</h1><p>See what your people and the world are feeling—without the noise.</p><Button onClick={signIn}><span className="google-mark">G</span> Continue with Google</Button>{appError && <em>{appError}</em>}</div></main>;
  if (profile?.username.startsWith('wurd_')) return <main className="auth-stage"><form className="auth-card" onSubmit={saveUsername}><div className="cozy-logo">wurd</div><h1>What should<br />people call you?</h1><p>Your username appears beside your word. You can change it later.</p><Input maxLength={24} value={usernameDraft} onChange={event => { setUsernameDraft(event.target.value); setAppError(''); }} placeholder="your_username" /><Button type="submit">Claim username</Button>{appError && <em>{appError}</em>}</form></main>;

  const xp = profile?.xp ?? 852 + echoed.length;
  const level = profile?.level ?? 3;
  const streak = profile?.streak_days ?? 12;
  const ownEchoes = history.find(item => item.local_date === dayKey)?.echo_count ?? (submitted ? 37 + submitted.length * 11 : 0);
  return (
    <main className={`cozy-stage fixed-app active-${tab} ${submitted ? 'today-app' : ''}`}><section className="cozy-shell"><BrandHeader submitted={submitted} emoji={submittedEmoji} color={submittedColor} echoes={ownEchoes} xp={xp} level={level} streak={streak} /><div className="cozy-main">
      {appError && <button className="app-error" onClick={() => setAppError('')}>{appError}</button>}
      {tab === 'today' && <TodayTab submitted={submitted} level={level} feed={feed} feedLoading={feedLoading} feedMode={feedMode} setFeedMode={setFeedMode} setSubmitted={postWord} echoed={echoed} toggleEcho={toggleEcho} />}
      {tab === 'world' && <WorldTab />}
      {tab === 'you' && <YouTab submitted={submitted} history={history} />}
    </div><nav className="cozy-nav" aria-label="App navigation">{tabs.map(item => {
      const locked = !submitted && item.id === 'world';
      return <button key={item.id} className={`${tab === item.id ? 'active' : ''} ${locked ? 'locked' : ''}`} disabled={locked} title={locked ? 'Post today’s word to unlock' : item.label} onClick={() => setTab(item.id)}><item.icon />{locked && <Lock className="nav-lock" />}<span>{item.label}</span></button>;
    })}</nav></section></main>
  );
}
