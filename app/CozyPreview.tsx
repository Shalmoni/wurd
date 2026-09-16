'use client';

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, SyntheticEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import PlayNavButton, { PlayIntroduction } from './PlayNavButton';
import { levelDefinitions, levelForXp, levelProgressFor } from '../lib/progression';
import AccountTools, { CardSafety, InviteButton, PrivacyNote, RecentXp } from './AccountTools';
import { arrangeReplies, cloudReplies, type ReplyBox } from '../lib/reply-layout';
import {
  ArrowLeft, ArrowRight, X, Plus, Bell, Check, CircleUserRound, Clock3, Flame, Globe2, Lock, LogOut,
  MapPin, MessageCircle, RefreshCw, Search, Send, Settings, Share2, Sun, UserPlus, UsersRound,
  Trophy, Gamepad2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { createAccountLoadGuard, isSavedWurdActive } from '@/lib/posting-state';
import { isSupabaseConfigured, supabase, type FeedWord, type WordColor, type WordStyle, type WurdProfile, type WurdReply } from '@/lib/supabase';
import {
  disablePushNotifications,
  dispatchPushEvent,
  enablePushNotifications,
  isInstalledApp,
  readPushSettings,
  savePushSettings,
  type NotificationPreferences,
  type PushStatus,
} from '@/lib/push-notifications';

const PlayTab = lazy(() => import('./PlayTab'));
type Tab = 'today' | 'world' | 'play' | 'you';
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

function localDayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function isLevelTenPreview() {
  return import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'level10';
}

function isV21Preview() {
  return import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'v21';
}

function isV22Preview() {
  return import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'v22';
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

export function BrandHeader({ xp, level, streak, onProgress, onToday }: { xp: number; level: number; streak: number; onProgress: () => void; onToday: () => void }) {
  const progress = levelProgressFor(xp, level);
  return <header className="lp-header"><button className="lp-brand" aria-label="Go to Today" onClick={onToday}>wurd</button><button className="lp-xp-pill" onClick={onProgress} aria-label={`Level ${level}. ${progress.earned} XP in this level. View progression`}><span>LVL <b>{level}</b></span><i /><span><small>XP</small> <b>{progress.earned}</b></span><div><i style={{ width: `${progress.percent}%` }} /></div><span><Flame size={16} /> {streak}</span></button></header>;
}

export function CurrentWurd({ word, submittedAt, now, emoji, color, wordStyle, animation, city, countryCode, echoes, replies, loading, canReplace, onReplace }: { word: string; submittedAt: string | null; now: number; emoji: string | null; color: WordColor; wordStyle: WordStyle; animation: WordAnimation; city?: string | null; countryCode?: string | null; echoes: number; replies: WurdReply[]; loading: boolean; canReplace: boolean; onReplace: () => void }) {
  return <section className="lp-own"><div className="lp-own-word"><h1 className="lp-own-fit"><CardWord word={word} emoji={emoji} color={wordColorValues[color]} wordStyle={wordStyle} animation={animation} /></h1>{canReplace && <button className="lp-clock-button" aria-label="Post a new Wurd for today" onClick={onReplace}><Clock3 size={17} /></button>}</div><div className="lp-own-meta"><span>{submittedAt ? timeLeft(submittedAt, now) : '24h left'}{city ? ` · ${locationLabel(city, countryCode)}` : ''}</span><div><OwnReplies key={submittedAt || word} replies={replies} loading={loading} /><EchoStat count={echoes} color={wordColorValues[color]} /></div></div></section>;
}

function OwnReplies({ replies, loading }: { replies: WurdReply[]; loading: boolean }) {
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('open') === 'replies');
  return <>
    <button type="button" className="own-reply-button" aria-label={`View replies to your Wurd (${replies.length})`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><MessageCircle /><span>{replies.length}</span></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="lp-dialog production-dialog own-replies-dialog">
        <DialogHeader><DialogTitle>Replies to your Wurd</DialogTitle><DialogDescription>What people said back.</DialogDescription></DialogHeader>
        <div className="own-replies-list" aria-busy={loading}>
          {loading ? <p className="own-replies-empty" role="status">Loading replies…</p> : replies.length ? <ul>{replies.map(reply => <li key={reply.id}><strong dir="auto">{reply.word}</strong><span>{usernameLabel(reply.username)}</span></li>)}</ul> : <p className="own-replies-empty">No replies yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

function EchoWaves({ strength = 0 }: { strength?: number }) {
  const normalizedStrength = Math.max(0, Math.min(3, Math.round(strength)));
  return <svg className="echo-waves" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className={normalizedStrength >= 3 ? 'echo-wave-personal' : ''} d="M2 5q2.5 2 5 0t5 0 5 0 5 0" /><path className={normalizedStrength >= 2 ? 'echo-wave-personal' : ''} d="M2 12q2.5 2 5 0t5 0 5 0 5 0" /><path className={normalizedStrength >= 1 ? 'echo-wave-personal' : ''} d="M2 19q2.5 2 5 0t5 0 5 0 5 0" /></svg>;
}

function EchoStat({ count, color, onActivate, strength = 0, passive = false }: { count: number; color?: string; onActivate?: () => void; strength?: number; passive?: boolean }) {
  const contents = <><EchoWaves strength={strength} /><span className="echo-total">{count}</span></>;
  if (passive) return <span className="echo-count" style={{ '--echo-color': color } as CSSProperties} aria-label={`${count} echoes. Your strength: ${strength}.`}>{contents}</span>;
  if (onActivate) return <button type="button" className="echo-count" style={{ '--echo-color': color } as CSSProperties} aria-label={`${count} total echoes. Your echo strength is ${strength} of 3. Choose your echo strength.`} onClick={event => { event.stopPropagation(); onActivate(); }}>{contents}</button>;
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

export function CardWord({ word, emoji, color, wordStyle = 'bold', animation = 'still' }: { word: string; emoji?: string | null; color?: string; wordStyle?: WordStyle; animation?: WordAnimation }) {
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
  // Once the whole-hour label would drop to "1h left", show the more useful
  // minute countdown instead.
  if (remaining >= 2 * 60 * 60 * 1000) return `${Math.floor(remaining / (60 * 60 * 1000))}h left`;
  return `${Math.max(1, Math.floor(remaining / 60000))}m left`;
}

function ReplyStat({ count, open, onActivate }: { count: number; open: boolean; onActivate: () => void }) {
  return <button type="button" className="reply-count" aria-label={`${count} replies. Reply to this Wurd.`} aria-expanded={open} onClick={event => { event.stopPropagation(); onActivate(); }}><MessageCircle /><span>{count}</span></button>;
}

export function FeedCard({ item, friendState, previewStrength, pickerOpen, repliesOpen, onPickerChange, onEcho, onFriendRequest, onOpenReply }: { item: FeedWord; ownWord: string; now: number; friendState: CardFriendState; previewStrength?: number; pickerOpen: boolean; repliesOpen: boolean; onPickerChange: (open: boolean) => void; onEcho: (strength: number) => Promise<void>; onFriendRequest: () => void; onOpenReply: () => void }) {
  const name = usernameLabel(item.username);
  const avatar = profilePhotoUrl(item.avatar_url);
  const storedStrength = item.my_echo_strength ?? (item.echoed_by_me ? 2 : 0);
  const strength = Math.max(0, Math.min(3, previewStrength ?? storedStrength));
  const [draftStrength, setDraftStrength] = useState(strength);
  const [echoBusy, setEchoBusy] = useState(false);
  const [echoError, setEchoError] = useState('');
  const saving = useRef(false);
  const activeStrength = pickerOpen || echoBusy ? draftStrength : strength;
  const strengthOption = echoStrengthOptions[Math.max(0, Math.min(3, draftStrength))];
  const otherEchoes = Math.max(0, item.echo_count - storedStrength);
  const displayedEchoes = otherEchoes + activeStrength;
  const replyCount = item.reply_count ?? 0;
  const content = <><div className="live-person">{avatar && <Avatar className="wurd-card-avatar"><AvatarImage src={avatar} alt="" /></Avatar>}<span><strong>{name}</strong><small className="card-city">{item.city || 'Location not added'}</small></span></div><CardWord word={item.word} emoji={item.emoji} color={wordColorValues[item.color]} wordStyle={item.word_style || 'bold'} animation={item.animation} /></>;
  const friendControl = friendState === 'none' ? <button type="button" className="card-friend-control" aria-label={`Send friend request to ${name}`} onClick={event => { event.stopPropagation(); onFriendRequest(); }}><UserPlus /></button> : friendState === 'outgoing' ? <span className="card-friend-control pending" aria-label={`Friend request to ${name} is pending`} title="Request pending"><Clock3 /></span> : null;
  const reactions = (echoCount: number, personalStrength = 0) => <div className="card-reactions"><ReplyStat count={replyCount} open={repliesOpen} onActivate={onOpenReply} /><EchoStat passive={friendState === 'self'} count={echoCount} color={wordColorValues[item.color]} strength={personalStrength} onActivate={() => onPickerChange(!pickerOpen)} /></div>;
  const cardStyle = { '--word-color': wordColorValues[item.color] } as CSSProperties;
  useEffect(() => {
    if (!saving.current) setDraftStrength(strength);
  }, [pickerOpen, strength]);
  async function commitEcho(value: number | readonly number[]) {
    const next = typeof value === 'number' ? value : value[0];
    if (saving.current || next === strength) return;
    saving.current = true;
    setEchoBusy(true); setEchoError('');
    try { await onEcho(next); }
    catch { setDraftStrength(strength); setEchoError('Echo not saved. Please try again.'); }
    finally { saving.current = false; setEchoBusy(false); }
  }
  const toggleEchoPicker = () => onPickerChange(!pickerOpen);
  return <article data-echo-card={String(item.id)} className={`live-card friend-square ${activeStrength > 0 ? 'echoed' : ''} ${pickerOpen ? 'echo-picker-open' : ''} ${repliesOpen ? 'replies-open' : ''}`} style={cardStyle}>{friendControl}<div className="card-static-content">{content}</div>{pickerOpen && <div className="echo-strength-inline" style={{ '--word-color': wordColorValues[item.color], '--echo-strength-color': strengthOption.color } as CSSProperties} onClick={toggleEchoPicker}><div className="echo-strength-title"><span>{echoBusy ? 'Saving…' : 'How loud?'}</span><b>{strengthOption.label}</b></div><div className="echo-strength-control" onClick={event => event.stopPropagation()}><span className="echo-strength-dots" aria-hidden="true"><i /><i /><i /><i /></span><Slider min={0} max={3} step={1} value={[draftStrength]} disabled={echoBusy} onValueChange={value => setDraftStrength(Array.isArray(value) ? value[0] : value)} onValueCommitted={value => void commitEcho(value)} aria-label="Echo strength: Meh, Okay, or Wurd" /></div></div>}{echoError && <p className="card-save-error" role="alert">{echoError}</p>}{reactions(displayedEchoes, activeStrength)}</article>;
}

export function ReplyThread({ replies, currentUserId, loading, sending, error, onSubmit, onClose }: { replies: WurdReply[]; currentUserId: string | null; loading: boolean; sending: boolean; error: string; onSubmit: (word: string) => Promise<boolean>; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dismissKeyboard = (event: PointerEvent) => {
      if (event.target !== input.current) input.current?.blur();
    };
    document.addEventListener('pointerdown', dismissKeyboard);
    return () => document.removeEventListener('pointerdown', dismissKeyboard);
  }, []);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState('');
  const [sentHere, setSentHere] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const hasReplied = Boolean(currentUserId && replies.some(reply => reply.user_id === currentUserId));
  useEffect(() => {
    if (!sentHere || viewAll) return;
    const timer = window.setTimeout(onClose, 900);
    return () => window.clearTimeout(timer);
  }, [sentHere, viewAll]);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean || /\s/.test(clean)) { setDraftError('Reply with one Wurd — no spaces.'); return; }
    setDraftError('');
    if (await onSubmit(clean.toUpperCase())) { setDraft(''); setSentHere(true); }
  }

  return <section className="inline-reply-panel" aria-label="Reply to this Wurd">
    <div className="reply-composer-wrap">
      {hasReplied ? <p className="reply-complete" role="status"><Check /> {sentHere ? 'Reply sent' : 'You’ve replied'}</p> : <form className="reply-composer" onSubmit={submit}><Input ref={input} maxLength={20} value={draft} disabled={sending || loading} onChange={event => { setDraft(event.target.value); setDraftError(''); }} placeholder="Your Wurd…" aria-label="Your one-Wurd reply" /><Button type="submit" disabled={loading || sending || !draft.trim()} aria-label="Send reply"><Send /></Button></form>}
      {replies.length > 0 && <button type="button" className="view-all-replies" aria-haspopup="dialog" onClick={() => setViewAll(true)}>View all {replies.length} {replies.length === 1 ? 'reply' : 'replies'}</button>}
      {(draftError || error) && <em className="reply-error">{draftError || error}</em>}
    </div>
    <Dialog open={viewAll} onOpenChange={setViewAll}><DialogContent className="lp-dialog production-dialog own-replies-dialog" data-reply-list><DialogHeader><DialogTitle>Replies</DialogTitle><DialogDescription>Every Wurd, and who said it.</DialogDescription></DialogHeader><div className="own-replies-list"><ul>{replies.map(reply => <li key={reply.id}><strong dir="auto">{reply.word}</strong><span>{usernameLabel(reply.username)}{reply.user_id === currentUserId ? ' · You' : ''}</span></li>)}</ul></div></DialogContent></Dialog>
  </section>;
}

function sampleReplies(item: FeedWord, now: number): WurdReply[] {
  const names = ['noa', 'ari', 'becky', 'mumu', 'elazar', 'dudu', 'coral_shal', 'ramis', 'maya', 'lior', 'dan', 'ella', 'tom', 'yael', 'ben', 'tal', 'ron', 'shira', 'gil', 'omer'];
  const words = ['SAME', 'REALLY', 'MOOD', 'HONEST', 'YES', 'FELT', 'ABSOLUTELY', 'EXACTLY', 'TRUE', 'WOW', 'RELATABLE', 'ALWAYS', 'CHAOS', 'BREATHE', 'NEEDED', 'TOGETHER', 'LITERALLY', 'UNDERSTOOD', 'HOPE', 'DITTO'];
  return Array.from({ length: item.reply_count ?? 3 }, (_, index) => ({ id: -(index + 1), daily_word_id: item.id, user_id: `preview-${names[index % names.length]}-${index}`, username: names[index % names.length], avatar_url: null, word: words[index % words.length], created_at: new Date(now - Math.max(2, (item.reply_count ?? 3) - index) * 7 * 60000).toISOString() }));
}

export function FloatingReplies({ replies: allReplies, currentUserId }: { replies: WurdReply[]; currentUserId: string | null }) {
  const replies = cloudReplies(allReplies, currentUserId);
  const cloud = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<(ReplyBox | null)[]>([]);
  const signature = replies.map(reply => `${reply.id}:${reply.word}`).join('|');
  useLayoutEffect(() => {
    const field = cloud.current;
    const main = field?.closest('.wurd-cloud-card')?.querySelector<HTMLElement>('.live-word-content');
    if (!field || !main) return;
    let frame = 0;
    let disposed = false;
    const arrange = () => {
      if (disposed) return;
      const bounds = field.getBoundingClientRect();
      const word = main.getBoundingClientRect();
      // Only the rendered letters need clearance, not the full word container.
      const obstacle = { x: word.left - bounds.left - 6, y: word.top - bounds.top - 4, width: word.width + 12, height: word.height + 8, font: 0 };
      const context = document.createElement('canvas').getContext('2d');
      if (!context || !bounds.width || !bounds.height) return;
      const next = arrangeReplies(replies.map(reply => reply.word), bounds.width, bounds.height, obstacle, (text, font) => {
        context.font = `700 ${font}px Georgia`;
        return context.measureText(text).width;
      });
      setPositions(next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(arrange); };
    const observer = new ResizeObserver(schedule);
    observer.observe(field);
    observer.observe(main);
    const mutations = new MutationObserver(schedule);
    mutations.observe(main, { attributes: true, childList: true, subtree: true });
    schedule();
    void document.fonts?.ready.then(schedule);
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect(); };
  }, [signature]);
  return <div ref={cloud} className="floating-reply-cloud" aria-label="Reply preview. Open replies to view all.">{replies.map((reply, index) => {
    const position = positions[index];
    if (!position) return null;
    return <div className={`floating-reply ${reply.user_id === currentUserId ? 'mine' : ''}`} key={reply.id} style={{ left: position.x, top: position.y, width: position.width, height: position.height, fontSize: position.font, '--drift-delay': `${-index * .73}s`, '--drift-duration': `${4 + index % 4}s` } as CSSProperties}><strong aria-label={reply.user_id === currentUserId ? `${reply.word}. Your reply` : undefined}>{reply.word}</strong></div>;
  })}</div>;
}

export function WurdCard({ children, className, item, onDismiss }: { children: ReactNode; className: string; item: FeedWord; onDismiss: () => void }) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  function begin(event: ReactPointerEvent<HTMLDivElement>) {
    start.current = null;
    if (!event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest('button, input, [role="slider"], [data-reply-list], .inline-reply-panel, .echo-strength-inline'))) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }
  function finish(event: ReactPointerEvent<HTMLDivElement>) {
    const origin = start.current;
    start.current = null;
    if (origin && origin.id === event.pointerId && Math.abs(event.clientX - origin.x) < 8 && Math.abs(event.clientY - origin.y) < 8) onDismiss();
  }
  return <div className={className} data-reply-card={String(item.id)} style={{ '--word-color': wordColorValues[item.color] } as CSSProperties} onKeyDown={event => { if (event.key === 'Escape') onDismiss(); }} onPointerDown={begin} onPointerUp={finish} onPointerCancel={() => { start.current = null; }}>{children}</div>;
}

type TodayTabProps = {
  onFindFriends: () => void;
  onPlay: () => void;
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
  currentUserId: string | null;
  currentUsername: string;
  onAccountChanged: () => Promise<void>;
  hasPostedToday: boolean;
};

export function TodayTab({ submitted, replacementMode, level, feed, feedLoading, now, spokeCount, feedMode, setFeedMode, setSubmitted, refreshFeed, friendStateFor, sendFriendRequest, echoStrengths, echoed, setEchoStrength, currentUserId, currentUsername, onAccountChanged, hasPostedToday, onFindFriends, onPlay }: TodayTabProps) {
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');

  const [emoji, setEmoji] = useState<string | null>(null);
  const [color, setColor] = useState<WordColor>('mint');
  const [wordStyle, setWordStyle] = useState<WordStyle>('bold');
  const [animation, setAnimation] = useState<WordAnimation>('still');
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  const [friendTarget, setFriendTarget] = useState<FeedWord | null>(null);
  const [friendRequestState, setFriendRequestState] = useState<'confirm' | 'sending' | 'sent'>('confirm');
  const [openEchoCardId, setOpenEchoCardId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<FeedWord | null>(null);
  const [replyRows, setReplyRows] = useState<WurdReply[]>([]);
  const [replyLoading, setReplyLoading] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [replyCountOverrides, setReplyCountOverrides] = useState<Record<string, number>>({});
  const [replyCache, setReplyCache] = useState<Record<string, WurdReply[]>>({});
  const activeReplyId = useRef<number | null>(null);
  activeReplyId.current = replyTarget?.id ?? null;
  function repliesFor(item: FeedWord): WurdReply[] {
    const source = isV22Preview() ? sampleReplies(item, now) : item.replies ?? [];
    return [...new Map([...source, ...(replyCache[String(item.id)] ?? [])].map(reply => [reply.id, reply])).values()]
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id);
  }
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
  useEffect(() => {
    if (!replyTarget) return;
    const closeOnOutsidePress = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(`[data-reply-card="${replyTarget.id}"], [data-reply-list], [data-slot="dialog-overlay"]`)) return;
      setReplyTarget(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [replyTarget]);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (posting) return;
    const clean = draft.trim();
    if (!clean || /\s/.test(clean)) { setError('Just one word — no spaces.'); return; }
    setPosting(true); setError('');
    try {
      await setSubmitted({ word: clean.toUpperCase(), emoji, color, wordStyle, animation });
      setDraft(''); setComposing(false);
    } catch (reason) { setError(readableError(reason, 'Could not post your Wurd. Your draft is still here.')); }
    finally { setPosting(false); }
  }

  function openReplies(item: FeedWord) {
    setOpenEchoCardId(null);
    setReplyTarget(item);
    setReplyError('');
    setReplyLoading(false);
    setReplyRows(repliesFor(item));
  }

  async function postReply(word: string) {
    if (!replyTarget || !currentUserId || replySending) return false;
    const target = replyTarget;
    if (replyRows.some(reply => reply.user_id === currentUserId)) return false;
    setReplySending(true);
    setReplyError('');
    try {
      let id = -Date.now();
      if (!isV22Preview()) {
        if (!supabase) throw new Error('Could not connect. Please try again.');
        const result = await supabase.rpc('reply_to_wurd', { p_daily_word_id: target.id, p_word: word });
        if (result.error) throw result.error;
        id = Number(result.data);
        void dispatchPushEvent('wurd_reply', id);
      }
      const nextReply: WurdReply = { id, daily_word_id: target.id, user_id: currentUserId, username: currentUsername || 'you', avatar_url: null, word, created_at: new Date().toISOString() };
      const nextRows = [...replyRows, nextReply];
      // Update the card immediately; closing the composer must not lose the reply.
      setReplyCache(current => ({ ...current, [String(target.id)]: nextRows }));
      if (activeReplyId.current === target.id) setReplyRows(nextRows);
      setReplyCountOverrides(current => ({ ...current, [String(target.id)]: Math.max(target.reply_count ?? 0, nextRows.length - 1) + 1 }));
      return true;
    } catch (reason) {
      if (activeReplyId.current === target.id) setReplyError(reason instanceof Error ? reason.message : 'Could not send your reply. Please try again.');
      return false;
    } finally {
      setReplySending(false);
    }
  }
  const composer = <Dialog open={(!submitted && composing) || replacementMode} onOpenChange={open => { if (!open && !posting && !replacementMode) setComposing(false); }}><DialogContent className="lp-dialog production-dialog production-compose" showCloseButton={!replacementMode && !posting}><DialogHeader><DialogTitle>Your Wurd for today.</DialogTitle><DialogDescription>One Wurd. Up to 20 characters. No spaces.</DialogDescription></DialogHeader><form className="lp-form" onSubmit={event => void submit(event)}><label className="lp-sr-only" htmlFor="daily-word-input">Your Wurd</label><Input id="daily-word-input" className="lp-word-input" maxLength={20} disabled={posting} value={draft} onChange={event => { setDraft(event.target.value); setError(''); }} placeholder="HOW YOU FEEL" /><small>{[...draft].length}/20 · Your Wurd stays for up to 24 hours.</small><fieldset disabled={posting}>
    {level >= 2 && <div className="reward-customizer">
          <section><b>Font</b><div className="style-options">{wordStyleChoices.filter(item => level >= item.level).map(item => <button type="button" className={`${wordStyle === item.value ? 'active ' : ''}word-style-${item.value}`} onClick={() => setWordStyle(item.value)} key={item.value}>{item.label}</button>)}</div></section>
          {level >= 3 && (level >= 8 ? <section><b>USE ANY EMOJI</b><label className="any-emoji-input solo"><Input value={emoji || ''} onChange={event => { const next = oneEmoji(event.target.value); if (next !== undefined) setEmoji(next); }} placeholder="😊" aria-label="Use any one emoji" /><span>One emoji, placed after your Wurd.</span></label></section> : <section><b>ADD ONE EMOJI</b><div className="emoji-options"><button type="button" className={!emoji ? 'active' : ''} onClick={() => setEmoji(null)}>None</button>{emojiChoices.map(item => <button type="button" className={emoji === item ? 'active' : ''} onClick={() => setEmoji(item)} key={item}>{item}</button>)}</div></section>)}
          {level >= 4 && <section><b>Color</b><div className="color-options">{wordColorChoices.filter(item => level >= item.level).map(item => <button type="button" className={color === item.value ? 'active' : ''} style={{ background: wordColorValues[item.value] }} aria-label={`${item.label} color`} onClick={() => setColor(item.value)} key={item.value} />)}</div></section>}
          {level >= 9 && <section><b>Animation</b><div className="animation-options">{animationChoices.map(item => <button type="button" className={animation === item.value ? 'active' : ''} onClick={() => setAnimation(item.value)} key={item.value}>{item.label}</button>)}</div></section>}
        </div>}
    </fieldset>{replacementMode && <p>Your new Wurd will replace your current one. Your history stays in You.</p>}{error && <p className="lp-error" role="alert">{error}</p>}<button className="lp-action" type="submit" disabled={posting || !draft.trim()}>{posting ? 'Posting…' : 'Post my Wurd'} <ArrowRight size={17} /></button></form></DialogContent></Dialog>;
  const demoPeople = feedMode === 'New' ? [...livePeople] : [...livePeople].sort((left, right) => right[6] - left[6]);
  const demoFriends = [...friends].sort((left, right) => right.echoes - left.echoes);
  return (
    <section className="production-today">{composer}
      {!submitted && <section className="lp-compose-intro"><span className="lp-kicker">A MOMENT FOR YOU</span><h1>{hasPostedToday ? 'A new day. A new Wurd.' : 'What’s your Wurd?'}</h1><p>{hasPostedToday ? 'You’ve posted today. Come back tomorrow.' : 'No perfect answer. Just how today feels.'}</p>{!hasPostedToday && <button className="lp-action" onClick={() => setComposing(true)}><Plus size={18} /> Post today’s Wurd</button>}</section>}
      <PlayIntroduction key={currentUserId || 'local'} userId={currentUserId || 'local'} onOpen={onPlay} />
      <div className="lp-feed-heading"><div><h2>Your daily window</h2><span>{spokeCount} {feedMode === 'Friends' ? 'friends’ posts' : 'posts'}</span></div><button className="lp-icon" aria-label="Refresh posts" disabled={feedLoading} onClick={() => void refreshFeed()}><RefreshCw size={20} /></button></div><div className="lp-filter" aria-label="Feed sorting">{(['New', 'Top', 'Friends'] as const).map(mode => <button key={mode} aria-pressed={feedMode === mode} onClick={() => { setOpenEchoCardId(null); setReplyTarget(null); setFeedMode(mode); }}>{mode}</button>)}</div><p className="lp-feed-hint">Tap <EchoWaves /> to echo. Tap <MessageCircle size={14} /> to reply.</p>
      {isSupabaseConfigured ? <div className="live-grid lp-feed">{feedLoading ? <p className="feed-empty">Finding today&apos;s words…</p> : feed.length ? feed.map(item => {
        const displayItem = { ...item, reply_count: Math.max(replyCountOverrides[String(item.id)] ?? 0, item.reply_count) };
        const repliesOpen = replyTarget?.id === item.id;
        const card = <FeedCard key={item.id} item={displayItem} ownWord={submitted} now={now} friendState={friendStateFor(item.user_id)} previewStrength={echoStrengths[String(item.id)]} pickerOpen={openEchoCardId === String(item.id)} repliesOpen={repliesOpen} onPickerChange={open => { if (open) setReplyTarget(null); setOpenEchoCardId(open ? String(item.id) : null); }} onFriendRequest={() => { setFriendRequestState('confirm'); setFriendTarget(item); }} onOpenReply={() => { if (repliesOpen) setReplyTarget(null); else openReplies(displayItem); }} onEcho={strength => setEchoStrength(item.id, strength)} />;
        const visibleReplies = repliesFor(item);
        return <WurdCard className={`wurd-cloud-card ${repliesOpen ? 'composing-reply' : ''}`} key={item.id} item={item} onDismiss={() => { setOpenEchoCardId(null); setReplyTarget(null); }}>{card}<CardSafety item={item} onChanged={onAccountChanged} /><FloatingReplies replies={visibleReplies} currentUserId={currentUserId} />{repliesOpen && <ReplyThread key={item.id} onClose={() => setReplyTarget(current => current?.id === item.id ? null : current)} replies={replyRows} currentUserId={currentUserId} loading={replyLoading} sending={replySending} error={replyError} onSubmit={postReply} />}</WurdCard>;
      }) : <div className="lp-empty"><span><UsersRound /></span><h2>{feedMode === 'Friends' ? 'Your people belong here.' : 'It’s quiet here, for now.'}</h2><p>{feedMode === 'Friends' ? 'Find a friend, or invite someone to say less with you.' : 'Be the first to share a Wurd. A little community starts with you.'}</p><button className="lp-action" onClick={onFindFriends}>Find your people <ArrowRight size={17} /></button></div>}</div> : feedMode === 'Friends' ? <div className="friends-card-grid">{demoFriends.map(friend => <FriendCard key={friend.id} friend={friend} match={friend.word === submitted} echoed={echoed.includes(friend.id)} onEcho={() => void setEchoStrength(friend.id, echoed.includes(friend.id) ? 0 : 3)} />)}</div> : <div className="live-grid">{demoPeople.map((person, index) => <LiveCard key={`${person[0]}-${person[2]}`} person={person} echoed={echoed.includes(`live-${index}`)} onEcho={() => void setEchoStrength(`live-${index}`, echoed.includes(`live-${index}`) ? 0 : 3)} />)}</div>}
      {!feedLoading && feed.length > 0 && <p className="lp-endnote">You’re all caught up. Go live a little.</p>}
      <Dialog open={friendTarget !== null} onOpenChange={open => { if (!open && friendRequestState !== 'sending') setFriendTarget(null); }}><DialogContent className="lp-dialog production-dialog friend-request-dialog"><DialogHeader><DialogTitle>{friendRequestState === 'sent' ? 'Request sent' : `Send friend request to ${usernameLabel(friendTarget?.username)}?`}</DialogTitle>{friendRequestState === 'sent' && <DialogDescription>They’ll see it in Friends.</DialogDescription>}</DialogHeader>{friendRequestState !== 'sent' && <div className="replacement-actions"><Button variant="outline" disabled={friendRequestState === 'sending'} onClick={() => setFriendTarget(null)}>Cancel</Button><Button disabled={friendRequestState === 'sending'} onClick={async () => { if (!friendTarget) return; setFriendRequestState('sending'); const sent = await sendFriendRequest(friendTarget.user_id); if (!sent) { setFriendRequestState('confirm'); return; } setFriendRequestState('sent'); window.setTimeout(() => setFriendTarget(null), 1100); }}>{friendRequestState === 'sending' ? 'Sending…' : 'Send'}</Button></div>}</DialogContent></Dialog>
    </section>
  );
}

function FriendCard({ friend, match, echoed, onEcho }: { friend: typeof friends[number]; match: boolean; echoed: boolean; onEcho: () => void }) {
  const content = <><div className="live-person"><span><strong>{usernameLabel(friend.handle)}</strong><small>{friendCities[friend.id]} · {friend.time} ago</small></span></div><CardWord word={friend.word} /></>;
  if (match) return <article className="live-card friend-square exact-match" aria-label={`${friend.name} chose the same word as you`}><div className="card-static-content">{content}</div><EchoStat count={friend.echoes} /></article>;
  return <article className={`live-card friend-square ${echoed ? 'echoed' : ''}`}><button className="card-echo-action" aria-pressed={echoed} aria-label={`${friend.name} chose ${friend.word}. Tap to echo.`} onClick={onEcho}>{content}</button><EchoStat count={friend.echoes + (echoed ? 1 : 0)} /></article>;
}

export function YouTab({ history, incomingRequestCount, onOpenPanel, loadEarlier, hasEarlier, historyBusy, username, memberSince, avatarUrl, onToday }: { history: DiaryWord[]; incomingRequestCount: number; onOpenPanel: (panel: Exclude<YouPanel, null>) => void; loadEarlier: () => Promise<void>; hasEarlier: boolean; historyBusy: boolean; username?: string; memberSince?: string | null; avatarUrl?: string | null; onToday: () => void }) {
  return <section className="production-you">
    <section className="lp-profile">{avatarUrl && <img src={avatarUrl} alt="Your profile" />}<span className="lp-kicker">YOUR LITTLE CORNER</span><h1>{usernameLabel(username)}</h1><p><span>since</span> {memberSince ? new Date(memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'}</p></section>
    <div className="lp-tools" aria-label="People and account tools">
      <button onClick={() => onOpenPanel('friends')}><UsersRound size={22} /><span>Friends</span>{incomingRequestCount > 0 && <b aria-label={`${incomingRequestCount} incoming friend requests`}>{incomingRequestCount}</b>}</button>
      <button onClick={() => onOpenPanel('xp')}><Trophy size={22} /><span>Progress</span></button>
      <button onClick={() => onOpenPanel('settings')}><Settings size={22} /><span>Settings</span></button>
    </div>
    <div className="lp-section-heading"><h2>Your days, in Wurds.</h2><span>{history.length}{hasEarlier ? '+' : ''}</span></div>
    {history.length ? <div className="lp-history">{history.map(item => { const date = new Date(`${item.local_date}T12:00:00`); return <article key={item.id}><div><span>{date.toLocaleDateString(undefined, { weekday: 'long' })}</span><strong>{date.getDate()} <small>{date.toLocaleDateString(undefined, { month: 'short' })}</small></strong></div><div><h2 className={`word-style-${item.word_style || 'bold'}`} style={{ color: wordColorValues[item.color] }}>{item.word}{item.emoji && ` ${item.emoji}`}</h2><small>{item.city || 'Location not added'}</small></div><span className="lp-history-count"><EchoWaves />{item.echo_count}</span></article>; })}{hasEarlier && <button className="lp-action secondary" disabled={historyBusy} onClick={() => void loadEarlier()}>{historyBusy ? 'Loading…' : 'Load earlier days'}</button>}</div> : <div className="lp-empty"><span><Sun /></span><h2>Every story starts somewhere.</h2><p>Your Wurds will collect here. A small record of how life felt.</p><button className="lp-action" onClick={onToday}>Write your first Wurd</button></div>}
  </section>;
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
  unfriend: (id: number) => Promise<boolean>;
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
  pushStatus: PushStatus;
  notificationPreferences: NotificationPreferences;
  notificationBusy: boolean;
  notificationError: string;
  setNotificationPreferences: (preferences: NotificationPreferences) => void;
  enableNotifications: () => Promise<void>;
  saveNotificationPreferences: (preferences: NotificationPreferences) => Promise<void>;
  disableNotifications: () => Promise<void>;
  busy: boolean;
  onAccountChanged: () => Promise<void>;
  accountError: string;
};

export function YouToolsDialog(props: YouToolsDialogProps) {
  const [settingsPage, setSettingsPage] = useState<'menu' | 'profile' | 'notifications'>('menu');
  useEffect(() => { setSettingsPage('menu'); }, [props.panel]);
  const ladder = useRef<HTMLDivElement>(null);
  const cropFrame = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number } | null>(null);
  const [photoCrop, setPhotoCrop] = useState<PhotoCropDraft | null>(null);
  const [photoScale, setPhotoScale] = useState(1);
  const [photoOffset, setPhotoOffset] = useState({ x: 0, y: 0 });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [confirmUnfriendId, setConfirmUnfriendId] = useState<number | null>(null);
  const [requestTarget, setRequestTarget] = useState<ProfileSummary | null>(null);

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
      <DialogContent className={`lp-dialog production-dialog you-tool-dialog ${props.panel === 'settings' ? `settings-${settingsPage}` : ''}`}>
        {props.accountError && <p role="alert" className="notification-error">{props.accountError}</p>}
        {(props.panel === 'search' || props.panel === 'friends') && <>
          <DialogHeader><DialogTitle>Your people.</DialogTitle><DialogDescription>Find a friend. Bring your people closer.</DialogDescription></DialogHeader>
          <form className="friend-search lp-search" onSubmit={event => { event.preventDefault(); void props.searchPeople(); }}><Input aria-label="Search username" value={props.searchQuery} onChange={event => props.onSearchQueryChange(event.target.value)} maxLength={24} placeholder="Find an @username" autoComplete="off" /><Button type="submit" aria-label="Search people" disabled={props.busy}><Search /></Button></form>
          <div className="people-list">{props.searchResults.map(person => {
            const relationship = relationFor(person.id);
            return <div className="person-row" key={person.id}><div><strong>{usernameLabel(person.username)}</strong><small><MapPin />{person.city || 'Location not added'}</small></div>{relationship?.status === 'accepted' ? <span className="status-chip"><Check /> Friends</span> : relationship?.status === 'pending' ? <span className="status-chip">{relationship.addressee_id === props.userId ? 'Incoming request' : 'Requested'}</span> : <Button size="sm" onClick={() => setRequestTarget(person)} disabled={props.busy}><UserPlus /> Connect</Button>}</div>;
          })}{props.searchQuery && !props.busy && props.searchResults.length === 0 && <p className="panel-empty">No matching usernames yet.</p>}</div>
        </>}
        {props.panel === 'friends' && !props.searchQuery.trim() && <>

          <InviteButton /><div className="people-list friendship-list">{incoming.length > 0 && <h3 className="friend-group-label">Incoming requests</h3>}
            {incoming.map(item => <div className="person-row" key={item.id}><div><strong>{usernameLabel(item.other.username)}</strong><small>Wants to be friends</small></div><div className="request-response-actions"><Button size="sm" variant="outline" onClick={() => void props.declineFriend(item.id)} disabled={props.busy}>Decline</Button><Button size="sm" onClick={() => void props.acceptFriend(item.id)} disabled={props.busy}><Check /> Accept</Button></div></div>)}
            {outgoing.length > 0 && <h3 className="friend-group-label">Sent requests</h3>}{outgoing.map(item => <div className="person-row" key={item.id}><div><strong>{usernameLabel(item.other.username)}</strong><small>Request sent</small></div><span className="status-chip">Pending</span></div>)}
            {accepted.length > 0 && <h3 className="friend-group-label">Your friends</h3>}{accepted.map(item => <div className="person-row" key={item.id}><div><strong>{usernameLabel(item.other.username)}</strong><small><MapPin />{item.other.city || 'Location not added'}</small></div>{confirmUnfriendId === item.id ? <div className="unfriend-actions"><button type="button" className="unfriend-cancel" disabled={props.busy} onClick={() => setConfirmUnfriendId(null)}>Cancel</button><button type="button" className="unfriend-button" disabled={props.busy} onClick={async () => { if (await props.unfriend(item.id)) setConfirmUnfriendId(null); }}>Unfriend</button></div> : <button type="button" className="status-chip friend-status-button" onClick={() => setConfirmUnfriendId(item.id)}><Check /> Friends</button>}</div>)}
            {props.connections.length === 0 && <p className="panel-empty">No friends or requests yet. Search for someone to get started.</p>}
          </div>
        </>}
        {props.panel === 'xp' && <>
          <DialogHeader><DialogTitle>A little more you.</DialogTitle><DialogDescription>Show up. Connect. Make it your own.</DialogDescription></DialogHeader>
          <section className="lp-xp-summary"><span className="lp-kicker">LEVEL {props.level}</span><h2>{xpProgress.earned} <small>/ {nextLevel ? xpProgress.required : '—'} XP</small></h2><div className="lp-progress-track"><i style={{ width: `${xpProgress.percent}%` }} /></div><p>{nextLevel ? `${xpProgress.remaining} XP to Level ${nextLevel.level}` : 'You’ve reached our highest level for now.'}</p></section>
          <RecentXp /><div className="xp-ladder" ref={ladder} aria-label="Level progression"><div className="xp-ladder-more" aria-label="More levels coming"><i /><span>•••</span></div>{[...levelDefinitions].reverse().map(item => {
            const state = item.level < props.level ? 'completed' : item.level === props.level ? 'current' : 'upcoming';
            const reward = item.level <= props.level ? item.reward : '???';
            return <article className={`xp-level-row ${state}`} key={item.level}><span className="xp-level-node">{state === 'completed' ? <Check /> : state === 'current' ? item.level : <Lock />}</span><div><strong>Level {item.level}</strong><small>{reward}</small></div><b>{item.threshold.toLocaleString()} XP</b></article>;
          })}</div>
        </>}
        {props.panel === 'settings' && <>
          <DialogHeader><DialogTitle>{settingsPage === 'profile' ? 'Your profile' : settingsPage === 'notifications' ? 'Stay a little closer.' : 'Make yourself at home.'}</DialogTitle><DialogDescription>Make wurd yours.</DialogDescription></DialogHeader>
          {settingsPage === 'menu' ? <div className="account-menu"><button onClick={() => setSettingsPage('profile')}><CircleUserRound /><span>Profile</span><span>›</span></button><button onClick={() => setSettingsPage('notifications')}><Bell /><span>Notifications</span><span>›</span></button></div> : <Button variant="ghost" onClick={() => setSettingsPage('menu')}>← Settings</Button>}
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
          <section className="notification-settings"><div><strong>Notifications</strong><small>{props.pushStatus === 'enabled' ? 'On for this device' : props.pushStatus === 'denied' ? 'Blocked in device settings' : props.pushStatus === 'unsupported' ? 'Not supported on this device' : 'Off for this device'}</small></div><div className="v21-notification-types compact"><button type="button" className={props.notificationPreferences.requests ? 'active' : ''} aria-pressed={props.notificationPreferences.requests} disabled={props.notificationBusy || props.pushStatus === 'unsupported'} onClick={() => { const next = { ...props.notificationPreferences, requests: !props.notificationPreferences.requests }; props.setNotificationPreferences(next); if (props.pushStatus === 'enabled') void props.saveNotificationPreferences(next); }}><span><UserPlus /></span><div><strong>Friend requests</strong><small>When someone wants to connect.</small></div><i>{props.notificationPreferences.requests && <Check />}</i></button><button type="button" className={props.notificationPreferences.friendWords ? 'active' : ''} aria-pressed={props.notificationPreferences.friendWords} disabled={props.notificationBusy || props.pushStatus === 'unsupported'} onClick={() => { const next = { ...props.notificationPreferences, friendWords: !props.notificationPreferences.friendWords }; props.setNotificationPreferences(next); if (props.pushStatus === 'enabled') void props.saveNotificationPreferences(next); }}><span className="wurd-alert-mark">w</span><div><strong>Friends&apos; Wurds</strong><small>When a friend posts a new Wurd.</small></div><i>{props.notificationPreferences.friendWords && <Check />}</i></button><button type="button" className={props.notificationPreferences.replies ? 'active' : ''} aria-pressed={props.notificationPreferences.replies} disabled={props.notificationBusy || props.pushStatus === 'unsupported'} onClick={() => { const next = { ...props.notificationPreferences, replies: !props.notificationPreferences.replies }; props.setNotificationPreferences(next); if (props.pushStatus === 'enabled') void props.saveNotificationPreferences(next); }}><span><MessageCircle /></span><div><strong>Replies to your Wurd</strong><small>When someone replies to your post.</small></div><i>{props.notificationPreferences.replies && <Check />}</i></button></div>{props.notificationError && <em className="notification-error">{props.notificationError}</em>}{props.pushStatus === 'enabled' ? <Button type="button" variant="outline" disabled={props.notificationBusy} onClick={() => void props.disableNotifications()}>Turn off on this device</Button> : <Button type="button" disabled={props.notificationBusy || props.pushStatus === 'unsupported' || (!props.notificationPreferences.requests && !props.notificationPreferences.friendWords && !props.notificationPreferences.replies)} onClick={() => void props.enableNotifications()}>{props.notificationBusy ? 'Turning on…' : 'Turn on alerts'}</Button>}</section>
          <form className="settings-form" onSubmit={event => void props.saveSettings(event)}><label htmlFor="settings-username">Username</label><Input id="settings-username" maxLength={24} value={props.usernameDraft} onChange={event => props.setUsernameDraft(event.target.value)} /><label htmlFor="settings-city">City (optional)</label><CityPicker id="settings-city" query={props.cityDraft} selected={props.citySelection} onQueryChange={props.setCityDraft} onSelect={props.setCitySelection} /><Button type="submit" disabled={props.busy}>Save changes</Button></form>
          <AccountTools onChanged={props.onAccountChanged} /><Button className="logout-button" variant="outline" onClick={() => void props.signOut()}><LogOut /> Log out</Button>
        </>}
      </DialogContent>
    </Dialog>
    <Dialog open={requestTarget !== null} onOpenChange={open => { if (!open && !props.busy) setRequestTarget(null); }}><DialogContent className="lp-dialog production-dialog"><DialogHeader><DialogTitle>Connect with {usernameLabel(requestTarget?.username)}?</DialogTitle><DialogDescription>They’ll see your request in Friends. You connect when they accept.</DialogDescription></DialogHeader>{props.accountError && <p className="lp-error" role="alert">{props.accountError}</p>}<div className="lp-actions"><button className="lp-action secondary" disabled={props.busy} onClick={() => setRequestTarget(null)}>Cancel</button><button className="lp-action" disabled={props.busy} onClick={async () => { if (requestTarget && await props.sendFriendRequest(requestTarget.id)) setRequestTarget(null); }}>{props.busy ? 'Sending…' : 'Send request'}</button></div></DialogContent></Dialog>
    <Dialog open={photoCrop !== null} onOpenChange={open => { if (!open && !photoBusy) closePhotoCrop(); }}>
        <DialogContent className="lp-dialog production-dialog photo-crop-dialog">
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
  const [cityError, setCityError] = useState('');
  useEffect(() => {
    const clean = query.trim();
    if (selected || clean.length < 2) { setResults([]); setCityError(''); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true); setCityError('');
      try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=8&language=en&format=json`, { signal: controller.signal });
        if (!response.ok) throw new Error('City search failed');
        const payload = await response.json() as { results?: { name: string; country?: string; country_code?: string; feature_code?: string }[] };
        const cities = (payload.results || [])
          .filter(item => item.country && item.country_code && item.feature_code?.startsWith('PPL'))
          .map(item => ({ name: item.name, country: item.country!, countryCode: item.country_code! }));
        setResults(cities.filter((item, index) => cities.findIndex(match => match.name === item.name && match.countryCode === item.countryCode) === index).slice(0, 6));
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) { setResults([]); setCityError('City search is unavailable. Try again, or leave your city blank for now.'); }
      } finally { setSearching(false); }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selected]);
  return <div className="city-picker"><Input id={id} maxLength={80} autoComplete="off" value={query} onChange={event => { onSelect(null); onQueryChange(event.target.value); }} placeholder="Start typing a city" aria-autocomplete="list" aria-expanded={results.length > 0} />{cityError && <small role="alert">{cityError}</small>}{searching && <small className="city-searching">Finding cities…</small>}{results.length > 0 && <div className="city-results" role="listbox" aria-label="Matching cities">{results.map(city => <button type="button" role="option" aria-selected={false} key={`${city.name}-${city.countryCode}`} onClick={() => { onSelect(city); onQueryChange(`${city.name}, ${city.country}`); setResults([]); }}><strong>{city.name}</strong><span>{city.country}</span></button>)}</div>}</div>;
}

const tabs: { id: Tab; label: string; icon: typeof Sun }[] = [
  { id: 'today', label: 'Today', icon: Sun }, { id: 'play', label: 'Play', icon: Gamepad2 }, { id: 'you', label: 'You', icon: CircleUserRound },
];

export default function CozyPreview() {
  const [tab, setTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'play' || params.get('preview') === 'play' ? 'play' : 'today';
  });
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
  const syncGameXp = useCallback((xp: number) => {
    setProfile(current => current && current.xp !== xp ? { ...current, xp, level: levelForXp(xp) } : current);
  }, []);
  const [feed, setFeed] = useState<FeedWord[]>([]);
  const [ownFeedWord, setOwnFeedWord] = useState<FeedWord | null>(null);
  const [spokeCount, setSpokeCount] = useState(0);
  const [history, setHistory] = useState<DiaryWord[]>([]);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
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
  const [v21Step, setV21Step] = useState<'home' | 'open-installed' | 'notifications' | 'complete' | null>(null);
  const [v21Notifications, setV21Notifications] = useState<NotificationPreferences>({ requests: true, friendWords: true, replies: false });
  const [pushStatus, setPushStatus] = useState<PushStatus>('prompt');
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const friendSearchTimer = useRef<number | null>(null);
  const accountLoadGuard = useRef(createAccountLoadGuard());
  const feedLoadId = useRef(0);

  async function loadAccount(activeUser: User) {
    if (!supabase) return;
    const request = accountLoadGuard.current.invalidate();
    setFeedLoading(true);
    try {
      const [profileResult, historyResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', activeUser.id).single(),
        supabase.rpc('my_history_page', { p_limit: 20 }),
      ]);
      // Timestamps are assigned by the server; do not reject a saved post just
      // because this device's clock is slightly behind the server.
      let wordResult = await supabase.from('daily_words').select('id, local_date, word, emoji, color, word_style, animation, created_at').eq('user_id', activeUser.id).is('replaced_at', null).gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).order('created_at', { ascending: false }).limit(1);
      // Keeps localhost usable until the V2 database migration is released.
      if (wordResult.error && /animation/i.test(wordResult.error.message)) {
        wordResult = await supabase.from('daily_words').select('id, local_date, word, emoji, color, word_style, created_at').eq('user_id', activeUser.id).is('replaced_at', null).gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).order('created_at', { ascending: false }).limit(1) as typeof wordResult;
      }
      if (!accountLoadGuard.current.isCurrent(request)) return;
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
      setHasEarlier((historyResult.data || []).length === 20);
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
      if (accountLoadGuard.current.isCurrent(request)) setFeedLoading(false);
    }
  }

  async function loadFeed(mode = feedMode, activeUser = user) {
    if (!supabase || !activeUser) return;
    const request = ++feedLoadId.current;
    setFeedLoading(true);
    const result = await supabase.rpc('feed_words', { p_date: localDayKey(), p_limit: 0, p_friends_only: mode === 'Friends' });
    if (request !== feedLoadId.current) return;
    setFeedLoading(false);
    if (result.error) throw result.error;
    const rows = ((result.data || []) as FeedWord[]).map((item, index) => ({
      ...item,
      reply_count: isV22Preview() && new URLSearchParams(window.location.search).get('replies') === '20' ? 20 : item.reply_count ?? (isV22Preview() ? [10, 5, 2, 8, 1][index % 5] : 0),
    }));
    setOwnFeedWord(((result.data || []) as FeedWord[]).find(item => item.user_id === activeUser.id) ?? null);
    setSpokeCount(rows[0]?.spoke_count || 0);
    const latestByUser = new Map<string, FeedWord>();
    for (const item of [...rows].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())) {
      if (!latestByUser.has(item.user_id)) latestByUser.set(item.user_id, item);
    }
    const visibleRows = rows.filter(item => item.user_id !== activeUser.id && isWithinTodayWindow(item.created_at) && latestByUser.get(item.user_id)?.id === item.id);
    const sortedRows = [...visibleRows].sort((left, right) => {
      const recency = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      if (mode === 'New') return recency;
      const rightScore = right.echo_count * 2 + (right.reply_count ?? 0);
      const leftScore = left.echo_count * 2 + (left.reply_count ?? 0);
      return rightScore - leftScore || recency;
    });
    setFeed(sortedRows);
  }

  async function loadEarlier() {
    if (!supabase || historyBusy || !history.length) return;
    setHistoryBusy(true);
    try {
      const result = await supabase.rpc('my_history_page', { p_before: history[history.length - 1].created_at, p_limit: 20 });
      if (result.error) throw result.error;
      const next = (result.data || []) as DiaryWord[];
      setHistory(current => [...new Map([...current, ...next].map(row => [row.id, row])).values()]);
      setHasEarlier(next.length === 20);
    } catch (e) { setAppError(readableError(e, 'Could not load earlier Wurds.')); }
    finally { setHistoryBusy(false); }
  }

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

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
      else { accountLoadGuard.current.invalidate(); feedLoadId.current++; setProfile(null); setProfilePhotoPreview(''); setSubmittedState(''); setSubmittedAt(null); setSubmittedLocalDate(null); setFeed([]); setOwnFeedWord(null); setHistory([]); setConnections([]); }
    });
    return () => { live = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || !profile) return;
    let live = true;
    void readPushSettings().then(state => {
      if (!live) return;
      setPushStatus(state.status);
      setV21Notifications(state.preferences);
      const alreadyHandled = window.localStorage.getItem('wurd:v21:onboarding') === 'done';
      if (!alreadyHandled || isV21Preview()) setV21Step(isInstalledApp() ? 'notifications' : 'home');
    }).catch(reason => {
      if (live) setNotificationError(readableError(reason, 'Could not check notification settings.'));
    });
    return () => { live = false; };
  }, [user, profile?.id]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('open') === 'friends') {
      setTab('you');
      setYouPanel('friends');
      void loadConnections(user).catch(reason => setAppError(readableError(reason, 'Could not load friends.')));
    } else if (params.get('feed') === 'friends') {
      setTab('today');
      setFeedMode('Friends');
    }
  }, [user]);

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
    if (!user || tab !== 'today') return;
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
      const savedWord = result.data as DiaryWord;
      const postedId = Number(savedWord.id);
      // Commit the successful save before refreshing XP. A level-up or a late
      // pre-post account response must never reopen the posting form.
      accountLoadGuard.current.invalidate();
      setClockNow(Date.now());
      setSubmittedState(savedWord.word);
      setSubmittedAt(savedWord.created_at);
      setSubmittedLocalDate(savedWord.local_date);
      setSubmittedEmoji(savedWord.emoji);
      setSubmittedColor(savedWord.color);
      setSubmittedWordStyle(savedWord.word_style || 'bold');
      setSubmittedAnimation(savedWord.animation || 'still');
      setReplacementMode(false);
      if (Number.isInteger(postedId)) void dispatchPushEvent('friend_word', postedId);
      // Refresh failures are not posting failures: the Wurd is already saved.
      void loadAccount(user).catch(() => setAppError('Your Wurd was posted. Could not refresh your account—tap refresh to try again.'));
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
      if (result.error) { setAppError(result.error.message); throw new Error(result.error.message); }
      setAppError('');
      setFeed(current => current.map(item => {
        if (item.id !== id) return item;
        const previousStrength = item.my_echo_strength ?? (item.echoed_by_me ? 2 : 0);
        return {
          ...item,
          echo_count: Math.max(0, item.echo_count - previousStrength + normalizedStrength),
          echoed_by_me: normalizedStrength > 0,
          my_echo_strength: normalizedStrength,
        };
      }));
    } else { throw new Error('Sign in again to save your echo.'); }
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
    if (cityDraft.trim() && !citySelection) { setAppError('Choose a city from the suggestions, or leave it blank.'); return; }
    setAccountBusy(true);
    const { error } = await supabase.from('profiles').update({ username: clean, city: city || null, country_code: citySelection?.countryCode || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).eq('id', user.id);
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
    const { data, error } = await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' }).select('id').single();
    setAccountBusy(false);
    if (error) { setAppError(error.code === '23505' ? 'A request already exists between you.' : error.message); return false; }
    await loadConnections(user);
    if (data?.id) void dispatchPushEvent('friend_request', data.id);
    return true;
  }

  async function turnOnNotifications() {
    if (!user) return;
    setNotificationBusy(true);
    setNotificationError('');
    try {
      await enablePushNotifications(user.id, v21Notifications);
      setPushStatus('enabled');
      window.localStorage.setItem('wurd:v21:onboarding', 'done');
      setV21Step('complete');
    } catch (reason) {
      setNotificationError(readableError(reason, 'Could not turn on notifications.'));
      if ('Notification' in window && Notification.permission === 'denied') setPushStatus('denied');
    } finally { setNotificationBusy(false); }
  }

  async function updateNotificationSettings(preferences: NotificationPreferences) {
    if (!user) return;
    setNotificationBusy(true);
    setNotificationError('');
    try { await savePushSettings(user.id, preferences); }
    catch (reason) { setNotificationError(readableError(reason, 'Could not save notification settings.')); }
    finally { setNotificationBusy(false); }
  }

  async function turnOffNotifications() {
    if (!user) return;
    setNotificationBusy(true);
    setNotificationError('');
    try { await disablePushNotifications(user.id); setPushStatus('prompt'); }
    catch (reason) { setNotificationError(readableError(reason, 'Could not turn off notifications.')); }
    finally { setNotificationBusy(false); }
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

  async function unfriend(friendshipId: number) {
    if (!supabase || !user) return false;
    setAccountBusy(true);
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId).eq('status', 'accepted');
    setAccountBusy(false);
    if (error) { setAppError(error.message); return false; }
    await Promise.all([loadConnections(user), loadAccount(user), submitted ? loadFeed(feedMode, user) : Promise.resolve()]);
    return true;
  }

  async function saveSettings(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    const clean = usernameDraft.trim().toLowerCase();
    const city = citySelection?.name.trim() || '';
    if (!/^[a-z0-9_]{3,24}$/.test(clean)) { setAppError('Use 3–24 letters, numbers, or underscores.'); return; }
    if (cityDraft.trim() && !citySelection) { setAppError('Choose a city from the suggestions, or leave it blank.'); return; }
    setAccountBusy(true);
    const { error } = await supabase.from('profiles').update({ username: clean, city: city || null, country_code: citySelection?.countryCode || null }).eq('id', user.id);
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

  if (!import.meta.env.DEV && !isSupabaseConfigured) return <main className="auth-stage"><div className="auth-card"><div className="cozy-logo">wurd</div><p>We couldn’t connect. Please try again shortly.</p></div></main>;
  if (authLoading) return <main className="auth-stage"><div className="auth-card"><div className="cozy-logo">wurd</div><p>Getting today ready</p></div></main>;
  if (isSupabaseConfigured && !user) return <main className="lp lp-auth"><div className="lp-welcome"><div className="lp-brand">wurd</div><h1>Say less.</h1><p className="lp-lead">Your day in a word.<br />A little closer to your people.</p><div className="lp-example" aria-label="Example Wurd, not a live post"><span>@noa <span>Jerusalem · example</span></span><strong>GROUNDED</strong><div><MessageCircle size={19} /> SAME <span><EchoWaves /> 8</span></div></div><div className="lp-three"><p><Sun /> Share one Wurd a day.</p><p><EchoWaves /> Echo a feeling. Reply with a word.</p><p><Gamepad2 /> Guess together in The common wurd.</p></div><button className="lp-action google-sign-in" onClick={signIn}><GoogleLogo /> Continue with Google</button><PrivacyNote />{appError && <p className="lp-error" role="alert">{appError}</p>}</div></main>;
  if (profile && profile.username.startsWith('wurd_')) return <main className="lp lp-auth"><div className="lp-welcome"><div className="lp-brand">wurd</div><h1>Make it yours.</h1><p>A name, a Wurd, a little connection.</p><form className="lp-form" onSubmit={saveOnboarding}><label htmlFor="onboarding-username">Username</label><div className="lp-at-input"><span>@</span><Input id="onboarding-username" maxLength={24} value={usernameDraft} onChange={event => { setUsernameDraft(event.target.value); setAppError(''); }} placeholder="yourname" /></div><small>Your name here. Not your Google account name.</small><label htmlFor="onboarding-city">City <span className="lp-muted">optional</span></label><CityPicker id="onboarding-city" query={cityDraft} selected={citySelection} onQueryChange={value => { setCityDraft(value); setAppError(''); }} onSelect={setCitySelection} /><small>Visible on new posts. No GPS or street address.</small><button className="lp-action" type="submit" disabled={accountBusy}>{accountBusy ? 'Saving…' : 'Make it yours'} <ArrowRight size={18} /></button>{appError && <p className="lp-error" role="alert">{appError}</p>}</form></div></main>;

  const realXp = profile?.xp ?? 0;
  const levelTenPreview = isLevelTenPreview();
  const xp = levelTenPreview ? 5380 : realXp;
  const level = levelForXp(xp);
  const streak = profile?.streak_days ?? 0;
  const activeSubmitted = isSavedWurdActive(submittedAt, clockNow) ? submitted : '';
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
    reply_count: 3,
    spoke_count: spokeCount + 1,
    echoed_by_me: previewStrength > 0,
    my_echo_strength: previewStrength,
  };
  const visibleFeed = levelTenPreview ? [previewWord, ...feed.filter(item => item.id !== previewWord.id)] : feed;
  const ownEchoes = history.find(item => item.local_date === submittedLocalDate)?.echo_count ?? 0;
  return (
    <main className="lp live-product today-app"><BrandHeader xp={xp} level={level} streak={streak} onToday={() => setTab('today')} onProgress={() => setYouPanel('xp')} /><div className="lp-content">
      {tab === 'today' && headerSubmitted && <CurrentWurd word={headerSubmitted} submittedAt={submittedAt} now={clockNow} emoji={submittedEmoji} color={submittedColor} wordStyle={submittedWordStyle} animation={submittedAnimation} city={history.find(row => row.created_at === submittedAt)?.city ?? ownFeedWord?.city ?? profile?.city} countryCode={ownFeedWord?.created_at === submittedAt ? ownFeedWord.country_code : profile?.country_code} echoes={ownEchoes} replies={ownFeedWord?.user_id === user?.id && ownFeedWord?.created_at === submittedAt ? ownFeedWord.replies ?? [] : []} loading={feedLoading} canReplace={canReplace && !replacementMode} onReplace={() => setReplacementStep('explain')} />}
      {offline && <p className="offline-banner" role="status">You’re offline. Your draft stays here. Reconnect before posting or sending.</p>}{appError && <button className="app-error" onClick={() => setAppError('')}>{appError}</button>}
      {tab === 'today' && <TodayTab onPlay={() => setTab('play')} onFindFriends={() => { setSearchQuery(''); setSearchResults([]); setYouPanel('friends'); }} submitted={activeSubmitted} replacementMode={replacementMode} level={level} feed={visibleFeed.filter(item => isWithinTodayWindow(item.created_at, clockNow))} feedLoading={feedLoading} now={clockNow} spokeCount={visibleFeed.filter(item => isWithinTodayWindow(item.created_at, clockNow)).length + (activeSubmitted && feedMode !== 'Friends' ? 1 : 0)} feedMode={feedMode} setFeedMode={setFeedMode} setSubmitted={postWord} refreshFeed={async () => { if (!user) { window.location.reload(); return; } setAppError(''); try { await Promise.all([loadAccount(user), loadFeed(feedMode, user)]); } catch (reason) { setAppError(readableError(reason, 'Could not refresh today.')); } }} friendStateFor={friendStateFor} sendFriendRequest={sendFriendRequest} echoStrengths={echoStrengths} echoed={echoed} setEchoStrength={setEchoStrength} currentUserId={user?.id || null} currentUsername={profile?.username || 'you'} hasPostedToday={hasPostedToday} onAccountChanged={async () => { if (user) await Promise.all([loadConnections(user), loadAccount(user), loadFeed(feedMode,user)]); }} />}
      {tab === 'play' && <Suspense fallback={<p className="play-loading" role="status">Opening the games…</p>}><PlayTab key={user?.id || 'signed-out'} onXpChanged={syncGameXp} /></Suspense>}
      {tab === 'you' && <YouTab username={profile?.username} memberSince={profile?.created_at} avatarUrl={level >= 5 ? profilePhotoPreview : null} onToday={() => setTab('today')} history={history} loadEarlier={loadEarlier} hasEarlier={hasEarlier} historyBusy={historyBusy} incomingRequestCount={incomingRequestCount} onOpenPanel={panel => { setAppError(''); setSearchQuery(''); setSearchResults([]); setYouPanel(panel); if (panel === 'friends') void loadConnections(user || undefined).catch(reason => setAppError(readableError(reason, 'Could not load friends.'))); }} />}
    </div><nav className="lp-nav" aria-label="App navigation">{tabs.map(item => {
      if (item.id === 'play') return <PlayNavButton inlineIntroduction key={`play-${user?.id || 'local'}`} userId={user?.id || 'local'} active={tab === 'play'} paused={v21Step !== null || youPanel !== null || replacementStep !== null} onOpen={() => setTab('play')} />;
      const locked = item.id === 'world';
      return <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} className={`${tab === item.id ? 'active' : ''} ${locked ? 'locked' : ''}`} disabled={locked} title={locked ? 'Coming later' : item.label} onClick={() => setTab(item.id)}><item.icon />{locked && <Lock className="nav-lock" />}<span>{item.label}</span></button>;
    })}</nav>{profile && user && <YouToolsDialog panel={youPanel} setPanel={setYouPanel} userId={user.id} connections={connections} searchResults={searchResults} searchQuery={searchQuery} onSearchQueryChange={updateFriendSearch} searchPeople={searchPeople} sendFriendRequest={sendFriendRequest} acceptFriend={acceptFriend} declineFriend={declineFriend} unfriend={unfriend} xp={xp} level={level} streak={streak} saveSettings={saveSettings} signOut={signOut} usernameDraft={usernameDraft} setUsernameDraft={setUsernameDraft} cityDraft={cityDraft} setCityDraft={setCityDraft} citySelection={citySelection} setCitySelection={setCitySelection} profilePhoto={profilePhotoPreview} saveProfilePhoto={saveProfilePhoto} removeProfilePhoto={removeProfilePhoto} pushStatus={pushStatus} notificationPreferences={v21Notifications} notificationBusy={notificationBusy} notificationError={notificationError} setNotificationPreferences={setV21Notifications} enableNotifications={turnOnNotifications} saveNotificationPreferences={updateNotificationSettings} disableNotifications={turnOffNotifications} busy={accountBusy} accountError={appError} onAccountChanged={async () => { if (user) await Promise.all([loadConnections(user),loadAccount(user),loadFeed(feedMode,user)]); }} />}
      <Dialog open={replacementStep !== null} onOpenChange={open => { if (!open) setReplacementStep(null); }}><DialogContent className="replacement-dialog"><DialogHeader><DialogTitle>{replacementStep === 'confirm' ? 'Replace your current Wurd?' : 'A new day has started'}</DialogTitle><DialogDescription>{replacementStep === 'confirm' ? 'Posting a new Wurd will remove your existing active Wurd. This action cannot be undone.' : 'Your current Wurd will remain active until it expires, or you can replace it now with a new Wurd for today.'}</DialogDescription></DialogHeader>{replacementStep === 'confirm' ? <div className="replacement-actions"><Button variant="outline" onClick={() => setReplacementStep(null)}>Keep current Wurd</Button><Button onClick={() => { setReplacementStep(null); setReplacementMode(true); setTab('today'); }}>Replace &amp; post</Button></div> : <div className="replacement-actions"><Button variant="outline" onClick={() => setReplacementStep(null)}>Not now</Button><Button onClick={() => setReplacementStep('confirm')}>Post today&apos;s Wurd</Button></div>}</DialogContent></Dialog>
      <Dialog open={v21Step !== null} onOpenChange={open => { if (!open) setV21Step(null); }}><DialogContent className="v21-preview-dialog">
        {v21Step === 'home' && <><span className="v21-preview-label">V2.1 · 1 OF 2</span><div className="v21-feature-icon app-icon"><img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="Wurd Home Screen icon" /></div><DialogHeader><DialogTitle>Put wurd on your Home Screen.</DialogTitle><DialogDescription>Add it, then open wurd from the new W icon to continue.</DialogDescription></DialogHeader><div className="install-directions"><div><strong>iPhone</strong><span><Share2 /> Share</span><i>→</i><span>Add to Home Screen</span></div><div><strong>Android</strong><span>⋮ Menu</span><i>→</i><span>Install app</span></div></div><div className="replacement-actions"><Button variant="outline" onClick={() => { window.localStorage.setItem('wurd:v21:onboarding', 'done'); setV21Step(null); }}>Not now</Button><Button onClick={() => setV21Step(isInstalledApp() || isV21Preview() ? 'notifications' : 'open-installed')}>It&apos;s on my Home Screen</Button></div></>}
        {v21Step === 'open-installed' && <><span className="v21-preview-label">V2.1 · 1 OF 2</span><div className="v21-feature-icon app-icon"><img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="Wurd Home Screen icon" /></div><DialogHeader><DialogTitle>Open wurd from your Home Screen.</DialogTitle><DialogDescription>Alerts can be turned on after you open the installed W app.</DialogDescription></DialogHeader><Button onClick={() => { window.localStorage.setItem('wurd:v21:onboarding', 'done'); setV21Step(null); }}>Got it</Button></>}
        {v21Step === 'notifications' && <><span className="v21-preview-label">V2.1 · 2 OF 2</span><div className="v21-feature-icon"><Bell /></div><DialogHeader><DialogTitle>Stay close to your people.</DialogTitle><DialogDescription>Choose what Wurd can tell you about. No daily reminders. No noise.</DialogDescription></DialogHeader><div className="v21-notification-types"><button type="button" className={v21Notifications.requests ? 'active' : ''} aria-pressed={v21Notifications.requests} onClick={() => setV21Notifications(current => ({ ...current, requests: !current.requests }))}><span><UserPlus /></span><div><strong>Friend requests</strong><small>When someone wants to connect.</small></div><i>{v21Notifications.requests && <Check />}</i></button><button type="button" className={v21Notifications.friendWords ? 'active' : ''} aria-pressed={v21Notifications.friendWords} onClick={() => setV21Notifications(current => ({ ...current, friendWords: !current.friendWords }))}><span className="wurd-alert-mark">w</span><div><strong>Friends&apos; Wurds</strong><small>When a friend posts a new Wurd.</small></div><i>{v21Notifications.friendWords && <Check />}</i></button><button type="button" className={v21Notifications.replies ? 'active' : ''} aria-pressed={v21Notifications.replies} onClick={() => setV21Notifications(current => ({ ...current, replies: !current.replies }))}><span><MessageCircle /></span><div><strong>Replies to your Wurd</strong><small>When someone replies to your post.</small></div><i>{v21Notifications.replies && <Check />}</i></button></div>{notificationError && <em className="notification-error">{notificationError}</em>}<div className="replacement-actions"><Button variant="outline" disabled={notificationBusy} onClick={() => { window.localStorage.setItem('wurd:v21:onboarding', 'done'); setV21Step(null); }}>Not now</Button><Button disabled={notificationBusy || (!v21Notifications.requests && !v21Notifications.friendWords && !v21Notifications.replies)} onClick={() => void turnOnNotifications()}>{notificationBusy ? 'Turning on…' : 'Turn on alerts'}</Button></div></>}
        {v21Step === 'complete' && <><span className="v21-preview-label">V2.1</span><div className="v21-feature-icon complete"><Check /></div><DialogHeader><DialogTitle>You&apos;re set.</DialogTitle><DialogDescription>Your selected alerts are on. You can change them later in Settings.</DialogDescription></DialogHeader><Button onClick={() => setV21Step(null)}>Done</Button></>}
      </DialogContent></Dialog>
    </main>
  );
}
