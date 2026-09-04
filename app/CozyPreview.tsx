'use client';

import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Check, CircleUserRound, Flame, Globe2, Lock, LogOut,
  MapPin, Search, Settings, Sun, UserPlus, UsersRound, Waves,
} from 'lucide-react';
import { geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countries110 from 'world-atlas/countries-110m.json';
import type { FeatureCollection } from 'geojson';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isSupabaseConfigured, supabase, type FeedWord, type WordColor, type WordStyle, type WurdProfile } from '@/lib/supabase';

type Tab = 'today' | 'world' | 'you';
type Scope = 'World' | 'Israel' | 'Nearby';
type PostWordInput = { word: string; emoji: string | null; color: WordColor; wordStyle: WordStyle };
type DiaryWord = { id: number; local_date: string; word: string; emoji: string | null; color: WordColor; word_style: WordStyle; city: string | null; created_at: string; echo_count: number };
type ProfileSummary = Pick<WurdProfile, 'id' | 'username' | 'city'>;
type Friendship = {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  other: ProfileSummary;
};
type YouPanel = 'search' | 'friends' | 'settings' | null;
type CityChoice = { name: string; country: string; countryCode: string };

const wordColorValues: Record<WordColor, string> = {
  mint: '#00b979',
  blue: '#3378d4',
  coral: '#ef6b5b',
};

const emojiChoices = ['🙂', '🔥', '✨', '❤️', '🌱', '💭'];
const diaryLaunchDate = '2026-09-03';

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

function localDayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function todayLabel() {
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
}

function todayDateTimeLabel() {
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date());
}

function memberSinceLabel(value?: string | null) {
  if (!value) return 'today';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function isWithinTodayWindow(value: string, now = Date.now()) {
  const postedAt = new Date(value).getTime();
  return Number.isFinite(postedAt) && postedAt <= now && postedAt > now - 24 * 60 * 60 * 1000;
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
  if (level >= 4) return 100;
  const thresholds = [0, 0, 100, 300, 600];
  const floor = thresholds[level] ?? 0;
  const ceiling = thresholds[level + 1] ?? 600;
  return Math.min(100, Math.max(0, ((xp - floor) / (ceiling - floor)) * 100));
}

function readableError(reason: unknown, fallback: string) {
  if (reason instanceof Error) return reason.message;
  if (reason && typeof reason === 'object' && 'message' in reason && typeof reason.message === 'string') return reason.message;
  return fallback;
}

function usernameLabel(username?: string | null) {
  return `@${(username || 'username').replace(/^@+/, '')}`;
}

function isInvalidLocalSession(reason: unknown) {
  const message = readableError(reason, '');
  return /(?:jwt.*future|issued.*future|clock.*skew|user from sub claim in jwt does not exist)/i.test(message);
}

function locationLabel(city?: string | null, countryCode?: string | null) {
  if (!city) return 'Location not added';
  const displayCity = city.normalize('NFD').replace(/\u0331/g, '').normalize('NFC');
  if (!countryCode) return displayCity;
  try {
    const country = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode.toUpperCase());
    return country ? `${displayCity}, ${country}` : displayCity;
  } catch {
    return displayCity;
  }
}

function BrandHeader({ tab, submitted, submittedAt, now, emoji, color, wordStyle, echoes, xp, level, streak, username, memberSince, city, countryCode }: { tab: Tab; submitted: string; submittedAt?: string | null; now: number; emoji: string | null; color: WordColor; wordStyle: WordStyle; echoes: number; xp: number; level: number; streak: number; username?: string; memberSince?: string | null; city?: string | null; countryCode?: string | null }) {
  const levelProgress = levelProgressFor(xp, level);
  const multiplier = multiplierForStreak(streak);
  const topRow = <div className="today-brand-row"><div className="today-brand">wurd</div><div className="header-progress"><span className="level-label">LVL <b>{level}</b></span><Popover><PopoverTrigger className="header-xp" aria-label={`Level ${level}. Learn how XP works`}><strong className="xp-total"><span className="xp-prefix">XP</span>{xp}</strong><span className="xp-progress"><em>{multiplier.toFixed(1)}×</em><i className="xp-bar"><b style={{ width: `${levelProgress}%` }} /></i></span><span className="xp-streak"><Flame />{streak}</span></PopoverTrigger><PopoverContent side="bottom" sideOffset={7} className="echo-tooltip">Post daily, build your streak, and collect echoes to unlock new features.</PopoverContent></Popover></div></div>;
  if (tab === 'you') return (
    <header className="today-app-header you-identity-header">
      {topRow}
      <div className="you-identity"><strong>{usernameLabel(username)}</strong><span><i>since</i><b>{memberSinceLabel(memberSince)}</b></span></div>
    </header>
  );
  if (submitted) return (
    <header className="today-app-header">
      {topRow}
      <Popover><PopoverTrigger className={`today-word word-style-${wordStyle}`} style={{ color: wordColorValues[color] }} aria-label={`${submitted}. Your wurd today.`}>{submitted}{emoji && <span className="today-emoji"> {emoji}</span>}</PopoverTrigger><PopoverContent side="bottom" sideOffset={7} className="echo-tooltip">This is your wurd today. Come back tomorrow to say a new wurd.</PopoverContent></Popover>
      <div className="today-meta-row"><p>{submittedAt ? timeAgo(submittedAt, now) : 'now'} · {locationLabel(city, countryCode)}</p><EchoStat count={echoes} /></div>
    </header>
  );
  return <header className="cozy-header"><div className="cozy-logo">wurd</div></header>;
}

function EchoStat({ count }: { count: number }) {
  return (
    <Popover>
      <PopoverTrigger className="echo-count" aria-label={`${count} echoes. Echoes show how many people feel the same way.`} onClick={event => event.stopPropagation()}>
        <Waves />{count}
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={7} className="echo-tooltip">Echoes show how many people feel the same way.</PopoverContent>
    </Popover>
  );
}

function LiveCard({ person, echoed, onEcho }: { person: typeof livePeople[number]; echoed: boolean; onEcho: () => void }) {
  const [name, , word, city, time, , count] = person;
  return (
    <article className={`live-card ${echoed ? 'echoed' : ''}`}>
      <button className="card-echo-action" aria-pressed={echoed} aria-label={`${name} chose ${word}. Tap to echo.`} onClick={onEcho}>
        <div className="live-person"><span><strong>{name.toLowerCase()}</strong><small>{city} · {time}</small></span></div>
        <strong className="live-word">{word}</strong>
      </button>
      <EchoStat count={count + (echoed ? 1 : 0)} />
    </article>
  );
}

function timeAgo(value: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function FeedCard({ item, ownWord, onEcho }: { item: FeedWord; ownWord: string; onEcho: () => void }) {
  const name = usernameLabel(item.username);
  const match = item.word.toLocaleUpperCase() === ownWord.toLocaleUpperCase();
  const content = <><div className="live-person"><span><strong>{name}</strong><small>{item.city || 'Location not added'} · {timeAgo(item.created_at)}</small></span></div><strong className={`live-word word-style-${item.word_style || 'bold'}`} style={{ color: wordColorValues[item.color] }}>{item.word}{item.emoji && <span> {item.emoji}</span>}</strong></>;
  if (match) return <article className="live-card friend-square exact-match" aria-label={`${name} chose the same word as you`}><div className="card-static-content">{content}</div><EchoStat count={item.echo_count} /></article>;
  return <article className={`live-card friend-square ${item.echoed_by_me ? 'echoed' : ''}`}><button className="card-echo-action" aria-pressed={item.echoed_by_me} aria-label={`${name} chose ${item.word}. Tap to echo.`} onClick={onEcho}>{content}</button><EchoStat count={item.echo_count} /></article>;
}

type TodayTabProps = {
  submitted: string;
  level: number;
  feed: FeedWord[];
  feedLoading: boolean;
  spokeCount: number;
  feedMode: 'Top today' | 'Friends';
  setFeedMode: (mode: 'Top today' | 'Friends') => void;
  setSubmitted: (post: PostWordInput) => Promise<void>;
  echoed: string[];
  toggleEcho: (id: number | string, echoed?: boolean) => Promise<void>;
};

function TodayTab({ submitted, level, feed, feedLoading, spokeCount, feedMode, setFeedMode, setSubmitted, echoed, toggleEcho }: TodayTabProps) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [color, setColor] = useState<WordColor>('mint');
  const [wordStyle, setWordStyle] = useState<WordStyle>('bold');
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
      {!pending ? <><span className="soft-icon"><Sun /></span><p>{todayDateTimeLabel()}</p><h1>What&apos;s your<br />word?</h1><form onSubmit={submit}><Input maxLength={20} value={draft} onChange={event => { setDraft(event.target.value); setError(''); }} placeholder="TYPE YOUR WORD" /><Button type="submit">Continue</Button></form>{error && <em>{error}</em>}</> :
      <div className="confirm-word"><span>YOUR WORD FOR {todayLabel().toUpperCase()}</span><h2 className={`word-style-${wordStyle}`} style={{ color: wordColorValues[color] }}>{pending}{emoji && ` ${emoji}`}</h2><p>This is the only word you can post today. At midnight, you&apos;ll get a new one.</p>
        {level >= 2 && <div className="reward-customizer">
          <section><b>WORD STYLE</b><div className="style-options"><button className={wordStyle === 'bold' ? 'active' : ''} onClick={() => setWordStyle('bold')}>Bold</button><button className={wordStyle === 'serif' ? 'active word-style-serif' : 'word-style-serif'} onClick={() => setWordStyle('serif')}>Serif</button></div></section>
          {level >= 3 && <section><b>ADD ONE EMOJI</b><div className="emoji-options"><button className={!emoji ? 'active' : ''} onClick={() => setEmoji(null)}>None</button>{emojiChoices.map(item => <button className={emoji === item ? 'active' : ''} onClick={() => setEmoji(item)} key={item}>{item}</button>)}</div></section>}
          {level >= 4 && <section><b>WORD COLOR</b><div className="color-options">{(Object.keys(wordColorValues) as WordColor[]).map(item => <button className={color === item ? 'active' : ''} style={{ background: wordColorValues[item] }} aria-label={`${item} word color`} onClick={() => setColor(item)} key={item} />)}</div></section>}
        </div>}
        {error && <em className="post-error">{error}</em>}
        <div className="confirm-actions"><Button variant="outline" disabled={posting} onClick={() => setPending('')}>Go back</Button><Button disabled={posting} onClick={async () => { setPosting(true); setError(''); try { await setSubmitted({ word: pending, emoji, color, wordStyle }); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not post your word.'); } finally { setPosting(false); } }}>{posting ? 'Posting…' : 'Post my word'}</Button></div>
      </div>}
    </div></section>
  );
  const topPeople = [...livePeople].sort((left, right) => right[6] - left[6]).slice(0, 8);
  return (
    <section className="tab-view live-view">
      <div className="today-toolbar"><div className="today-feed-summary"><span><i />{isSupabaseConfigured ? `${spokeCount} posted` : feedMode === 'Top today' ? '1,284 posted' : '8 friends posted'}</span><small>Tap someone&apos;s wurd to echo it.</small></div><div className="today-mode cozy-segments"><button className={feedMode === 'Top today' ? 'active' : ''} onClick={() => setFeedMode('Top today')}>Top</button><button className={feedMode === 'Friends' ? 'active' : ''} onClick={() => setFeedMode('Friends')}>Friends</button></div></div>
      {isSupabaseConfigured ? <div className={feedMode === 'Top today' ? 'live-grid' : 'friends-card-grid'}>{feedLoading ? <p className="feed-empty">Finding today&apos;s words…</p> : feed.length ? feed.map(item => <FeedCard key={item.id} item={item} ownWord={submitted} onEcho={() => toggleEcho(item.id, item.echoed_by_me)} />) : <p className="feed-empty">{feedMode === 'Friends' ? 'Your friends have not spoken yet.' : 'You are early. Today’s words will appear here.'}</p>}</div> : feedMode === 'Top today' ? <div className="live-grid">{topPeople.map((person, index) => <LiveCard key={`${person[0]}-${person[2]}`} person={person} echoed={echoed.includes(`live-${index}`)} onEcho={() => void toggleEcho(`live-${index}`)} />)}</div> : <div className="friends-card-grid">{friends.map(friend => <FriendCard key={friend.id} friend={friend} match={friend.word === submitted} echoed={echoed.includes(friend.id)} onEcho={() => void toggleEcho(friend.id)} />)}</div>}
    </section>
  );
}

function FriendCard({ friend, match, echoed, onEcho }: { friend: typeof friends[number]; match: boolean; echoed: boolean; onEcho: () => void }) {
  const content = <><div className="live-person"><span><strong>{usernameLabel(friend.handle)}</strong><small>{friendCities[friend.id]} · {friend.time} ago</small></span></div><strong className="live-word">{friend.word}</strong></>;
  if (match) return <article className="live-card friend-square exact-match" aria-label={`${friend.name} chose the same word as you`}><div className="card-static-content">{content}</div><EchoStat count={friend.echoes} /></article>;
  return <article className={`live-card friend-square ${echoed ? 'echoed' : ''}`}><button className="card-echo-action" aria-pressed={echoed} aria-label={`${friend.name} chose ${friend.word}. Tap to echo.`} onClick={onEcho}>{content}</button><EchoStat count={friend.echoes + (echoed ? 1 : 0)} /></article>;
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

function YouTab({ history, onOpenPanel }: { history: DiaryWord[]; onOpenPanel: (panel: Exclude<YouPanel, null>) => void }) {
  const dayTrack = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (dayTrack.current) dayTrack.current.scrollTop = dayTrack.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const diary = [...history].reverse().map(item => {
    const date = new Date(`${item.local_date}T12:00:00`);
    return { id: item.id, weekday: new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date), day: new Intl.DateTimeFormat('en', { day: 'numeric' }).format(date), month: new Intl.DateTimeFormat('en', { month: 'short' }).format(date), word: item.word, emoji: item.emoji, color: item.color, wordStyle: item.word_style || 'bold', city: item.city, echoes: item.echo_count, isToday: item.local_date === localDayKey() };
  });
  return (
    <section className="tab-view you-view">
      <div className="you-actions" aria-label="People and account tools">
        <button onClick={() => onOpenPanel('search')}><Search /><span>Search</span></button>
        <button onClick={() => onOpenPanel('friends')}><UsersRound /><span>Friends</span></button>
        <button onClick={() => onOpenPanel('settings')}><Settings /><span>Settings</span></button>
      </div>
      {diary.length > 0 && <div className="calendar-swipe-cue">SWIPE DAYS ↑</div>}
      {diary.length > 0 ? <div className="day-ribbon" ref={dayTrack} aria-label="Your recent words">{diary.map(item => <article className={`diary-day-card ${item.isToday ? 'is-today' : ''}`} key={item.id}><span>{item.weekday}</span><div className="day-date"><i>{item.month}</i><strong>{item.day}</strong></div><b className={`word-style-${item.wordStyle}`} style={{ color: wordColorValues[item.color] }}>{item.word}{item.emoji && ` ${item.emoji}`}</b><small className="diary-location"><MapPin />{item.city || 'Location not added'}</small><EchoStat count={item.echoes} />{item.isToday && <em>TODAY</em>}</article>)}</div> : <div className="diary-empty"><span><Sun /></span><h2>Your words start here.</h2><p>Post your first word and it will become the first day in your story.</p></div>}
    </section>
  );
}

type YouToolsDialogProps = {
  panel: YouPanel;
  setPanel: (panel: YouPanel) => void;
  userId: string;
  connections: Friendship[];
  searchResults: ProfileSummary[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchPeople: () => Promise<void>;
  sendFriendRequest: (id: string) => Promise<void>;
  acceptFriend: (id: number) => Promise<void>;
  saveSettings: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  signOut: () => Promise<void>;
  usernameDraft: string;
  setUsernameDraft: (value: string) => void;
  cityDraft: string;
  setCityDraft: (value: string) => void;
  citySelection: CityChoice | null;
  setCitySelection: (value: CityChoice | null) => void;
  busy: boolean;
};

function YouToolsDialog(props: YouToolsDialogProps) {
  const relationFor = (id: string) => props.connections.find(item => item.other.id === id);
  const incoming = props.connections.filter(item => item.status === 'pending' && item.addressee_id === props.userId);
  const outgoing = props.connections.filter(item => item.status === 'pending' && item.requester_id === props.userId);
  const accepted = props.connections.filter(item => item.status === 'accepted');
  return (
    <Dialog open={props.panel !== null} onOpenChange={open => { if (!open) props.setPanel(null); }}>
      <DialogContent className="you-tool-dialog">
        {props.panel === 'search' && <>
          <DialogHeader><DialogTitle>Find your people</DialogTitle><DialogDescription>Search by username, then send a friend request.</DialogDescription></DialogHeader>
          <form className="friend-search" onSubmit={event => { event.preventDefault(); void props.searchPeople(); }}><Input aria-label="Search username" value={props.searchQuery} onChange={event => props.onSearchQueryChange(event.target.value)} maxLength={24} placeholder="Start typing a username" autoComplete="off" /><Button type="submit" disabled={props.busy}><Search /> Search</Button></form>
          <div className="people-list">{props.searchResults.map(person => {
            const relationship = relationFor(person.id);
            return <div className="person-row" key={person.id}><div><strong>{usernameLabel(person.username)}</strong><small><MapPin />{person.city || 'Location not added'}</small></div>{relationship?.status === 'accepted' ? <span className="status-chip"><Check /> Friends</span> : relationship?.status === 'pending' ? <span className="status-chip">Requested</span> : <Button size="sm" onClick={() => void props.sendFriendRequest(person.id)} disabled={props.busy}><UserPlus /> Connect</Button>}</div>;
          })}{props.searchQuery && !props.busy && props.searchResults.length === 0 && <p className="panel-empty">No matching usernames yet.</p>}</div>
        </>}
        {props.panel === 'friends' && <>
          <DialogHeader><DialogTitle>Friends</DialogTitle><DialogDescription>New friendships give each person 10 XP.</DialogDescription></DialogHeader>
          <div className="people-list friendship-list">
            {incoming.map(item => <div className="person-row" key={item.id}><div><strong>{usernameLabel(item.other.username)}</strong><small>Wants to be friends</small></div><Button size="sm" onClick={() => void props.acceptFriend(item.id)} disabled={props.busy}><Check /> Accept</Button></div>)}
            {outgoing.map(item => <div className="person-row" key={item.id}><div><strong>{usernameLabel(item.other.username)}</strong><small>Request sent</small></div><span className="status-chip">Pending</span></div>)}
            {accepted.map(item => <div className="person-row" key={item.id}><div><strong>{usernameLabel(item.other.username)}</strong><small><MapPin />{item.other.city || 'Location not added'}</small></div><span className="status-chip"><Check /> Friends</span></div>)}
            {props.connections.length === 0 && <p className="panel-empty">No friends or requests yet. Search for someone to get started.</p>}
          </div>
        </>}
        {props.panel === 'settings' && <>
          <DialogHeader><DialogTitle>Settings</DialogTitle><DialogDescription>Change the name and city people see beside your word.</DialogDescription></DialogHeader>
          <form className="settings-form" onSubmit={event => void props.saveSettings(event)}><label htmlFor="settings-username">Username</label><Input id="settings-username" maxLength={24} value={props.usernameDraft} onChange={event => props.setUsernameDraft(event.target.value)} /><label htmlFor="settings-city">City</label><CityPicker id="settings-city" query={props.cityDraft} selected={props.citySelection} onQueryChange={props.setCityDraft} onSelect={props.setCitySelection} /><Button type="submit" disabled={props.busy}>Save changes</Button></form>
          <Button className="logout-button" variant="outline" onClick={() => void props.signOut()}><LogOut /> Log out</Button>
        </>}
      </DialogContent>
    </Dialog>
  );
}

function GoogleLogo() {
  return <svg className="google-logo" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.614Z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.333A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.681 9c0-.592.102-1.168.282-1.706V4.961H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.039l3.007-2.333Z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.961l3.007 2.333C4.672 5.165 6.656 3.58 9 3.58Z"/></svg>;
}

function CityPicker({ id, query, selected, onQueryChange, onSelect }: { id: string; query: string; selected: CityChoice | null; onQueryChange: (value: string) => void; onSelect: (value: CityChoice | null) => void }) {
  const [results, setResults] = useState<CityChoice[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const clean = query.trim();
    if (selected || clean.length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=8&language=en&format=json`, { signal: controller.signal });
        if (!response.ok) throw new Error('City search failed');
        const payload = await response.json() as { results?: { name: string; country?: string; country_code?: string; feature_code?: string }[] };
        const cities = (payload.results || [])
          .filter(item => item.country && item.country_code && item.feature_code?.startsWith('PPL'))
          .map(item => ({ name: item.name, country: item.country!, countryCode: item.country_code! }));
        setResults(cities.filter((item, index) => cities.findIndex(match => match.name === item.name && match.countryCode === item.countryCode) === index).slice(0, 6));
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) setResults([]);
      } finally { setSearching(false); }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selected]);
  return <div className="city-picker"><Input id={id} maxLength={80} autoComplete="off" value={query} onChange={event => { onSelect(null); onQueryChange(event.target.value); }} placeholder="Start typing a city" aria-autocomplete="list" aria-expanded={results.length > 0} />{searching && <small className="city-searching">Finding cities…</small>}{results.length > 0 && <div className="city-results" role="listbox" aria-label="Matching cities">{results.map(city => <button type="button" role="option" aria-selected={false} key={`${city.name}-${city.countryCode}`} onClick={() => { onSelect(city); onQueryChange(`${city.name}, ${city.country}`); setResults([]); }}><strong>{city.name}</strong><span>{city.country}</span></button>)}</div>}</div>;
}

const tabs: { id: Tab; label: string; icon: typeof Sun }[] = [
  { id: 'today', label: 'Today', icon: Sun }, { id: 'world', label: 'World', icon: Globe2 }, { id: 'you', label: 'You', icon: CircleUserRound },
];

export default function CozyPreview() {
  const [tab, setTab] = useState<Tab>('today');
  const [dayKey, setDayKey] = useState(localDayKey);
  const [submitted, setSubmittedState] = useState('');
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submittedEmoji, setSubmittedEmoji] = useState<string | null>(null);
  const [submittedColor, setSubmittedColor] = useState<WordColor>('mint');
  const [submittedWordStyle, setSubmittedWordStyle] = useState<WordStyle>('bold');
  const [echoed, setEchoed] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<WurdProfile | null>(null);
  const [feed, setFeed] = useState<FeedWord[]>([]);
  const [spokeCount, setSpokeCount] = useState(0);
  const [history, setHistory] = useState<DiaryWord[]>([]);
  const [connections, setConnections] = useState<Friendship[]>([]);
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [youPanel, setYouPanel] = useState<YouPanel>(null);
  const [feedMode, setFeedMode] = useState<'Top today' | 'Friends'>('Top today');
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [feedLoading, setFeedLoading] = useState(false);
  const [appError, setAppError] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [cityDraft, setCityDraft] = useState('');
  const [citySelection, setCitySelection] = useState<CityChoice | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now);
  const friendSearchTimer = useRef<number | null>(null);

  async function loadAccount(activeUser: User) {
    if (!supabase) return;
    setFeedLoading(true);
    try {
      const [profileResult, wordResult, historyResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', activeUser.id).single(),
        supabase.from('daily_words').select('id, local_date, word, emoji, color, word_style, created_at').eq('user_id', activeUser.id).eq('local_date', localDayKey()).maybeSingle(),
        supabase.rpc('my_word_history', { p_limit: 14 }),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (wordResult.error) throw wordResult.error;
      if (historyResult.error) throw historyResult.error;
      const loadedProfile = profileResult.data as WurdProfile;
      setProfile(loadedProfile);
      setUsernameDraft(loadedProfile.username.startsWith('wurd_') ? '' : loadedProfile.username);
      setCityDraft(loadedProfile.city || '');
      setCitySelection(loadedProfile.city ? { name: loadedProfile.city, country: '', countryCode: loadedProfile.country_code || '' } : null);
      setHistory(((historyResult.data || []) as DiaryWord[]).filter(item => item.local_date >= diaryLaunchDate));
      if (wordResult.data) {
        setSubmittedState(wordResult.data.word);
        setSubmittedEmoji(wordResult.data.emoji);
        setSubmittedColor(wordResult.data.color as WordColor);
        setSubmittedWordStyle((wordResult.data.word_style as WordStyle) || 'bold');
        setSubmittedAt(wordResult.data.created_at);
      } else {
        setSubmittedState('');
        setSubmittedEmoji(null);
        setSubmittedColor('mint');
        setSubmittedWordStyle('bold');
        setSubmittedAt(null);
      }
    } finally {
      setFeedLoading(false);
    }
  }

  async function loadFeed(mode = feedMode, activeUser = user) {
    if (!supabase || !activeUser) return;
    setFeedLoading(true);
    const result = await supabase.rpc('feed_words', { p_date: localDayKey(), p_limit: 9, p_friends_only: mode === 'Friends' });
    setFeedLoading(false);
    if (result.error) throw result.error;
    const rows = (result.data || []) as FeedWord[];
    setSpokeCount(rows[0]?.spoke_count || 0);
    setFeed(rows.filter(item => item.user_id !== activeUser.id && isWithinTodayWindow(item.created_at)).slice(0, 8));
  }

  async function loadConnections(activeUser = user) {
    if (!supabase || !activeUser) return;
    const result = await supabase.from('friendships').select('id, requester_id, addressee_id, status').or(`requester_id.eq.${activeUser.id},addressee_id.eq.${activeUser.id}`).order('created_at', { ascending: false });
    if (result.error) throw result.error;
    const rows = (result.data || []) as Omit<Friendship, 'other'>[];
    const otherIds = [...new Set(rows.map(item => item.requester_id === activeUser.id ? item.addressee_id : item.requester_id))];
    if (!otherIds.length) { setConnections([]); return; }
    const profilesResult = await supabase.from('profiles').select('id, username, city').in('id', otherIds);
    if (profilesResult.error) throw profilesResult.error;
    const profilesById = new Map((profilesResult.data as ProfileSummary[]).map(item => [item.id, item]));
    setConnections(rows.flatMap(item => {
      const otherId = item.requester_id === activeUser.id ? item.addressee_id : item.requester_id;
      const other = profilesById.get(otherId);
      return other ? [{ ...item, other }] : [];
    }));
  }

  useEffect(() => {
    if (!supabase) return;
    const authClient = supabase;
    let live = true;
    void authClient.auth.getUser().then(async initialResult => {
      if (!live) return;
      let { data, error } = initialResult;
      if (error && isInvalidLocalSession(error)) {
        await new Promise(resolve => window.setTimeout(resolve, 1200));
        const refreshed = await authClient.auth.refreshSession();
        if (!refreshed.error && refreshed.data.user) {
          data = { user: refreshed.data.user };
          error = null;
        }
      }
      if (error && isInvalidLocalSession(error)) {
        // A restored Safari tab can retain an obsolete or slightly future-dated
        // token. If one refresh cannot repair it, clear only this device's
        // session and return to Google sign-in instead of exposing a JWT error.
        await authClient.auth.signOut({ scope: 'local' });
        if (live) { setUser(null); setAppError(''); setAuthLoading(false); }
        return;
      }
      if (error && error.name !== 'AuthSessionMissingError') setAppError(error.message);
      setUser(data.user);
      if (data.user) {
        try { await loadAccount(data.user); } catch (reason) { setAppError(readableError(reason, 'Could not load your account.')); }
        void loadConnections(data.user).catch(reason => console.error('Could not load friendships', reason));
      }
      if (live) setAuthLoading(false);
    });
    const { data: listener } = authClient.auth.onAuthStateChange((_event, session) => {
      if (!live) return;
      setUser(session?.user || null);
      if (session?.user) {
        void loadAccount(session.user).catch(reason => setAppError(readableError(reason, 'Could not load your account.')));
        void loadConnections(session.user).catch(reason => console.error('Could not load friendships', reason));
      }
      else { setProfile(null); setSubmittedState(''); setSubmittedAt(null); setFeed([]); setHistory([]); setConnections([]); }
    });
    return () => { live = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user || !submitted || tab !== 'today') return;
    const refreshFeed = () => {
      if (document.visibilityState === 'visible') {
        void loadFeed(feedMode, user).catch(reason => setAppError(readableError(reason, 'Could not load today’s words.')));
      }
    };
    refreshFeed();
    const timer = window.setInterval(refreshFeed, 20000);
    return () => window.clearInterval(timer);
  }, [user, submitted, feedMode, tab]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    const word = window.localStorage.getItem(`wurd:daily:${dayKey}`) || '';
    const savedPost = window.localStorage.getItem(`wurd:post:${dayKey}`);
    const savedEchoes = window.localStorage.getItem(`wurd:echoes:${dayKey}`);
    setSubmittedState(word);
    setSubmittedAt(window.localStorage.getItem(`wurd:posted-at:${dayKey}`));
    if (savedPost) { try { const post = JSON.parse(savedPost) as PostWordInput; setSubmittedEmoji(post.emoji); setSubmittedColor(post.color); setSubmittedWordStyle(post.wordStyle || 'bold'); } catch { /* supports older local saves */ } }
    try { setEchoed(savedEchoes ? JSON.parse(savedEchoes) : []); } catch { setEchoed([]); }
    if (!word) setTab('today');
    const timer = window.setInterval(() => {
      const nextDay = localDayKey();
      if (nextDay !== dayKey) { setDayKey(nextDay); setSubmittedState(''); setSubmittedAt(null); setEchoed([]); setTab('today'); }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [dayKey]);

  async function postWord(post: PostWordInput) {
    if (supabase && user) {
      const result = await supabase.rpc('post_daily_word', { p_word: post.word, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, p_emoji: post.emoji, p_color: post.color, p_city: profile?.city || null, p_country_code: profile?.country_code || null, p_word_style: post.wordStyle });
      if (result.error) throw result.error;
      setSubmittedState(post.word);
      setSubmittedAt(new Date().toISOString());
      setSubmittedEmoji(post.emoji);
      setSubmittedColor(post.color);
      setSubmittedWordStyle(post.wordStyle);
      await loadAccount(user);
      return;
    }
    setSubmittedState(post.word);
    const postedAt = new Date().toISOString();
    setSubmittedAt(postedAt);
    setSubmittedEmoji(post.emoji);
    setSubmittedColor(post.color);
    setSubmittedWordStyle(post.wordStyle);
    window.localStorage.setItem(`wurd:daily:${dayKey}`, post.word);
    window.localStorage.setItem(`wurd:post:${dayKey}`, JSON.stringify(post));
    window.localStorage.setItem(`wurd:posted-at:${dayKey}`, postedAt);
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

  async function saveOnboarding(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    const clean = usernameDraft.trim().toLowerCase();
    const city = citySelection?.name.trim() || '';
    if (!/^[a-z0-9_]{3,24}$/.test(clean)) { setAppError('Use 3–24 letters, numbers, or underscores.'); return; }
    if (city.length < 2) { setAppError('Add the city you want shown beside your words.'); return; }
    setAccountBusy(true);
    const { error } = await supabase.from('profiles').update({ username: clean, city, country_code: citySelection?.countryCode || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).eq('id', user.id);
    setAccountBusy(false);
    if (error) { setAppError(error.code === '23505' ? 'That username is already taken.' : error.message); return; }
    await loadAccount(user);
  }

  async function searchPeople(query = searchQuery) {
    if (!supabase || !user) return;
    const clean = query.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 2) { setSearchResults([]); return; }
    setAccountBusy(true);
    const result = await supabase.from('profiles').select('id, username, city').ilike('username', `%${clean}%`).neq('id', user.id).limit(8);
    setAccountBusy(false);
    if (result.error) { setAppError(result.error.message); return; }
    setSearchResults((result.data || []) as ProfileSummary[]);
  }

  function updateFriendSearch(value: string) {
    setSearchQuery(value);
    if (friendSearchTimer.current !== null) window.clearTimeout(friendSearchTimer.current);
    const clean = value.trim();
    if (clean.length < 2) { setSearchResults([]); return; }
    friendSearchTimer.current = window.setTimeout(() => void searchPeople(value), 300);
  }

  async function sendFriendRequest(addresseeId: string) {
    if (!supabase || !user) return;
    setAccountBusy(true);
    const { error } = await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' });
    setAccountBusy(false);
    if (error) { setAppError(error.code === '23505' ? 'A request already exists between you.' : error.message); return; }
    await loadConnections(user);
  }

  async function acceptFriend(friendshipId: number) {
    if (!supabase || !user) return;
    setAccountBusy(true);
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId).eq('addressee_id', user.id);
    setAccountBusy(false);
    if (error) { setAppError(error.message); return; }
    await Promise.all([loadConnections(user), loadAccount(user), submitted ? loadFeed(feedMode, user) : Promise.resolve()]);
  }

  async function saveSettings(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    const clean = usernameDraft.trim().toLowerCase();
    const city = citySelection?.name.trim() || '';
    if (!/^[a-z0-9_]{3,24}$/.test(clean)) { setAppError('Use 3–24 letters, numbers, or underscores.'); return; }
    if (city.length < 2) { setAppError('Add the city you want shown beside your words.'); return; }
    setAccountBusy(true);
    const { error } = await supabase.from('profiles').update({ username: clean, city, country_code: citySelection?.countryCode || null }).eq('id', user.id);
    setAccountBusy(false);
    if (error) { setAppError(error.code === '23505' ? 'That username is already taken.' : error.message); return; }
    await loadAccount(user);
    setYouPanel(null);
  }

  async function signOut() {
    if (!supabase) return;
    setAccountBusy(true);
    const { error } = await supabase.auth.signOut();
    setAccountBusy(false);
    if (error) setAppError(error.message);
    else setYouPanel(null);
  }

  if (authLoading) return <main className="auth-stage"><div className="auth-card"><div className="cozy-logo">wurd</div><p>Getting today ready</p></div></main>;
  if (isSupabaseConfigured && !user) return <main className="auth-stage"><div className="auth-card sign-in-card"><div className="cozy-logo">wurd</div><h1>Say less.</h1><Button className="google-sign-in" onClick={signIn}><GoogleLogo /> Continue with Google</Button>{appError && <em>{appError}</em>}</div></main>;
  if (profile && (profile.username.startsWith('wurd_') || !profile.city)) return <main className="auth-stage"><form className="auth-card onboarding-card" onSubmit={saveOnboarding}><div className="cozy-logo">wurd</div><h1>Make it yours.</h1><p>Choose a username and select your city.</p><label htmlFor="onboarding-username">Username</label><Input id="onboarding-username" maxLength={24} value={usernameDraft} onChange={event => { setUsernameDraft(event.target.value); setAppError(''); }} placeholder="your_username" /><label htmlFor="onboarding-city">City</label><CityPicker id="onboarding-city" query={cityDraft} selected={citySelection} onQueryChange={value => { setCityDraft(value); setAppError(''); }} onSelect={setCitySelection} /><Button type="submit" disabled={accountBusy}>{accountBusy ? 'Saving…' : 'Start using wurd'}</Button>{appError && <em>{appError}</em>}</form></main>;

  const xp = profile?.xp ?? 852 + echoed.length;
  const level = profile?.level ?? 3;
  const streak = profile?.streak_days ?? 12;
  const ownEchoes = history.find(item => item.local_date === dayKey)?.echo_count ?? (submitted ? 37 + submitted.length * 11 : 0);
  return (
    <main className={`cozy-stage fixed-app active-${tab} ${submitted || tab === 'you' ? 'today-app' : ''}`}><section className="cozy-shell"><BrandHeader tab={tab} submitted={submitted} submittedAt={submittedAt} now={clockNow} emoji={submittedEmoji} color={submittedColor} wordStyle={submittedWordStyle} echoes={ownEchoes} xp={xp} level={level} streak={streak} username={profile?.username} memberSince={profile?.created_at} city={profile?.city} countryCode={profile?.country_code} /><div className="cozy-main">
      {appError && <button className="app-error" onClick={() => setAppError('')}>{appError}</button>}
      {tab === 'today' && <TodayTab submitted={submitted} level={level} feed={feed.filter(item => isWithinTodayWindow(item.created_at, clockNow))} feedLoading={feedLoading} spokeCount={spokeCount} feedMode={feedMode} setFeedMode={setFeedMode} setSubmitted={postWord} echoed={echoed} toggleEcho={toggleEcho} />}
      {tab === 'world' && <WorldTab />}
      {tab === 'you' && <YouTab history={history} onOpenPanel={panel => { setAppError(''); setSearchResults([]); setYouPanel(panel); if (panel === 'friends') void loadConnections(user || undefined).catch(reason => setAppError(readableError(reason, 'Could not load friends.'))); }} />}
    </div><nav className="cozy-nav" aria-label="App navigation">{tabs.map(item => {
      const locked = item.id === 'world';
      return <button key={item.id} className={`${tab === item.id ? 'active' : ''} ${locked ? 'locked' : ''}`} disabled={locked} title={locked ? 'Coming later' : item.label} onClick={() => setTab(item.id)}><item.icon />{locked && <Lock className="nav-lock" />}<span>{item.label}</span></button>;
    })}</nav>{profile && user && <YouToolsDialog panel={youPanel} setPanel={setYouPanel} userId={user.id} connections={connections} searchResults={searchResults} searchQuery={searchQuery} onSearchQueryChange={updateFriendSearch} searchPeople={searchPeople} sendFriendRequest={sendFriendRequest} acceptFriend={acceptFriend} saveSettings={saveSettings} signOut={signOut} usernameDraft={usernameDraft} setUsernameDraft={setUsernameDraft} cityDraft={cityDraft} setCityDraft={setCityDraft} citySelection={citySelection} setCitySelection={setCitySelection} busy={accountBusy} />}</section></main>
  );
}
