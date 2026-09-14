import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, RefreshCw, Send, UsersRound } from 'lucide-react';
import { commonWurdRequest, gameCountdown, type CommonWurdState } from '../lib/common-wurd';
import { menuTimeLeft, normalizeAnswer } from '../lib/category-game';
import { checkEnglishSpelling } from '../lib/english-spelling';
import './category-prototype.css';

type Review = { original: string; chosen: string; suggestions: string[]; known: boolean; warning?: string };

export default function PlayTab({ onXpChanged }: { onXpChanged: (xp: number) => void }) {
  const [model, setModel] = useState<CommonWurdState | null>(null);
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [draft, setDraft] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const anchor = useRef({ server: 0, local: 0 });
  const modelRef = useRef<CommonWurdState | null>(null);
  const requestId = useRef(0);
  const actionBusy = useRef(false);
  const expiryAttempt = useRef('');
  const spellingAttempt = useRef(0);

  const apply = useCallback((data: CommonWurdState) => {
    const changedRound = modelRef.current?.round?.id !== data.round?.id;
    modelRef.current = data;
    anchor.current = { server: Date.parse(data.server_now), local: performance.now() };
    setNow(anchor.current.server);
    setModel(data);
    if (Number.isFinite(data.profile_xp)) onXpChanged(data.profile_xp);
    if (changedRound || data.my_answer || data.ended) {
      spellingAttempt.current++;
      setReview(null); setDraft(''); setChecking(false);
    }
  }, [onXpChanged]);

  const load = useCallback(async () => {
    if (actionBusy.current) return;
    const id = ++requestId.current;
    setBusy(true); setError('');
    try {
      const data = await commonWurdRequest('common_wurd_state');
      if (id === requestId.current) apply(data);
    } catch (reason) {
      if (id === requestId.current) setError(reason instanceof Error ? reason.message : 'Could not load the game. Try again.');
    } finally { if (id === requestId.current) setBusy(false); }
  }, [apply]);

  useEffect(() => {
    void load();
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      if (anchor.current.server) setNow(anchor.current.server + performance.now() - anchor.current.local);
    }, 1000);
    return () => {
      requestId.current++; spellingAttempt.current++;
      clearInterval(timer); document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const round = model?.round;
  const deadline = round ? Date.parse(round.ends_at) : 0;
  const closed = Boolean(round && (model?.ended || now >= deadline));
  // One fetch at expiration, not a recurring network refresh loop.
  useEffect(() => {
    if (round && closed && !model?.ended && expiryAttempt.current !== round.id && !busy) {
      expiryAttempt.current = round.id;
      void load();
    }
  }, [round, closed, model?.ended, busy, load]);

  async function prepareAnswer(event: FormEvent) {
    event.preventDefault();
    if (checking || busy || closed || model?.my_answer) return;
    const word = normalizeAnswer(draft);
    if (!word) { setError('Enter one word, up to 30 letters.'); return; }
    const id = ++spellingAttempt.current;
    setError(''); setChecking(true);
    try {
      const spelling = await checkEnglishSpelling(word);
      if (id === spellingAttempt.current) setReview({ original: word, chosen: word, ...spelling });
    } catch (reason) {
      if (id === spellingAttempt.current) setReview({ original: word, chosen: word, known: false, suggestions: [], warning: reason instanceof Error ? reason.message : 'Please check the spelling before confirming.' });
    } finally { if (id === spellingAttempt.current) setChecking(false); }
  }

  async function act(action: 'submit_common_wurd' | 'acknowledge_common_wurd') {
    if (!round || actionBusy.current || (action === 'submit_common_wurd' && (!review || closed))) return;
    actionBusy.current = true;
    const id = ++requestId.current;
    setBusy(true); setError('');
    try {
      const data = await commonWurdRequest(action, { p_round_id: round.id, ...(action === 'submit_common_wurd' ? { p_answer: review!.chosen } : {}) });
      if (id === requestId.current) {
        apply(data);
        if (action === 'acknowledge_common_wurd') setView('menu');
      }
    } catch (reason) {
      if (id === requestId.current) setError(reason instanceof Error ? reason.message : 'Could not save. Try again.');
      // A response may have been lost after a successful insert. Recover the
      // locked answer before allowing another attempt; identical retries are safe.
      try {
        const data = await commonWurdRequest('common_wurd_state');
        if (id === requestId.current) apply(data);
      } catch { /* Keep the original error and the user's reviewed answer. */ }
    } finally {
      actionBusy.current = false;
      if (id === requestId.current) setBusy(false);
    }
  }

  const remainingFraction = round ? Math.max(0, Math.min(1, (deadline - now) / (deadline - Date.parse(round.starts_at)))) : 0;
  return <section className="category-scroll common-wurd-live" aria-label="Play">
    {view === 'menu' ? <div className="category-heading category-menu-heading"><h1>Play.</h1><button className="category-refresh" onClick={() => void load()} disabled={busy} aria-label="Refresh games"><RefreshCw /></button></div>
      : <div className="category-heading category-game-heading"><button aria-label="Back to games" onClick={() => setView('menu')}><ArrowLeft /></button><h1>The common wurd.</h1></div>}
    {error && <p className="category-error" role="alert">{error} <button className="category-retry" onClick={() => void load()} disabled={busy}>Retry</button></p>}
    {!model && <p role="status">{busy ? 'Opening the games…' : 'The game could not be loaded.'}</p>}
    {model && !round && <p>The next round is being prepared. Check back soon.</p>}
    {model && round && (view === 'menu' ? <>
      <button className={`category-game-row ${closed ? 'ended' : ''}`} onClick={() => { setView('game'); void load(); }}>
        <strong>The common wurd</strong>
        <span className={`category-menu-status ${model.my_answer ? 'played' : ''}`}>{model.my_answer && <Check />}<span>{model.my_answer ? 'Played' : 'Not played'}</span></span>
        <span className="category-menu-time">{closed ? 'Ended' : menuTimeLeft(deadline, now)}</span>
      </button>
      {closed && <p className="category-menu-note">Your round has ended. Open the game to see the results.</p>}
    </> : <>
      <div className="category-round">
        <div className="category-countdown" role="timer" aria-label={closed ? 'Round ended' : `${gameCountdown(deadline, now)} remaining, hours, minutes and seconds`}>
          <svg className="category-clock" viewBox="0 0 48 48" aria-hidden="true">
            <circle className="category-clock-track" cx="24" cy="24" r="20" />
            <circle className="category-clock-progress" cx="24" cy="24" r="20" pathLength="100" strokeDasharray="100" strokeDashoffset={100 * (1 - remainingFraction)} transform="rotate(-90 24 24)" />
            <path className="category-clock-hand" d="M24 24V12" transform={`rotate(${360 * (1 - remainingFraction)} 24 24)`} />
            <circle className="category-clock-pin" cx="24" cy="24" r="2" />
          </svg>
          <div><strong>{gameCountdown(deadline, now)}</strong><small>{closed ? 'Round ended' : 'Time left'}</small></div>
        </div>
        <button className="category-refresh" onClick={() => void load()} disabled={busy} aria-label="Refresh round"><RefreshCw /></button>
      </div>
      <section className="category-question">
        <div className="category-eyebrow"><span>THIS ROUND</span></div>
        <h2>{round.prompt}</h2><p>Choose the answer most people will pick.</p>
        {!closed && !model.my_answer && (!review ? <form onSubmit={prepareAnswer}>
          <label htmlFor="common-wurd-answer">Your guess</label>
          <div className="category-input"><input id="common-wurd-answer" value={draft} disabled={checking || busy} onChange={event => { setDraft(event.target.value); setError(''); }} placeholder="Type your answer…" maxLength={30} autoComplete="off" spellCheck lang="en" /><button type="submit" aria-label="Review my answer" disabled={!draft.trim() || checking || busy}><Send /></button></div>
          <small><LockKeyhole />{checking ? 'Checking spelling…' : 'One answer. Locked after you confirm.'}</small>
        </form> : <div className="category-answer-review">
          <h3>{review.suggestions.length ? 'Did you mean?' : 'Ready to lock it in?'}</h3>
          {review.warning && <p>{review.warning}</p>}
          {!review.known && !review.suggestions.length && !review.warning && <p>We don’t recognize this spelling. You can keep it or go back.</p>}
          {review.suggestions.length > 0 && <div className="category-spelling-options">{[...review.suggestions, review.original].map(word => <button type="button" key={word} disabled={busy} aria-pressed={word === review.chosen} onClick={() => setReview({ ...review, chosen: word })}>{word === review.original ? `Keep “${word}”` : word}</button>)}</div>}
          <strong className="category-answer-choice">{review.chosen}</strong>
          {review.chosen !== review.original && <p>Corrected from “{review.original}”</p>}
          <small>You can’t edit your answer after confirming.</small>
          <div className="category-confirm-actions"><button type="button" disabled={busy} onClick={() => setReview(null)}>Go back</button><button type="button" disabled={busy} onClick={() => void act('submit_common_wurd')}>{busy ? 'Saving…' : 'Confirm answer'}</button></div>
        </div>)}
        {!closed && model.my_answer && <div className="category-locked"><span><Check /> YOUR ANSWER IS LOCKED</span><strong>{model.my_answer.toUpperCase()}</strong></div>}
        {model.ended && <div className="category-score"><div><span>{model.my_answer ? 'YOU PICKED' : 'YOU SAT THIS ONE OUT'}</span>{model.my_answer && <strong>{model.my_answer.toUpperCase()}</strong>}</div><div><b>+{model.xp_awarded}</b><span>XP</span></div></div>}
      </section>
      {model.ended ? <section className="category-results">
        <div className="category-section-title"><h2>The people have spoken.</h2><span>{model.answer_count} answers</span></div>
        {model.results.length ? <ol>{model.results.map((row, index) => <li key={row.answer} className={row.answer === model.my_answer ? 'your-answer' : ''}>
          <span className="category-rank">{String(index + 1).padStart(2, '0')}</span>
          <div><strong>{row.answer.toUpperCase()}{row.answer === model.my_answer && <small>YOU</small>}</strong><p>{row.usernames.map(name => `@${name}`).join(' · ')}</p><i><b style={{ width: `${row.count / model.answer_count * 100}%` }} /></i></div>
          <span className="category-row-score"><b>{row.count}</b><small>XP each</small></span>
        </li>)}</ol> : <p>No answers this round.</p>}
        <p className="category-explanation">{model.total_game_xp} XP earned playing · Counts toward your Wurd level</p>
        <button className="category-next" disabled={busy} onClick={() => void act('acknowledge_common_wurd')}>Continue to next round <ArrowRight /></button>
      </section> : closed ? <p role="status">{busy ? 'Opening the results…' : 'Results are ready to load.'}</p>
        : <section className="category-hidden"><div><UsersRound /><strong>{model.answer_count} {model.answer_count === 1 ? 'answer' : 'answers'} sealed</strong></div><p>No peeking. Everyone’s answers open together.</p></section>}
    </>)}
  </section>;
}
