'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, SyntheticEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Check, CircleUserRound, Clock3, Flame, Globe2, Lock, LogOut,
  MapPin, RefreshCw, Search, Settings, Sun, UserPlus, UsersRound, Waves,
  Trophy,
} from 'lucide-react';
import { geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countries110 from 'world-atlas/countries-110m.json';
import type { FeatureCollection } from 'geojson';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { isSupabaseConfigured, supabase, type FeedWord, type WordColor, type WordStyle, type WurdProfile } from '@/lib/supabase';

type Tab = 'today' | 'world' | 'you';
type Scope = 'World' | 'Israel' | 'Nearby';
type FeedMode = 'New' | 'Top' | 'Friends';
type CardFriendState = 'self' | 'none' | 'outgoing' | 'incoming' | 'friend';
type WordAnimation = 'still' | 'pulse' | 'float' | 'shimmer';
type PostWordInput = { word: string; emoji: string | null; color: WordColor; wordStyle: WordStyle; animation?: WordAnimation };
type DiaryWord = { id: number; local_date: string; word: string; emoji: string | null; color: WordColor; word_style: WordStyle; animation?: WordAnimation; city: string | null; created_at: string; echo_count: number };
type ProfileSummary = Pick<WurdProfile, 'id' | 'username' | 'city'>;
type Friendship = {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  other: ProfileSummary;
};
type YouPanel = 'search' | 'friends' | 'xp' | 'settings' | null;
type CityChoice = { name: string; country: string; countryCode: string };
type PhotoCropDraft = { src: string; image: HTMLImageElement; width: number; height: number };

const wordColorValues: Record<WordColor, string> = {
  mint: '#00E695',
  blue: '#007BF5',
  violet: '#7B00F5',
  coral: '#F57B00',
  yellow: '#F5F500',
  lime: '#7BF500',
  green: '#00F500',
  cyan: '#00F5F5',
  deepBlue: '#0000F5',
  magenta: '#F500F5',
  pink: '#F5007B',
  red: '#F50000',
};
const echoStrengthOptions = [
  { label: 'Choose', color: '#9AA9A3' },
  { label: 'Meh', color: '#80FFBF' },
  { label: 'Okay', color: '#52FFA8' },
  { label: 'Wurd.', color: '#00E695' },
] as const;

const emojiChoices = ['🙂', '🔥', '✨', '❤️', '🌱', '💭'];
const wordColorChoices: { value: WordColor; level: number; label: string }[] = [
  { value: 'mint', level: 1, label: 'Wurd green' },
  { value: 'blue', level: 4, label: 'Blue' },
  { value: 'violet', level: 4, label: 'Violet' },
  { value: 'coral', level: 4, label: 'Orange' },
  { value: 'yellow', level: 7, label: 'Yellow' },
  { value: 'lime', level: 7, label: 'Lime' },
  { value: 'green', level: 7, label: 'Green' },
  { value: 'cyan', level: 7, label: 'Cyan' },
  { value: 'deepBlue', level: 7, label: 'Deep blue' },
  { value: 'magenta', level: 7, label: 'Magenta' },
  { value: 'pink', level: 7, label: 'Pink' },
  { value: 'red', level: 7, label: 'Red' },
];
const wordStyleChoices: { value: WordStyle; label: string; level: number }[] = [
  { value: 'bold', label: 'Bold', level: 1 },
  { value: 'serif', label: 'Editorial', level: 2 },
  { value: 'rounded', label: 'Soft', level: 2 },
  { value: 'mono', label: 'Mono', level: 6 },
  { value: 'slab', label: 'Slab', level: 6 },
  { value: 'hand', label: 'Hand', level: 6 },
];
const animationChoices: { value: WordAnimation; label: string }[] = [
  { value: 'still', label: 'None' }, { value: 'pulse', label: 'Breathe' },
  { value: 'float', label: 'Float' }, { value: 'shimmer', label: 'Shimmer' },
];
const diaryLaunchDate = '2026-09-03';
const levelDefinitions = [
  { level: 1, threshold: 0, reward: 'Core Wurd' },
  { level: 2, threshold: 100, reward: 'New fonts' },
  { level: 3, threshold: 300, reward: 'Emoji picker' },
  { level: 4, threshold: 600, reward: 'More colors' },
  { level: 5, threshold: 1000, reward: 'Profile photo' },
  { level: 6, threshold: 1500, reward: '3 more fonts' },
  { level: 7, threshold: 2200, reward: 'Full color spectrum' },
  { level: 8, threshold: 3000, reward: 'Any emoji' },
  { level: 9, threshold: 4000, reward: 'Wurd animations' },
  { level: 10, threshold: 5200, reward: 'Not decided yet' },
] as const;

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

function isLevelTenPreview() {
  return import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'level10';
}

function oneEmoji(value: string) {
  const clean = value.trim();
  if (!clean) return null;
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(clean)].map(item => item.segment);
  if (segments.length !== 1 || !/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(segments[0])) return undefined;
  return segments[0];
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

function levelForXp(totalXp: number) {
  return [...levelDefinitions].reverse().find(item => totalXp >= item.threshold)?.level ?? 1;
}

function levelProgressFor(totalXp: number, level: number) {
  const current = levelDefinitions[level - 1];
  const next = levelDefinitions[level];
  const earned = Math.max(0, totalXp - current.threshold);
  if (!next) return { earned, required: earned, remaining: 0, percent: 100 };
  const required = next.threshold - current.threshold;
  return { earned, required, remaining: Math.max(0, required - earned), percent: Math.min(100, Math.max(0, (earned / required) * 100)) };
}

function readableError(reason: unknown, fallback: string) {
  if (reason instanceof Error) return reason.message;
  if (reason && typeof reason === 'object' && 'message' in reason && typeof reason.message === 'string') return reason.message;
  return fallback;
}

function usernameLabel(username?: string | null) {
  return `@${(username || 'username').replace(/^@+/, '')}`;
}

function profilePhotoUrl(value?: string | null, version?: string | null) {
  if (!value) return '';
  if (/^(?:data:|blob:)/i.test(value)) return value;
  if (/^https?:/i.test(value)) return '';
  const publicUrl = supabase?.storage.from('avatars').getPublicUrl(value).data.publicUrl || '';
  return version && publicUrl ? `${publicUrl}?v=${encodeURIComponent(version)}` : publicUrl;
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

function FittedTodayWord({ word, emoji, color, wordStyle, animation }: { word: string; emoji: string | null; color: WordColor; wordStyle: WordStyle; animation: WordAnimation }) {
  const frame = useRef<HTMLButtonElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const frameElement = frame.current;
    const textElement = text.current;
    if (!frameElement || !textElement) return;

    const fit = () => {
      const availableWidth = frameElement.clientWidth;
      const naturalWidth = textElement.scrollWidth;
      setScale(availableWidth > 0 && naturalWidth > 0 ? Math.min(1, availableWidth / naturalWidth) : 1);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frameElement);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [word, emoji, wordStyle]);

  return <PopoverTrigger ref={frame} className={`today-word ${wordLengthClass(word)} word-style-${wordStyle} word-animation-${animation}`} style={{ color: wordColorValues[color] }} aria-label={`${word}. Your current wurd.`}><span ref={text} className="today-word-text" style={{ '--word-scale': scale } as CSSProperties}>{word}{emoji && <span className="today-emoji"> {emoji}</span>}</span></PopoverTrigger>;
}

function BrandHeader({ tab, submitted, submittedAt, now, emoji, color, wordStyle, animation = 'still', echoes, xp, level, streak, username, memberSince, city, countryCode, avatarUrl, canReplace, onReplace }: { tab: Tab; submitted: string; submittedAt?: string | null; now: number; emoji: string | null; color: WordColor; wordStyle: WordStyle; animation?: WordAnimation; echoes: number; xp: number; level: number; streak: number; username?: string; memberSince?: string | null; city?: string | null; countryCode?: string | null; avatarUrl?: string | null; canReplace?: boolean; onReplace?: () => void }) {
  const levelProgress = levelProgressFor(xp, level);
  const multiplier = multiplierForStreak(streak);
  const topRow = <div className="today-brand-row"><div className="today-brand">wurd</div><div className="header-progress"><span className="level-label">LVL <b>{level}</b></span><Popover><PopoverTrigger className="header-xp" aria-label={`Level ${level}. ${levelProgress.earned} of ${levelProgress.required} XP`}><strong className="xp-total"><span className="xp-prefix">XP</span>{levelProgress.earned}</strong><span className="xp-progress"><em>{multiplier.toFixed(1)}×</em><i className="xp-bar"><b style={{ width: `${levelProgress.percent}%` }} /></i></span><span className="xp-streak"><Flame />{streak}</span></PopoverTrigger><PopoverContent side="bottom" sideOffset={7} className="echo-tooltip">{level >= 10 ? 'You reached the highest level.' : `${levelProgress.earned} / ${levelProgress.required} XP toward Level ${level + 1}. Post daily, keep your streak, and earn echoes.`}</PopoverContent></Popover></div></div>;
  if (tab === 'you') return (
    <header className="today-app-header you-identity-header">
      {topRow}
      <div className="you-identity">{avatarUrl && <img className="you-profile-photo" src={avatarUrl} alt="" />}<div><strong>{usernameLabel(username)}</strong><span><i>since</i><b>{memberSinceLabel(memberSince)}</b></span></div></div>
    </header>
  );
  if (submitted) return (
    <header className="today-app-header">
      {topRow}
      <div className="today-word-row"><Popover><FittedTodayWord word={submitted} emoji={emoji} color={color} wordStyle={wordStyle} animation={animation} /><PopoverContent side="bottom" sideOffset={7} className="echo-tooltip">This is your current Wurd. It stays live for up to 24 hours.</PopoverContent></Popover>{canReplace && <button className="replace-word-icon" type="button" aria-label="Post today's Wurd" title="A new day has started" onClick={onReplace}><Clock3 /></button>}</div>
      <div className="today-meta-row"><p>{submittedAt ? timeLeft(submittedAt, now) : '24h left'} · {locationLabel(city, countryCode)}</p><EchoStat count={echoes} color={wordColorValues[color]} /></div>
    </header>
  );
  return <header className="cozy-header"><div className="cozy-logo">wurd</div></header>;
}

function EchoStat({ count, color, onActivate }: { count: number; color?: string; onActivate?: () => void }) {
  const contents = <><Waves /><span className="echo-total">{count}</span></>;
  if (onActivate) return <button type="button" className="echo-count" style={{ '--echo-color': color } as CSSProperties} aria-label={`${count} total echoes. Choose your echo strength.`} onClick={event => { event.stopPropagation(); onActivate(); }}>{contents}</button>;
  return (
    <Popover>
      <PopoverTrigger className="echo-count" style={{ '--echo-color': color } as CSSProperties} aria-label={`${count} echoes. Echoes show how many people feel the same way.`} onClick={event => event.stopPropagation()}>
        {contents}
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={7} className="echo-tooltip">Echoes show how many people feel the same way.</PopoverContent>
    </Popover>
  );
}

function wordLengthClass(word: string) {
  const length = Array.from(word).length;
  if (length >= 17) return 'word-fit-xlong';
  if (length >= 12) return 'word-fit-long';
  if (length >= 9) return 'word-fit-medium';
  return 'word-fit-short';
}

function CardWord({ word, emoji, color, wordStyle = 'bold', animation = 'still' }: { word: string; emoji?: string | null; color?: string; wordStyle?: WordStyle; animation?: WordAnimation }) {
  const frame = useRef<HTMLElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const frameElement = frame.current;
    const textElement = text.current;
    if (!frameElement || !textElement) return;

    const fit = () => {
      const availableWidth = frameElement.clientWidth;
      const naturalWidth = textElement.scrollWidth;
      setScale(availableWidth > 0 && naturalWidth > 0 ? Math.min(1, availableWidth / naturalWidth) : 1);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frameElement);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [word, emoji, wordStyle]);

  return <strong ref={frame} className={`live-word ${wordLengthClass(word)} word-style-${wordStyle} word-animation-${animation}`} style={{ color }}><span ref={text} className="live-word-content" style={{ '--word-scale': scale } as CSSProperties}>{word}{emoji && <span> {emoji}</span>}</span></strong>;
}

function LiveCard({ person, echoed, onEcho }: { person: typeof livePeople[number]; echoed: boolean; onEcho: () => void }) {
  const [name, , word, city, time, , count] = person;
  return (
    <article className={`live-card ${echoed ? 'echoed' : ''}`}>
      <button className="card-echo-action" aria-pressed={echoed} aria-label={`${name} chose ${word}. Tap to echo.`} onClick={onEcho}>
        <div className="live-person"><span><strong>{name.toLowerCase()}</strong><small>{city} · {time}</small></span></div>
        <CardWord word={word} />
      </button>
      <EchoStat count={count + (echoed ? 1 : 0)} />
    </article>
  );
}

function timeLeft(value: string, now = Date.now()) {
  const remaining = new Date(value).getTime() + 24 * 60 * 60 * 1000 - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return 'expired';
  if (remaining >= 60 * 60 * 1000) return `${Math.floor(remaining / (60 * 60 * 1000))}h left`;
  return `${Math.max(1, Math.floor(remaining / 60000))}m left`;
}

function FeedCard({ item, ownWord, now, friendState, previewStrength, pickerOpen, onPickerChange, onEcho, onFriendRequest }: { item: FeedWord; ownWord: string; now: number; friendState: CardFriendState; previewStrength?: number; pickerOpen: boolean; onPickerChange: (open: boolean) => void; onEcho: (strength: number) => Promise<void>; onFriendRequest: () => void }) {
  const name = usernameLabel(item.username);
  const match = item.word.toLocaleUpperCase() === ownWord.toLocaleUpperCase();
  const avatar = profilePhotoUrl(item.avatar_url);
  const storedStrength = item.my_echo_strength ?? (item.echoed_by_me ? 2 : 0);
  const strength = Math.max(0, Math.min(3, previewStrength ?? storedStrength));
  const [draftStrength, setDraftStrength] = useState(strength);
  const [echoBusy, setEchoBusy] = useState(false);
  const draftStrengthRef = useRef(strength);
  const wasPickerOpen = useRef(false);
  const activeStrength = pickerOpen ? draftStrength : strength;
  const strengthOption = echoStrengthOptions[Math.max(0, Math.min(3, draftStrength))];
  const otherEchoes = Math.max(0, item.echo_count - storedStrength);
  const displayedEchoes = otherEchoes + activeStrength;
  const content = <><div className="live-person">{avatar && <Avatar className="wurd-card-avatar"><AvatarImage src={avatar} alt="" /></Avatar>}<span><strong>{name}</strong><small>{item.city || 'Location not added'} · {timeLeft(item.created_at, now)}</small></span></div><CardWord word={item.word} emoji={item.emoji} color={wordColorValues[item.color]} wordStyle={item.word_style || 'bold'} animation={item.animation} /></>;
  const friendControl = friendState === 'none' ? <button type="button" className="card-friend-control" aria-label={`Send friend request to ${name}`} onClick={event => { event.stopPropagation(); onFriendRequest(); }}><UserPlus /></button> : friendState === 'outgoing' ? <span className="card-friend-control pending" aria-label={`Friend request to ${name} is pending`} title="Request pending"><Clock3 /></span> : null;
  const cardStyle = { '--word-color': wordColorValues[item.color] } as CSSProperties;
  useEffect(() => {
    if (pickerOpen) {
      draftStrengthRef.current = strength;
      setDraftStrength(strength);
    } else if (wasPickerOpen.current && draftStrengthRef.current !== strength) {
      setEchoBusy(true);
      void onEcho(draftStrengthRef.current).finally(() => setEchoBusy(false));
    }
    wasPickerOpen.current = pickerOpen;
  }, [pickerOpen]);
  const toggleEchoPicker = () => onPickerChange(!pickerOpen);
  if (match) return <article className="live-card friend-square exact-match" style={cardStyle} aria-label={`${name} chose the same word as you`}>{friendControl}<div className="card-static-content">{content}</div><EchoStat count={item.echo_count} color={wordColorValues[item.color]} /></article>;
  return <article data-echo-card={String(item.id)} className={`live-card friend-square ${activeStrength > 0 ? 'echoed' : ''} ${pickerOpen ? 'echo-picker-open' : ''}`} style={cardStyle}>{friendControl}<button type="button" className="card-echo-action" aria-pressed={activeStrength > 0} aria-expanded={pickerOpen} aria-label={`${name} chose ${item.word}. Choose your echo strength.`} onClick={toggleEchoPicker}>{content}</button>{pickerOpen && <div className="echo-strength-inline" style={{ '--word-color': wordColorValues[item.color], '--echo-strength-color': strengthOption.color } as CSSProperties} onClick={toggleEchoPicker}><div className="echo-strength-title"><span>How loud?</span><b>{strengthOption.label}</b></div><div className="echo-strength-control" onClick={event => event.stopPropagation()}><span className="echo-strength-dots" aria-hidden="true"><i /><i /><i /><i /></span><Slider min={0} max={3} step={1} value={[draftStrength]} disabled={echoBusy} onValueChange={value => { const next = Array.isArray(value) ? value[0] : value; draftStrengthRef.current = next; setDraftStrength(next); }} aria-label="Echo strength: Meh, Okay, or Wurd" /></div></div>}<EchoStat count={displayedEchoes} color={wordColorValues[item.color]} onActivate={toggleEchoPicker} /></article>;
}

type TodayTabProps = {
  submitted: string;
  replacementMode: boolean;
  level: number;
  feed: FeedWord[];
  feedLoading: boolean;
  now: number;
  spokeCount: number;
  feedMode: FeedMode;
  setFeedMode: (mode: FeedMode) => void;
  setSubmitted: (post: PostWordInput) => Promise<void>;
  refreshFeed: () => Promise<void>;
  friendStateFor: (userId: string) => CardFriendState;
  sendFriendRequest: (userId: string) => Promise<boolean>;
  echoStrengths: Record<string, number>;
  echoed: string[];
  setEchoStrength: (id: number | string, strength: number) => Promise<void>;
};

function TodayTab({ submitted, replacementMode, level, feed, feedLoading, now, spokeCount, feedMode, setFeedMode, setSubmitted, refreshFeed, friendStateFor, sendFriendRequest, echoStrengths, echoed, setEchoStrength }: TodayTabProps) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [color, setColor] = useState<WordColor>('mint');
  const [wordStyle, setWordStyle] = useState<WordStyle>('bold');
  const [animation, setAnimation] = useState<WordAnimation>('still');
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  const [friendTarget, setFriendTarget] = useState<FeedWord | null>(null);
  const [friendRequestState, setFriendRequestState] = useState<'confirm' | 'sending' | 'sent'>('confirm');
  const [openEchoCardId, setOpenEchoCardId] = useState<string | null>(null);
  useEffect(() => {
    if (!openEchoCardId) return;
    const closeOnOutsidePress = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-echo-card]')?.getAttribute('data-echo-card') === openEchoCardId) return;
      setOpenEchoCardId(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [openEchoCardId]);
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean || /\s/.test(clean)) { setError('Just one word — no spaces.'); return; }
    setPending(clean.toUpperCase());
  }
  if (!submitted || replacementMode) return (
    <section className="tab-view today-view"><div className="daily-prompt">
      {!pending ? <><span className="soft-icon"><Sun /></span><p>{todayDateTimeLabel()}</p><h1>What&apos;s your<br />word?</h1><form onSubmit={submit}><Input maxLength={20} value={draft} onChange={event => { setDraft(event.target.value); setError(''); }} placeholder="TYPE YOUR WORD" /><Button type="submit">Continue</Button></form>{error && <em>{error}</em>}</> :
      <div className="confirm-word"><span>YOUR WORD FOR {todayLabel().toUpperCase()}</span><h2 className={`word-style-${wordStyle} word-animation-${animation}`} style={{ color: wordColorValues[color] }}>{pending}{emoji && ` ${emoji}`}</h2><p>{replacementMode ? 'Posting this Wurd will remove your current active Wurd.' : 'This is the only Wurd you can post today.'}</p>
        {level >= 2 && <div className="reward-customizer">
          <section><b>FONT</b><div className="style-options">{wordStyleChoices.filter(item => level >= item.level).map(item => <button className={`${wordStyle === item.value ? 'active ' : ''}word-style-${item.value}`} onClick={() => setWordStyle(item.value)} key={item.value}>{item.label}</button>)}</div></section>
          {level >= 3 && (level >= 8 ? <section><b>USE ANY EMOJI</b><label className="any-emoji-input solo"><Input value={emoji || ''} onChange={event => { const next = oneEmoji(event.target.value); if (next !== undefined) setEmoji(next); }} placeholder="😊" aria-label="Use any one emoji" /><span>One emoji, placed after your Wurd.</span></label></section> : <section><b>ADD ONE EMOJI</b><div className="emoji-options"><button className={!emoji ? 'active' : ''} onClick={() => setEmoji(null)}>None</button>{emojiChoices.map(item => <button className={emoji === item ? 'active' : ''} onClick={() => setEmoji(item)} key={item}>{item}</button>)}</div></section>)}
          {level >= 4 && <section><b>COLOR</b><div className="color-options">{wordColorChoices.filter(item => level >= item.level).map(item => <button className={color === item.value ? 'active' : ''} style={{ background: wordColorValues[item.value] }} aria-label={`${item.label} color`} onClick={() => setColor(item.value)} key={item.value} />)}</div></section>}
          {level >= 9 && <section><b>ANIMATION</b><div className="animation-options">{animationChoices.map(item => <button className={animation === item.value ? 'active' : ''} onClick={() => setAnimation(item.value)} key={item.value}>{item.label}</button>)}</div></section>}
        </div>}
        {error && <em className="post-error">{error}</em>}
        <div className="confirm-actions"><Button variant="outline" disabled={posting} onClick={() => setPending('')}>Go back</Button><Button disabled={posting} onClick={async () => { setPosting(true); setError(''); try { await setSubmitted({ word: pending, emoji, color, wordStyle, animation }); setPending(''); setDraft(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not post your word.'); } finally { setPosting(false); } }}>{posting ? 'Posting…' : replacementMode ? 'Replace & post' : 'Post my word'}</Button></div>
      </div>}
    </div></section>
  );
  const demoPeople = feedMode === 'New' ? [...livePeople] : [...livePeople].sort((left, right) => right[6] - left[6]);
  const demoFriends = [...friends].sort((left, right) => right.echoes - left.echoes);
  return (
    <section className="tab-view live-view">
      <div className="today-toolbar"><div className="today-feed-summary"><span><i />{isSupabaseConfigured ? `${spokeCount} posted` : feedMode === 'Friends' ? '8 friends posted' : '1,284 posted'}</span><small>Tap someone&apos;s wurd to echo it.</small></div><div className="today-controls"><div className="today-mode cozy-segments"><button className={feedMode === 'New' ? 'active' : ''} onClick={() => setFeedMode('New')}>New</button><button className={feedMode === 'Top' ? 'active' : ''} onClick={() => setFeedMode('Top')}>Top</button><button className={feedMode === 'Friends' ? 'active' : ''} onClick={() => setFeedMode('Friends')}>Friends</button></div><button className="feed-refresh" aria-label="Refresh today" title="Refresh" disabled={feedLoading} onClick={() => void refreshFeed()}><RefreshCw /></button></div></div>
      {isSupabaseConfigured ? <div className={feedMode === 'Friends' ? 'friends-card-grid' : 'live-grid'}>{feedLoading ? <p className="feed-empty">Finding today&apos;s words…</p> : feed.length ? feed.map(item => <FeedCard key={item.id} item={item} ownWord={submitted} now={now} friendState={friendStateFor(item.user_id)} previewStrength={echoStrengths[String(item.id)]} pickerOpen={openEchoCardId === String(item.id)} onPickerChange={open => setOpenEchoCardId(open ? String(item.id) : null)} onFriendRequest={() => { setFriendRequestState('confirm'); setFriendTarget(item); }} onEcho={strength => setEchoStrength(item.id, strength)} />) : <p className="feed-empty">{feedMode === 'Friends' ? 'Your friends have not spoken yet.' : 'You are early. Today’s words will appear here.'}</p>}</div> : feedMode === 'Friends' ? <div className="friends-card-grid">{demoFriends.map(friend => <FriendCard key={friend.id} friend={friend} match={friend.word === submitted} echoed={echoed.includes(friend.id)} onEcho={() => void setEchoStrength(friend.id, echoed.includes(friend.id) ? 0 : 3)} />)}</div> : <div className="live-grid">{demoPeople.map((person, index) => <LiveCard key={`${person[0]}-${person[2]}`} person={person} echoed={echoed.includes(`live-${index}`)} onEcho={() => void setEchoStrength(`live-${index}`, echoed.includes(`live-${index}`) ? 0 : 3)} />)}</div>}
      <Dialog open={friendTarget !== null} onOpenChange={open => { if (!open && friendRequestState !== 'sending') setFriendTarget(null); }}><DialogContent className="friend-request-dialog"><DialogHeader><DialogTitle>{friendRequestState === 'sent' ? 'Request sent' : `Send friend request to ${usernameLabel(friendTarget?.username)}?`}</DialogTitle>{friendRequestState === 'sent' && <DialogDescription>They’ll see it in Friends.</DialogDescription>}</DialogHeader>{friendRequestState !== 'sent' && <div className="replacement-actions"><Button variant="outline" disabled={friendRequestState === 'sending'} onClick={() => setFriendTarget(null)}>Cancel</Button><Button disabled={friendRequestState === 'sending'} onClick={async () => { if (!friendTarget) return; setFriendRequestState('sending'); const sent = await sendFriendRequest(friendTarget.user_id); if (!sent) { setFriendRequestState('confirm'); return; } setFriendRequestState('sent'); window.setTimeout(() => setFriendTarget(null), 1100); }}>{friendRequestState === 'sending' ? 'Sending…' : 'Send'}</Button></div>}</DialogContent></Dialog>
    </section>
  );
}

function FriendCard({ friend, match, echoed, onEcho }: { friend: typeof friends[number]; match: boolean; echoed: boolean; onEcho: () => void }) {
  const content = <><div className="live-person"><span><strong>{usernameLabel(friend.handle)}</strong><small>{friendCities[friend.id]} · {friend.time} ago</small></span></div><CardWord word={friend.word} /></>;
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

function YouTab({ history, incomingRequestCount, onOpenPanel }: { history: DiaryWord[]; incomingRequestCount: number; onOpenPanel: (panel: Exclude<YouPanel, null>) => void }) {
  const dayTrack = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (dayTrack.current) dayTrack.current.scrollTop = dayTrack.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const diary = [...history].reverse().map(item => {
    const date = new Date(`${item.local_date}T12:00:00`);
    return { id: item.id, weekday: new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date), day: new Intl.DateTimeFormat('en', { day: 'numeric' }).format(date), month: new Intl.DateTimeFormat('en', { month: 'short' }).format(date), word: item.word, emoji: item.emoji, color: item.color, wordStyle: item.word_style || 'bold', animation: item.animation || 'still', city: item.city, echoes: item.echo_count, isToday: item.local_date === localDayKey() };
  });
  return (
    <section className="tab-view you-view">
      <div className="you-actions" aria-label="People and account tools">
        <button onClick={() => onOpenPanel('search')}><Search /><span>Search</span></button>
        <button onClick={() => onOpenPanel('friends')}><UsersRound /><span>Friends</span>{incomingRequestCount > 0 && <b className="friends-request-badge" aria-label={`${incomingRequestCount} incoming friend ${incomingRequestCount === 1 ? 'request' : 'requests'}`}>{incomingRequestCount > 9 ? '9+' : incomingRequestCount}</b>}</button>
        <button onClick={() => onOpenPanel('xp')}><Trophy /><span>XP</span></button>
        <button onClick={() => onOpenPanel('settings')}><Settings /><span>Settings</span></button>
      </div>
      {diary.length > 0 && <div className="calendar-swipe-cue">SWIPE DAYS ↑</div>}
      {diary.length > 0 ? <div className="day-ribbon" ref={dayTrack} aria-label="Your recent words">{diary.map(item => <article className={`diary-day-card ${item.isToday ? 'is-today' : ''}`} key={item.id}><span>{item.weekday}</span><div className="day-date"><i>{item.month}</i><strong>{item.day}</strong></div><b className={`word-style-${item.wordStyle} word-animation-${item.animation}`} style={{ color: wordColorValues[item.color] }}>{item.word}{item.emoji && ` ${item.emoji}`}</b><small className="diary-location"><MapPin />{item.city || 'Location not added'}</small><EchoStat count={item.echoes} />{item.isToday && <em>TODAY</em>}</article>)}</div> : <div className="diary-empty"><span><Sun /></span><h2>Your words start here.</h2><p>Post your first word and it will become the first day in your story.</p></div>}
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
  sendFriendRequest: (id: string) => Promise<boolean>;
  acceptFriend: (id: number) => Promise<void>;
  declineFriend: (id: number) => Promise<void>;
  xp: number;
  level: number;
  streak: number;
  saveSettings: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  signOut: () => Promise<void>;
  usernameDraft: string;
  setUsernameDraft: (value: string) => void;
  cityDraft: string;
  setCityDraft: (value: string) => void;
  citySelection: CityChoice | null;
  setCitySelection: (value: CityChoice | null) => void;
  profilePhoto: string;
  saveProfilePhoto: (photo: Blob) => Promise<void>;
  removeProfilePhoto: () => Promise<void>;
  busy: boolean;
};

function YouToolsDialog(props: YouToolsDialogProps) {
  const ladder = useRef<HTMLDivElement>(null);
  const cropFrame = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number } | null>(null);
  const [photoCrop, setPhotoCrop] = useState<PhotoCropDraft | null>(null);
  const [photoScale, setPhotoScale] = useState(1);
  const [photoOffset, setPhotoOffset] = useState({ x: 0, y: 0 });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => () => {
    if (photoCrop) URL.revokeObjectURL(photoCrop.src);
  }, [photoCrop]);

  function closePhotoCrop() {
    setPhotoCrop(null);
    setPhotoScale(1);
    setPhotoOffset({ x: 0, y: 0 });
    setPhotoError('');
  }

  function chooseProfilePhoto(file?: File) {
    if (!file) return;
    setPhotoError('');
    if (!file.type.startsWith('image/')) { setPhotoError('Choose an image file.'); return; }
    if (file.size > 15 * 1024 * 1024) { setPhotoError('Choose an image smaller than 15 MB.'); return; }
    const src = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setPhotoScale(1);
      setPhotoOffset({ x: 0, y: 0 });
      setPhotoCrop({ src, image, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => { URL.revokeObjectURL(src); setPhotoError('That image could not be opened.'); };
    image.src = src;
  }

  function startPhotoDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!photoCrop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, offsetX: photoOffset.x, offsetY: photoOffset.y };
  }

  function movePhoto(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start) return;
    setPhotoOffset({ x: start.offsetX + event.clientX - start.pointerX, y: start.offsetY + event.clientY - start.pointerY });
  }

  async function useCroppedPhoto() {
    if (!photoCrop || !cropFrame.current) return;
    setPhotoBusy(true);
    setPhotoError('');
    try {
      const frameSize = cropFrame.current.getBoundingClientRect().width;
      if (!frameSize) throw new Error('Photo preview is not ready.');
      const outputSize = 256;
      const ratio = photoCrop.width / photoCrop.height;
      const baseWidth = ratio >= 1 ? frameSize : frameSize * ratio;
      const baseHeight = ratio >= 1 ? frameSize / ratio : frameSize;
      const drawWidth = baseWidth * photoScale;
      const drawHeight = baseHeight * photoScale;
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo editor is not available.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, outputSize, outputSize);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      const outputRatio = outputSize / frameSize;
      context.drawImage(
        photoCrop.image,
        ((frameSize - drawWidth) / 2 + photoOffset.x) * outputRatio,
        ((frameSize - drawHeight) / 2 + photoOffset.y) * outputRatio,
        drawWidth * outputRatio,
        drawHeight * outputRatio,
      );
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare this photo.')), 'image/webp', 0.9));
      await props.saveProfilePhoto(blob);
      closePhotoCrop();
    } catch (reason) {
      setPhotoError(readableError(reason, 'Could not save this photo.'));
    } finally {
      setPhotoBusy(false);
    }
  }

  useEffect(() => {
    if (props.panel !== 'xp') return;
    const frame = window.requestAnimationFrame(() => {
      const currentRow = ladder.current?.querySelector<HTMLElement>('.xp-level-row.current');
      if (ladder.current && currentRow) ladder.current.scrollTop = Math.max(0, currentRow.offsetTop - ladder.current.clientHeight / 2 + currentRow.clientHeight / 2);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [props.panel]);
  const relationFor = (id: string) => props.connections.find(item => item.other.id === id);
  const incoming = props.connections.filter(item => item.status === 'pending' && item.addressee_id === props.userId);
  const outgoing = props.connections.filter(item => item.status === 'pending' && item.requester_id === props.userId);
  const accepted = props.connections.filter(item => item.status === 'accepted');
  const xpProgress = levelProgressFor(props.xp, props.level);
  const nextLevel = levelDefinitions[props.level];
  return (<>
    <Dialog open={props.panel !== null && photoCrop === null} onOpenChange={open => { if (!open && !photoCrop) props.setPanel(null); }}>
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
          <DialogHeader><DialogTitle>Friends</DialogTitle><DialogDescription>Accept requests or see your people.</DialogDescription></DialogHeader>
          <div className="people-list friendship-list">
            {incoming.map(item => <div className="person-row" key={item.id}><div><strong>{usernameLabel(item.other.username)}</strong><small>Wants to be friends</small></div><div className="request-response-actions"><Button size="sm" variant="outline" onClick={() => void props.declineFriend(item.id)} disabled={props.busy}>Decline</Button><Button size="sm" onClick={() => void props.acceptFriend(item.id)} disabled={props.busy}><Check /> Accept</Button></div></div>)}
            {outgoing.map(item => <div className="person-row" key={item.id}><div><strong>{usernameLabel(item.other.username)}</strong><small>Request sent</small></div><span className="status-chip">Pending</span></div>)}
            {accepted.map(item => <div className="person-row" key={item.id}><div><strong>{usernameLabel(item.other.username)}</strong><small><MapPin />{item.other.city || 'Location not added'}</small></div><span className="status-chip"><Check /> Friends</span></div>)}
            {props.connections.length === 0 && <p className="panel-empty">No friends or requests yet. Search for someone to get started.</p>}
          </div>
        </>}
        {props.panel === 'xp' && <>
          <DialogHeader><DialogTitle>Your XP</DialogTitle><DialogDescription>Every Wurd, friendship, and echo received moves you forward.</DialogDescription></DialogHeader>
          <section className="xp-summary-card"><div><span>LEVEL</span><strong>{props.level}</strong><small><Flame /> {props.streak} day streak</small></div><div className="xp-summary-progress"><strong>{props.level >= 10 ? `${xpProgress.earned} XP` : `${xpProgress.earned} / ${xpProgress.required} XP`}</strong><i><b style={{ width: `${xpProgress.percent}%` }} /></i><small>{nextLevel ? `${xpProgress.remaining} XP to Level ${nextLevel.level}` : 'Highest level reached'}</small></div>{nextLevel && <p><span>NEXT UNLOCK</span><strong>???</strong></p>}</section>
          <div className="xp-ladder" ref={ladder} aria-label="Level progression"><div className="xp-ladder-more" aria-label="More levels coming"><i /><span>•••</span></div>{[...levelDefinitions].reverse().map(item => {
            const state = item.level < props.level ? 'completed' : item.level === props.level ? 'current' : 'upcoming';
            const reward = item.level <= props.level ? item.reward : '???';
            return <article className={`xp-level-row ${state}`} key={item.level}><span className="xp-level-node">{state === 'completed' ? <Check /> : state === 'current' ? item.level : <Lock />}</span><div><strong>Level {item.level}</strong><small>{reward}</small></div><b>{item.threshold.toLocaleString()} XP</b></article>;
          })}</div>
        </>}
        {props.panel === 'settings' && <>
          <DialogHeader><DialogTitle>Settings</DialogTitle><DialogDescription>Change the name and city people see beside your word.</DialogDescription></DialogHeader>
          {props.level >= 5 && <section className="profile-photo-setting">
            <div className="profile-photo-preview">{props.profilePhoto ? <img src={props.profilePhoto} alt="Your profile preview" /> : <CircleUserRound />}</div>
            <div><strong>Profile photo</strong><small>Shown as a small circle beside your Wurds.</small><div className="profile-photo-actions"><label htmlFor="profile-photo-input">{props.profilePhoto ? 'Change photo' : 'Choose photo'}</label>{props.profilePhoto && <button type="button" disabled={photoBusy || props.busy} onClick={() => void props.removeProfilePhoto()}>Remove</button>}</div></div>
            <input id="profile-photo-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
              const file = event.target.files?.[0];
              chooseProfilePhoto(file);
              event.target.value = '';
            }} />
            {photoError && !photoCrop && <em className="profile-photo-error">{photoError}</em>}
          </section>}
          <form className="settings-form" onSubmit={event => void props.saveSettings(event)}><label htmlFor="settings-username">Username</label><Input id="settings-username" maxLength={24} value={props.usernameDraft} onChange={event => props.setUsernameDraft(event.target.value)} /><label htmlFor="settings-city">City</label><CityPicker id="settings-city" query={props.cityDraft} selected={props.citySelection} onQueryChange={props.setCityDraft} onSelect={props.setCitySelection} /><Button type="submit" disabled={props.busy}>Save changes</Button></form>
          <Button className="logout-button" variant="outline" onClick={() => void props.signOut()}><LogOut /> Log out</Button>
        </>}
      </DialogContent>
    </Dialog>
    <Dialog open={photoCrop !== null} onOpenChange={open => { if (!open && !photoBusy) closePhotoCrop(); }}>
        <DialogContent className="photo-crop-dialog">
          <DialogHeader><DialogTitle>Position your photo</DialogTitle><DialogDescription>Drag freely and zoom. The circle is exactly what other people will see.</DialogDescription></DialogHeader>
          {photoCrop && <>
            <div ref={cropFrame} className="photo-crop-frame" onPointerDown={startPhotoDrag} onPointerMove={movePhoto} onPointerUp={() => { dragStart.current = null; }} onPointerCancel={() => { dragStart.current = null; }}>
              <img draggable={false} src={photoCrop.src} alt="Profile crop preview" style={{ width: photoCrop.width >= photoCrop.height ? '100%' : 'auto', height: photoCrop.height > photoCrop.width ? '100%' : 'auto', transform: `translate(calc(-50% + ${photoOffset.x}px), calc(-50% + ${photoOffset.y}px)) scale(${photoScale})` }} />
            </div>
            <label className="photo-zoom"><span>Zoom</span><Slider min={0.25} max={5} step={0.01} value={[photoScale]} onValueChange={value => setPhotoScale(Array.isArray(value) ? value[0] : value)} aria-label="Photo zoom" /></label>
            {photoError && <em className="profile-photo-error">{photoError}</em>}
            <div className="replacement-actions"><Button variant="outline" disabled={photoBusy} onClick={closePhotoCrop}>Cancel</Button><Button disabled={photoBusy} onClick={() => void useCroppedPhoto()}>{photoBusy ? 'Saving…' : 'Use photo'}</Button></div>
          </>}
        </DialogContent>
    </Dialog>
  </>);
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
  const [submittedLocalDate, setSubmittedLocalDate] = useState<string | null>(null);
  const [submittedEmoji, setSubmittedEmoji] = useState<string | null>(null);
  const [submittedColor, setSubmittedColor] = useState<WordColor>('mint');
  const [submittedWordStyle, setSubmittedWordStyle] = useState<WordStyle>('bold');
  const [submittedAnimation, setSubmittedAnimation] = useState<WordAnimation>('still');
  const [echoed, setEchoed] = useState<string[]>([]);
  const [echoStrengths, setEchoStrengths] = useState<Record<string, number>>({});
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<WurdProfile | null>(null);
  const [feed, setFeed] = useState<FeedWord[]>([]);
  const [spokeCount, setSpokeCount] = useState(0);
  const [history, setHistory] = useState<DiaryWord[]>([]);
  const [connections, setConnections] = useState<Friendship[]>([]);
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [youPanel, setYouPanel] = useState<YouPanel>(null);
  const [feedMode, setFeedMode] = useState<FeedMode>('New');
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [feedLoading, setFeedLoading] = useState(false);
  const [appError, setAppError] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [cityDraft, setCityDraft] = useState('');
  const [citySelection, setCitySelection] = useState<CityChoice | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(() => isLevelTenPreview() ? window.localStorage.getItem('wurd:preview-profile-photo') || '' : '');
  const [clockNow, setClockNow] = useState(Date.now);
  const [replacementStep, setReplacementStep] = useState<'explain' | 'confirm' | null>(null);
  const [replacementMode, setReplacementMode] = useState(false);
  const friendSearchTimer = useRef<number | null>(null);

  async function loadAccount(activeUser: User) {
    if (!supabase) return;
    setFeedLoading(true);
    try {
      const [profileResult, historyResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', activeUser.id).single(),
        supabase.rpc('my_word_history', { p_limit: 14 }),
      ]);
      let wordResult = await supabase.from('daily_words').select('id, local_date, word, emoji, color, word_style, animation, created_at').eq('user_id', activeUser.id).gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).lte('created_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1);
      // Keeps localhost usable until the V2 database migration is released.
      if (wordResult.error && /animation/i.test(wordResult.error.message)) {
        wordResult = await supabase.from('daily_words').select('id, local_date, word, emoji, color, word_style, created_at').eq('user_id', activeUser.id).gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).lte('created_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1) as typeof wordResult;
      }
      if (profileResult.error) throw profileResult.error;
      if (wordResult.error) throw wordResult.error;
      if (historyResult.error) throw historyResult.error;
      const loadedProfile = profileResult.data as WurdProfile;
      setProfile(loadedProfile);
      if (!isLevelTenPreview() || !window.localStorage.getItem('wurd:preview-profile-photo')) {
        setProfilePhotoPreview(profilePhotoUrl(loadedProfile.avatar_url, loadedProfile.updated_at));
      }
      setUsernameDraft(loadedProfile.username.startsWith('wurd_') ? '' : loadedProfile.username);
      setCityDraft(loadedProfile.city || '');
      setCitySelection(loadedProfile.city ? { name: loadedProfile.city, country: '', countryCode: loadedProfile.country_code || '' } : null);
      setHistory(((historyResult.data || []) as DiaryWord[]).filter(item => item.local_date >= diaryLaunchDate));
      const activeWord = wordResult.data?.[0];
      if (activeWord) {
        setSubmittedState(activeWord.word);
        setSubmittedEmoji(activeWord.emoji);
        setSubmittedColor(activeWord.color as WordColor);
        setSubmittedWordStyle((activeWord.word_style as WordStyle) || 'bold');
        setSubmittedAnimation((activeWord.animation as WordAnimation) || 'still');
        setSubmittedAt(activeWord.created_at);
        setSubmittedLocalDate(activeWord.local_date);
      } else {
        setSubmittedState('');
        setSubmittedEmoji(null);
        setSubmittedColor('mint');
        setSubmittedWordStyle('bold');
        setSubmittedAnimation('still');
        setSubmittedAt(null);
        setSubmittedLocalDate(null);
      }
    } finally {
      setFeedLoading(false);
    }
  }

  async function loadFeed(mode = feedMode, activeUser = user) {
    if (!supabase || !activeUser) return;
    setFeedLoading(true);
    const result = await supabase.rpc('feed_words', { p_date: localDayKey(), p_limit: 0, p_friends_only: mode === 'Friends' });
    setFeedLoading(false);
    if (result.error) throw result.error;
    const rows = (result.data || []) as FeedWord[];
    setSpokeCount(rows[0]?.spoke_count || 0);
    const latestByUser = new Map<string, FeedWord>();
    for (const item of [...rows].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())) {
      if (!latestByUser.has(item.user_id)) latestByUser.set(item.user_id, item);
    }
    const visibleRows = rows.filter(item => item.user_id !== activeUser.id && isWithinTodayWindow(item.created_at) && latestByUser.get(item.user_id)?.id === item.id);
    const sortedRows = [...visibleRows].sort((left, right) => {
      const recency = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      if (mode === 'New') return recency;
      return right.echo_count - left.echo_count || recency;
    });
    setFeed(sortedRows);
  }

  async function loadConnections(activeUser = user) {
    if (!supabase || !activeUser) return;
    const result = await supabase.from('friendships').select('id, requester_id, addressee_id, status').or(`requester_id.eq.${activeUser.id},addressee_id.eq.${activeUser.id}`).order('created_at', { ascending: false });
    if (result.error) throw result.error;
    const rows = ((result.data || []) as Omit<Friendship, 'other'>[]).filter(item => item.status !== 'declined');
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
      else { setProfile(null); setProfilePhotoPreview(''); setSubmittedState(''); setSubmittedAt(null); setSubmittedLocalDate(null); setFeed([]); setHistory([]); setConnections([]); }
    });
    return () => { live = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
      const nextDay = localDayKey();
      if (nextDay !== dayKey) setDayKey(nextDay);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [dayKey]);

  useEffect(() => {
    if (!user) return;
    setReplacementMode(false);
    setReplacementStep(null);
    void loadAccount(user).catch(reason => setAppError(readableError(reason, 'Could not load your account.')));
  }, [dayKey]);

  useEffect(() => {
    if (!user || !submitted || tab !== 'today') return;
    void loadFeed(feedMode, user).catch(reason => setAppError(readableError(reason, 'Could not load today’s words.')));
  }, [user, submitted, feedMode, tab]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    const savedActive = window.localStorage.getItem('wurd:active');
    let active: (PostWordInput & { localDate: string; createdAt: string }) | null = null;
    try { active = savedActive ? JSON.parse(savedActive) : null; } catch { active = null; }
    if (active && !isWithinTodayWindow(active.createdAt)) active = null;
    const word = active?.word || window.localStorage.getItem(`wurd:daily:${dayKey}`) || '';
    const savedPost = active ? JSON.stringify(active) : window.localStorage.getItem(`wurd:post:${dayKey}`);
    const savedEchoes = window.localStorage.getItem(`wurd:echoes:${dayKey}`);
    setSubmittedState(word);
    setSubmittedAt(active?.createdAt || window.localStorage.getItem(`wurd:posted-at:${dayKey}`));
    setSubmittedLocalDate(active?.localDate || (word ? dayKey : null));
    if (savedPost) { try { const post = JSON.parse(savedPost) as PostWordInput; setSubmittedEmoji(post.emoji); setSubmittedColor(post.color); setSubmittedWordStyle(post.wordStyle || 'bold'); setSubmittedAnimation(post.animation || 'still'); } catch { /* supports older local saves */ } }
    try { setEchoed(savedEchoes ? JSON.parse(savedEchoes) : []); } catch { setEchoed([]); }
    if (!word) setTab('today');
  }, [dayKey]);

  async function postWord(post: PostWordInput) {
    if (isLevelTenPreview()) {
      setSubmittedState(post.word);
      setSubmittedAt(new Date().toISOString());
      setSubmittedLocalDate(dayKey);
      setSubmittedEmoji(post.emoji);
      setSubmittedColor(post.color);
      setSubmittedWordStyle(post.wordStyle);
      setSubmittedAnimation(post.animation || 'still');
      setReplacementMode(false);
      return;
    }
    if (supabase && user) {
      let result = await supabase.rpc('post_daily_word', { p_word: post.word, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, p_emoji: post.emoji, p_color: post.color, p_city: profile?.city || null, p_country_code: profile?.country_code || null, p_word_style: post.wordStyle, p_animation: post.animation || 'still' });
      if (import.meta.env.DEV && result.error?.code === 'PGRST202') {
        result = await supabase.rpc('post_daily_word', { p_word: post.word, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, p_emoji: post.emoji, p_color: post.color, p_city: profile?.city || null, p_country_code: profile?.country_code || null, p_word_style: post.wordStyle });
      }
      if (result.error) throw result.error;
      setSubmittedState(post.word);
      setSubmittedAt(new Date().toISOString());
      setSubmittedLocalDate(localDayKey());
      setSubmittedEmoji(post.emoji);
      setSubmittedColor(post.color);
      setSubmittedWordStyle(post.wordStyle);
      setSubmittedAnimation(post.animation || 'still');
      await loadAccount(user);
      setReplacementMode(false);
      return;
    }
    setSubmittedState(post.word);
    const postedAt = new Date().toISOString();
    setSubmittedAt(postedAt);
    setSubmittedLocalDate(dayKey);
    setSubmittedEmoji(post.emoji);
    setSubmittedColor(post.color);
    setSubmittedWordStyle(post.wordStyle);
    setSubmittedAnimation(post.animation || 'still');
    window.localStorage.setItem(`wurd:daily:${dayKey}`, post.word);
    window.localStorage.setItem(`wurd:post:${dayKey}`, JSON.stringify(post));
    window.localStorage.setItem(`wurd:posted-at:${dayKey}`, postedAt);
    window.localStorage.setItem('wurd:active', JSON.stringify({ ...post, localDate: dayKey, createdAt: postedAt }));
    setReplacementMode(false);
  }
  async function setEchoStrength(id: number | string, strength: number) {
    const normalizedStrength = Math.max(0, Math.min(3, Math.round(strength)));
    if (import.meta.env.DEV || typeof id !== 'number') {
      const localId = String(id);
      setEchoStrengths(current => ({ ...current, [localId]: normalizedStrength }));
      setEchoed(current => normalizedStrength > 0 ? [...new Set([...current, localId])] : current.filter(item => item !== localId));
      return;
    }
    if (supabase && user) {
      const result = normalizedStrength === 0
        ? await supabase.rpc('un_echo_word', { p_daily_word_id: id })
        : await supabase.rpc('set_echo_strength', { p_daily_word_id: id, p_strength: normalizedStrength });
      if (result.error) { setAppError(result.error.message); return; }
      await Promise.all([loadFeed(feedMode, user), loadAccount(user)]);
    }
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
    if (!supabase || !user) return false;
    setAccountBusy(true);
    const { error } = await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' });
    setAccountBusy(false);
    if (error) { setAppError(error.code === '23505' ? 'A request already exists between you.' : error.message); return false; }
    await loadConnections(user);
    return true;
  }

  async function acceptFriend(friendshipId: number) {
    if (!supabase || !user) return;
    setAccountBusy(true);
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId).eq('addressee_id', user.id);
    setAccountBusy(false);
    if (error) { setAppError(error.message); return; }
    await Promise.all([loadConnections(user), loadAccount(user), submitted ? loadFeed(feedMode, user) : Promise.resolve()]);
  }

  async function declineFriend(friendshipId: number) {
    if (!supabase || !user) return;
    setAccountBusy(true);
    const { error } = await supabase.from('friendships').update({ status: 'declined' }).eq('id', friendshipId).eq('addressee_id', user.id);
    setAccountBusy(false);
    if (error) { setAppError(error.message); return; }
    await loadConnections(user);
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

  async function saveProfilePhoto(photo: Blob) {
    if (isLevelTenPreview()) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not prepare this photo.'));
        reader.onerror = () => reject(new Error('Could not prepare this photo.'));
        reader.readAsDataURL(photo);
      });
      window.localStorage.setItem('wurd:preview-profile-photo', dataUrl);
      setProfilePhotoPreview(dataUrl);
      return;
    }
    if (!supabase || !user) throw new Error('Sign in to save a profile photo.');
    setAccountBusy(true);
    try {
      const path = `${user.id}/avatar.webp`;
      const upload = await supabase.storage.from('avatars').upload(path, photo, { contentType: 'image/webp', cacheControl: '60', upsert: true });
      if (upload.error) throw upload.error;
      const saved = await supabase.rpc('set_profile_avatar', { p_path: path });
      if (saved.error) throw saved.error;
      setProfilePhotoPreview(`${profilePhotoUrl(path)}?v=${Date.now()}`);
      await loadAccount(user);
    } finally {
      setAccountBusy(false);
    }
  }

  async function removeProfilePhoto() {
    if (isLevelTenPreview()) {
      window.localStorage.removeItem('wurd:preview-profile-photo');
      setProfilePhotoPreview('');
      return;
    }
    if (!supabase || !user) return;
    setAccountBusy(true);
    try {
      const cleared = await supabase.rpc('set_profile_avatar', { p_path: null });
      if (cleared.error) throw cleared.error;
      const removed = await supabase.storage.from('avatars').remove([`${user.id}/avatar.webp`]);
      if (removed.error) throw removed.error;
      setProfilePhotoPreview('');
      await loadAccount(user);
    } catch (reason) {
      setAppError(readableError(reason, 'Could not remove your profile photo.'));
    } finally {
      setAccountBusy(false);
    }
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

  const realXp = profile?.xp ?? 852 + echoed.length;
  const levelTenPreview = isLevelTenPreview();
  const xp = levelTenPreview ? 5380 : realXp;
  const level = levelForXp(xp);
  const streak = profile?.streak_days ?? 12;
  const activeSubmitted = submittedAt && isWithinTodayWindow(submittedAt, clockNow) ? submitted : '';
  const hasPostedToday = isSupabaseConfigured ? history.some(item => item.local_date === dayKey) : Boolean(window.localStorage.getItem(`wurd:daily:${dayKey}`));
  const replacementPreview = import.meta.env.DEV && ['replacement', 'level10'].includes(new URLSearchParams(window.location.search).get('preview') || '');
  const canReplace = Boolean(activeSubmitted && (replacementPreview || (submittedLocalDate && submittedLocalDate !== dayKey && !hasPostedToday)));
  const headerSubmitted = tab === 'today' && replacementMode ? '' : activeSubmitted;
  const incomingRequestCount = user ? connections.filter(item => item.status === 'pending' && item.addressee_id === user.id).length : 0;
  const friendStateFor = (otherUserId: string): CardFriendState => {
    if (otherUserId === 'preview-level10-user') return 'friend';
    if (otherUserId === user?.id) return 'self';
    const relationship = connections.find(item => item.other.id === otherUserId);
    if (!relationship) return 'none';
    if (relationship.status === 'accepted') return 'friend';
    return relationship.requester_id === user?.id ? 'outgoing' : 'incoming';
  };
  const previewStrength = echoStrengths['-101'] ?? (echoed.includes('preview-level10') ? 2 : 0);
  const previewWord: FeedWord = {
    id: -101,
    user_id: 'preview-level10-user',
    username: 'dreamer',
    display_name: null,
    avatar_url: null,
    city: 'Tel Aviv',
    country_code: 'IL',
    word: 'TIRED',
    emoji: '💤',
    color: 'red',
    word_style: 'rounded',
    animation: 'pulse',
    local_date: dayKey,
    created_at: new Date(clockNow - 2 * 60 * 60 * 1000).toISOString(),
    echo_count: 12,
    spoke_count: spokeCount + 1,
    echoed_by_me: previewStrength > 0,
    my_echo_strength: previewStrength,
  };
  const visibleFeed = levelTenPreview ? [previewWord, ...feed.filter(item => item.id !== previewWord.id)] : feed;
  const ownEchoes = history.find(item => item.local_date === submittedLocalDate)?.echo_count ?? (activeSubmitted ? 37 + activeSubmitted.length * 11 : 0);
  return (
    <main className={`cozy-stage fixed-app active-${tab} ${(headerSubmitted || tab === 'you') ? 'today-app' : ''}`}><section className="cozy-shell"><BrandHeader tab={tab} submitted={headerSubmitted} submittedAt={submittedAt} now={clockNow} emoji={submittedEmoji} color={submittedColor} wordStyle={submittedWordStyle} animation={submittedAnimation} avatarUrl={level >= 5 ? profilePhotoPreview : null} echoes={ownEchoes} xp={xp} level={level} streak={streak} username={profile?.username} memberSince={profile?.created_at} city={profile?.city} countryCode={profile?.country_code} canReplace={tab === 'today' && canReplace && !replacementMode} onReplace={() => setReplacementStep('explain')} /><div className="cozy-main">
      {appError && <button className="app-error" onClick={() => setAppError('')}>{appError}</button>}
      {tab === 'today' && <TodayTab submitted={activeSubmitted} replacementMode={replacementMode} level={level} feed={visibleFeed.filter(item => isWithinTodayWindow(item.created_at, clockNow))} feedLoading={feedLoading} now={clockNow} spokeCount={levelTenPreview ? spokeCount + 1 : spokeCount} feedMode={feedMode} setFeedMode={setFeedMode} setSubmitted={postWord} refreshFeed={async () => { if (!user) { window.location.reload(); return; } setAppError(''); try { await Promise.all([loadAccount(user), loadFeed(feedMode, user)]); } catch (reason) { setAppError(readableError(reason, 'Could not refresh today.')); } }} friendStateFor={friendStateFor} sendFriendRequest={sendFriendRequest} echoStrengths={echoStrengths} echoed={echoed} setEchoStrength={setEchoStrength} />}
      {tab === 'world' && <WorldTab />}
      {tab === 'you' && <YouTab history={history} incomingRequestCount={incomingRequestCount} onOpenPanel={panel => { setAppError(''); setSearchResults([]); setYouPanel(panel); if (panel === 'friends') void loadConnections(user || undefined).catch(reason => setAppError(readableError(reason, 'Could not load friends.'))); }} />}
    </div><nav className="cozy-nav" aria-label="App navigation">{tabs.map(item => {
      const locked = item.id === 'world';
      return <button key={item.id} className={`${tab === item.id ? 'active' : ''} ${locked ? 'locked' : ''}`} disabled={locked} title={locked ? 'Coming later' : item.label} onClick={() => setTab(item.id)}><item.icon />{locked && <Lock className="nav-lock" />}<span>{item.label}</span></button>;
    })}</nav>{profile && user && <YouToolsDialog panel={youPanel} setPanel={setYouPanel} userId={user.id} connections={connections} searchResults={searchResults} searchQuery={searchQuery} onSearchQueryChange={updateFriendSearch} searchPeople={searchPeople} sendFriendRequest={sendFriendRequest} acceptFriend={acceptFriend} declineFriend={declineFriend} xp={xp} level={level} streak={streak} saveSettings={saveSettings} signOut={signOut} usernameDraft={usernameDraft} setUsernameDraft={setUsernameDraft} cityDraft={cityDraft} setCityDraft={setCityDraft} citySelection={citySelection} setCitySelection={setCitySelection} profilePhoto={profilePhotoPreview} saveProfilePhoto={saveProfilePhoto} removeProfilePhoto={removeProfilePhoto} busy={accountBusy} />}
      <Dialog open={replacementStep !== null} onOpenChange={open => { if (!open) setReplacementStep(null); }}><DialogContent className="replacement-dialog"><DialogHeader><DialogTitle>{replacementStep === 'confirm' ? 'Replace your current Wurd?' : 'A new day has started'}</DialogTitle><DialogDescription>{replacementStep === 'confirm' ? 'Posting a new Wurd will remove your existing active Wurd. This action cannot be undone.' : 'Your current Wurd will remain active until it expires, or you can replace it now with a new Wurd for today.'}</DialogDescription></DialogHeader>{replacementStep === 'confirm' ? <div className="replacement-actions"><Button variant="outline" onClick={() => setReplacementStep(null)}>Keep current Wurd</Button><Button onClick={() => { setReplacementStep(null); setReplacementMode(true); setTab('today'); }}>Replace &amp; post</Button></div> : <div className="replacement-actions"><Button variant="outline" onClick={() => setReplacementStep(null)}>Not now</Button><Button onClick={() => setReplacementStep('confirm')}>Post today&apos;s Wurd</Button></div>}</DialogContent></Dialog>
    </section></main>
  );
}
