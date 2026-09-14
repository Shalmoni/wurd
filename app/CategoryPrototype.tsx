import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleUserRound, Gamepad2, LockKeyhole, Send, Sun, UsersRound } from 'lucide-react';
import { answerBoard, israelRound, menuTimeLeft, normalizeColor, roundForReview } from '../lib/category-game';
import './category-prototype.css';

const demoAnswers = ['red', 'red', 'white', 'blue'];
const demoNames: Record<string, string[]> = { red: ['maya', 'alex'], white: ['sam'], blue: ['noah'] };
// A new restart token opens a fresh local demo without erasing earlier runs.
const keyFor = (id: string) => `wurd:category-prototype:${id}${new URLSearchParams(window.location.search).get('restart') ? `:run:${new URLSearchParams(window.location.search).get('restart')}` : ''}`;
function savedAnswer(id: string) { try { return normalizeColor(localStorage.getItem(keyFor(id)) || ''); } catch { return null; } }
function initialRound() {
  try { return roundForReview(Date.now(), localStorage.getItem(keyFor('review-round'))); }
  catch { return israelRound(Date.now()); }
}
function remaining(deadline: number, now: number) {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

export default function CategoryPrototype() {
  const [round, setRound] = useState(initialRound);
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [now, setNow] = useState(Date.now);
  const [answer, setAnswer] = useState(() => savedAnswer(round.id));
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    try { localStorage.setItem(keyFor('review-round'), String(round.startsAt)); } catch { /* In-memory review still works. */ }
  }, [round]);
  const closed = now >= round.endsAt;
  const remainingFraction = Math.max(0, Math.min(1, (round.endsAt - now) / (round.endsAt - round.startsAt)));
  const scene = closed ? 'results' : answer ? 'waiting' : 'answer';
  const shownAnswer = answer;
  const board = answerBoard([...demoAnswers, ...(shownAnswer ? [shownAnswer] : [])]);
  const points = board.find(row => row.answer === shownAnswer)?.count ?? 0;
  const total = demoAnswers.length + (shownAnswer ? 1 : 0);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (Date.now() >= round.endsAt) { setNow(Date.now()); return; }
    if (answer) return;
    const normalized = normalizeColor(draft);
    if (!normalized) { setError('Try a color like red, blue, coral, or gray. This demo has a small accepted-color list.'); return; }
    try { localStorage.setItem(keyFor(round.id), normalized); } catch { /* In-memory demo still works. */ }
    setAnswer(normalized);
    setDraft(''); setError('');
  }
  function nextRound() { const next = israelRound(Date.now()); setRound(next); setAnswer(savedAnswer(next.id)); setDraft(''); setError(''); setView('menu'); }
  return <main className="cozy-stage fixed-app category-prototype"><section className="cozy-shell">
    <header className="category-brand"><span>wurd</span><small>LOCAL PROTOTYPE</small></header>
    <div className="category-scroll" key={view}>
      {view === 'menu' ? <section className="category-menu">
        <div className="category-heading"><h1>Play.</h1></div>
        <button className={`category-game-row ${closed ? 'ended' : ''}`} onClick={() => setView('game')}>
          <strong>The common wurd</strong>
          <span className={`category-menu-status ${answer ? 'played' : ''}`}>{answer && <Check />}<span>{answer ? 'Played' : 'Not played'}</span></span>
          <span className="category-menu-time">{menuTimeLeft(round.endsAt, now)}</span>
        </button>
        {closed && <p className="category-menu-note">Your round has ended. Open the game to see the results.</p>}
      </section> : <>
      <div className="category-heading category-game-heading"><button aria-label="Back to games" onClick={() => setView('menu')}><ArrowLeft /></button><h1>The common wurd.</h1></div>
      <div className="category-round">
        <div className="category-countdown" role="timer" aria-label={`${remaining(round.endsAt, now)} remaining, hours, minutes and seconds`}>
          <svg className="category-clock" viewBox="0 0 48 48" aria-hidden="true">
            <circle className="category-clock-track" cx="24" cy="24" r="20" />
            <circle className="category-clock-progress" cx="24" cy="24" r="20" pathLength="100" strokeDasharray="100" strokeDashoffset={100 * (1 - remainingFraction)} transform="rotate(-90 24 24)" />
            <path className="category-clock-hand" d="M24 24V12" transform={`rotate(${360 * (1 - remainingFraction)} 24 24)`} />
            <circle className="category-clock-pin" cx="24" cy="24" r="2" />
          </svg>
          <div><strong>{remaining(round.endsAt, now)}</strong><small>{closed ? 'Round revealed' : 'Time left'}</small></div>
        </div>
      </div>
      <section className={`category-question ${scene}`}>
        <div className="category-eyebrow"><span>THIS ROUND</span></div>
        <h2>Name a color.</h2><p>Choose the answer most people will pick.</p>
        {scene === 'answer' && <form onSubmit={submit}><label htmlFor="category-answer">Your guess</label><div className="category-input"><input id="category-answer" value={draft} onChange={event => { setDraft(event.target.value); setError(''); }} placeholder="Type a color…" maxLength={30} autoComplete="off" /><button type="submit" aria-label="Lock in my answer" disabled={!draft.trim()}><Send /></button></div>{error && <p className="category-error" role="alert">{error}</p>}<small><LockKeyhole /> One answer. Locked until the reveal.</small></form>}
        {scene === 'waiting' && <div className="category-locked"><span><Check /> YOUR ANSWER IS LOCKED</span><strong>{shownAnswer?.toUpperCase()}</strong></div>}
        {scene === 'results' && <div className="category-score"><div><span>{shownAnswer ? 'YOU PICKED' : 'YOU SAT THIS ONE OUT'}</span>{shownAnswer && <strong>{shownAnswer.toUpperCase()}</strong>}</div><div><b>+{points}</b><span>GAME {points === 1 ? 'POINT' : 'POINTS'}</span></div></div>}
      </section>
      {scene === 'results' ? <section className="category-results"><div className="category-section-title"><h2>The people have spoken.</h2><span>{total} answers</span></div><ol>{board.map((row, index) => <li key={row.answer} className={row.answer === shownAnswer ? 'your-answer' : ''}><span className="category-rank">{String(index + 1).padStart(2, '0')}</span><div><strong>{row.answer.toUpperCase()}{row.answer === shownAnswer && <small>YOU</small>}</strong><p>{[...(demoNames[row.answer] ?? []), ...(row.answer === shownAnswer ? ['you'] : [])].map(name => `@${name}`).join(' · ')}</p><i><b style={{ width: `${row.count / total * 100}%` }} /></i></div><span className="category-row-score"><b>{row.count}</b><small>{row.count === 1 ? 'point each' : 'points each'}</small></span></li>)}</ol><p className="category-explanation">{shownAnswer ? `${points} ${points === 1 ? 'person picked' : 'people picked'} ${shownAnswer}, including you. You ${points > 1 ? 'each get' : 'get'} ${points} ${points === 1 ? 'point' : 'points'}.` : 'Each player earns one point for every person who chose the same answer.'}</p>{closed && <button className="category-next" onClick={nextRound}>Join the new round <ArrowRight /></button>}</section> : <section className="category-hidden"><div><UsersRound /><strong>{demoAnswers.length + (scene === 'waiting' ? 1 : 0)} answers sealed</strong><span>DEMO GROUP</span></div><p>No peeking. Everyone’s answers open together.</p></section>}
      </>}
    </div>
    <nav className="cozy-nav" aria-label="App navigation"><button onClick={() => { window.location.href = '/'; }}><Sun /><span>Today</span></button><button className="active" onClick={() => setView('menu')}><Gamepad2 /><span>Play</span></button><button onClick={() => setNotice('Your real profile is unchanged. Open Today to return to the app.')}><CircleUserRound /><span>You</span></button></nav>
    {notice && <button className="category-notice" onClick={() => setNotice('')} role="status">{notice} · Dismiss</button>}
  </section></main>;
}
