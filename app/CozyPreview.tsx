'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  CircleUserRound, Flame, Globe2, Lock, MapPin,
  Sparkles, Sun, Waves,
} from 'lucide-react';
import { geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countries110 from 'world-atlas/countries-110m.json';
import type { FeatureCollection } from 'geojson';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type Tab = 'today' | 'world' | 'you';
type Scope = 'World' | 'Israel' | 'Nearby';

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

const calendarWeeks = [
  {
    label: 'August 23–29',
    days: [
      ['Sunday', '23', 'SLOW', 6], ['Monday', '24', 'WORK', 14], ['Tuesday', '25', 'OPEN', 9], ['Wednesday', '26', 'SUN', 18],
      ['Thursday', '27', 'BUSY', 11], ['Friday', '28', 'EXCITED', 22], ['Saturday', '29', 'TIRED', 31],
    ],
  },
  {
    label: 'August 30–September 5',
    days: [
      ['Sunday', '30', 'FAMILY', 27], ['Monday', '31', 'GEMS', 8], ['Tuesday', '1', 'HOME', 19], ['Wednesday', '2', 'CALM', 16],
      ['Thursday', '3', 'TODAY', 0], ['Friday', '4', '', 0], ['Saturday', '5', '', 0],
    ],
  },
  {
    label: 'September 6–12',
    days: [
      ['Sunday', '6', '', 0], ['Monday', '7', '', 0], ['Tuesday', '8', '', 0], ['Wednesday', '9', '', 0],
      ['Thursday', '10', '', 0], ['Friday', '11', '', 0], ['Saturday', '12', '', 0],
    ],
  },
] as const;

function localDayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function todayLabel() {
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
}

function BrandHeader({ submitted, compact, xp }: { submitted: string; compact: boolean; xp: number }) {
  const anonymousEchoes = submitted ? 37 + submitted.length * 11 : 0;
  const levelProgress = Math.min(100, Math.max(0, (xp - 600) / 4));
  if (submitted && compact) return (
    <header className="today-app-header">
      <div className="today-brand-row"><div className="today-brand">WURD</div><div className="header-xp"><Sparkles /><span><strong>{xp} XP</strong><small>LEVEL 4</small><i><b style={{ width: `${levelProgress}%` }} /></i></span></div></div>
      <strong className="today-word">{submitted}</strong>
      <div className="today-meta-row"><p>{todayLabel()}</p><span><Waves />{anonymousEchoes}</span></div>
    </header>
  );
  return <header className="cozy-header">{submitted ? <div className="your-word-header"><strong>{submitted}</strong><span><Waves />{anonymousEchoes}</span></div> : <div className="cozy-logo">wurd</div>}<p>{todayLabel()}</p></header>;
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

function TodayTab({ submitted, setSubmitted, echoed, toggleEcho }: { submitted: string; setSubmitted: (word: string) => void; echoed: string[]; toggleEcho: (id: string) => void }) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [feedMode, setFeedMode] = useState<'Top today' | 'Friends'>('Top today');
  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean || /\s/.test(clean)) { setError('Just one word — no spaces.'); return; }
    setPending(clean.toUpperCase());
  }
  if (!submitted) return (
    <section className="tab-view today-view"><div className="daily-prompt">
      {!pending ? <><span className="soft-icon"><Sun /></span><p>YOUR ONE POST TODAY</p><h1>What&apos;s your<br />word?</h1><small>Choose the single word that represents your day.</small><form onSubmit={submit}><Input autoFocus maxLength={24} value={draft} onChange={event => { setDraft(event.target.value); setError(''); }} placeholder="TYPE YOUR WORD" /><Button type="submit">Continue</Button></form><em>{error || 'Everything else unlocks after you post.'}</em></> :
      <div className="confirm-word"><span>YOUR WORD FOR {todayLabel().toUpperCase()}</span><h2>{pending}</h2><p>This is the only word you can post today. At midnight, you&apos;ll get a new one.</p><div><Button variant="outline" onClick={() => setPending('')}>Go back</Button><Button onClick={() => setSubmitted(pending)}>Post my word</Button></div></div>}
    </div></section>
  );
  const topPeople = [...livePeople].sort((left, right) => right[6] - left[6]).slice(0, 8);
  return (
    <section className="tab-view live-view">
      <div className="today-toolbar"><span><i />{feedMode === 'Top today' ? '1,284 spoke' : '8 of 12 spoke'}</span><div className="today-mode cozy-segments"><button className={feedMode === 'Top today' ? 'active' : ''} onClick={() => setFeedMode('Top today')}>Top</button><button className={feedMode === 'Friends' ? 'active' : ''} onClick={() => setFeedMode('Friends')}>Friends</button></div></div>
      {feedMode === 'Top today' ? <>
        <div className="live-grid">{topPeople.map((person, index) => <LiveCard key={`${person[0]}-${person[2]}`} person={person} echoed={echoed.includes(`live-${index}`)} onEcho={() => toggleEcho(`live-${index}`)} />)}</div>
      </> : <>
        <div className="friends-card-grid">{friends.map(friend => <FriendCard key={friend.id} friend={friend} match={friend.word === submitted} echoed={echoed.includes(friend.id)} onEcho={() => toggleEcho(friend.id)} />)}</div>
      </>}
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
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${scope} word map`}>
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

function YouTab({ submitted, xp }: { submitted: string; xp: number }) {
  const weekTrack = useRef<HTMLDivElement>(null);
  const levelProgress = Math.min(400, Math.max(0, xp - 600));
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (weekTrack.current) weekTrack.current.scrollLeft = weekTrack.current.clientWidth + 12;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <section className="tab-view you-view"><div className="profile-cozy profile-simple"><div className="profile-ring"><span>OS</span></div><div><span>YOUR ONE-WORD DIARY</span><h1>Otsar</h1><p><MapPin /> Tel Aviv</p></div></div>
      <div className="progress-card">
        <div className="level-progress"><div><span>LEVEL 4</span><strong>{xp} XP</strong></div><div className="xp-track"><i style={{ width: `${levelProgress / 4}%` }} /></div><p><span>{levelProgress} / 400</span><b>{Math.max(0, 1000 - xp)} XP to Level 5</b></p></div>
        <div className="streak-multiplier"><Flame /><strong>12</strong><span>day streak</span><b>1.2×</b><small>daily XP</small></div>
      </div>
      <div className="calendar-head"><div><span>YOUR WORD CALENDAR</span><h2>Weeks in words</h2></div><small>SWIPE WEEKS →</small></div>
      <div className="week-track" ref={weekTrack}>{calendarWeeks.map((week, weekIndex) => <section className="week-page" key={week.label} aria-label={week.label}>
        <h3>{week.label}</h3><div className="week-grid">{week.days.map(([weekday, date, storedWord, echoes], dayIndex) => {
          const isToday = weekIndex === 1 && dayIndex === 4;
          const isFuture = weekIndex === 2 || (weekIndex === 1 && dayIndex > 4);
          const word = isToday ? submitted : storedWord;
          return <article className={`day-cell ${isToday ? 'is-today' : ''} ${isFuture ? 'is-future' : ''}`} key={`${weekday}-${date}`}><span>{weekday}</span><strong>{date}</strong><b>{word || '—'}</b><small>{word ? <><Waves />{isToday ? 37 + submitted.length * 11 : echoes}</> : 'Not yet'}</small></article>;
        })}</div>
      </section>)}</div>
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
  const [echoed, setEchoed] = useState<string[]>([]);

  useEffect(() => {
    const word = window.localStorage.getItem(`wurd:daily:${dayKey}`) || '';
    const savedEchoes = window.localStorage.getItem(`wurd:echoes:${dayKey}`);
    setSubmittedState(word);
    try { setEchoed(savedEchoes ? JSON.parse(savedEchoes) : []); } catch { setEchoed([]); }
    if (!word) setTab('today');
    const timer = window.setInterval(() => {
      const nextDay = localDayKey();
      if (nextDay !== dayKey) { setDayKey(nextDay); setSubmittedState(''); setEchoed([]); setTab('today'); }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [dayKey]);

  function postWord(word: string) {
    setSubmittedState(word);
    window.localStorage.setItem(`wurd:daily:${dayKey}`, word);
  }
  function toggleEcho(id: string) {
    setEchoed(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
      window.localStorage.setItem(`wurd:echoes:${dayKey}`, JSON.stringify(next));
      return next;
    });
  }
  return (
    <main className={`cozy-stage fixed-app active-${tab} ${tab === 'today' && submitted ? 'today-app' : ''}`}><section className="cozy-shell"><BrandHeader submitted={submitted} compact={tab === 'today'} xp={852 + echoed.length} /><div className="cozy-main">
      {tab === 'today' && <TodayTab submitted={submitted} setSubmitted={postWord} echoed={echoed} toggleEcho={toggleEcho} />}
      {tab === 'world' && <WorldTab />}
      {tab === 'you' && <YouTab submitted={submitted} xp={852 + echoed.length} />}
    </div><nav className="cozy-nav" aria-label="App navigation">{tabs.map(item => {
      const locked = !submitted && item.id === 'world';
      return <button key={item.id} className={`${tab === item.id ? 'active' : ''} ${locked ? 'locked' : ''}`} disabled={locked} title={locked ? 'Post today’s word to unlock' : item.label} onClick={() => setTab(item.id)}><item.icon />{locked && <Lock className="nav-lock" />}<span>{item.label}</span></button>;
    })}</nav></section></main>
  );
}
