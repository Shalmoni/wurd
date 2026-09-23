import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, RefreshCw, Shield, Gamepad2, ChevronRight, HelpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { commonWurdRequest, gameCountdown, type CommonWurdState } from '../lib/common-wurd';
import { menuTimeLeft, normalizeAnswer } from '../lib/category-game';
import { checkEnglishSpelling } from '../lib/english-spelling';
import { skipEmptyUnplayedRound } from '../lib/game-round-navigation';
import GameInviteButton from './GameInviteButton';

type Review = { original: string; chosen: string; suggestions: string[]; known: boolean; warning?: string };

export default function PlayTab({ onXpChanged, request = commonWurdRequest, invited = false, onInviteOpened }: { onXpChanged: (xp: number) => void; request?: typeof commonWurdRequest; invited?: boolean; onInviteOpened?: () => void }) {
  const [model, setModel] = useState<CommonWurdState | null>(null);
  const [view, setView] = useState<'menu' | 'game'>(invited ? 'game' : 'menu');
  useEffect(() => { if (invited) { setView('game'); onInviteOpened?.(); } }, [invited, onInviteOpened]);
  const [helpOpen, setHelpOpen] = useState(false);
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
      const initial = await request('common_wurd_state');
      let data = initial;
      try {
        data = await skipEmptyUnplayedRound(initial,
          roundId => request('acknowledge_common_wurd', { p_round_id: roundId }),
          () => id === requestId.current);
      } catch { /* Keep the ended round available if advancing is unavailable. */ }
      if (id === requestId.current) apply(data);
    } catch (reason) {
      if (id === requestId.current) setError(reason instanceof Error ? reason.message : 'Could not load the game. Try again.');
    } finally { if (id === requestId.current) setBusy(false); }
  }, [apply, request]);

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
      const data = await request(action, { p_round_id: round.id, ...(action === 'submit_common_wurd' ? { p_answer: review!.chosen } : {}) });
      if (id === requestId.current) {
        apply(data);
        if (action === 'acknowledge_common_wurd') setView('menu');
      }
    } catch (reason) {
      if (id === requestId.current) setError(reason instanceof Error ? reason.message : 'Could not save. Try again.');
      // A response may have been lost after a successful insert. Recover the
      // locked answer before allowing another attempt; identical retries are safe.
      try {
        const data = await request('common_wurd_state');
        if (id === requestId.current) apply(data);
      } catch { /* Keep the original error and the user's reviewed answer. */ }
    } finally {
      actionBusy.current = false;
      if (id === requestId.current) setBusy(false);
    }
  }

  const remainingFraction = round ? Math.max(0, Math.min(1, (deadline - now) / (deadline - Date.parse(round.starts_at)))) : 0;
  return <section className="production-play" aria-label="Play">
    {view === 'menu' ? <div className="lp-page-title production-play-heading"><span className="lp-kicker">A LITTLE REASON TO COME BACK</span><h1>Play together.</h1><p>Different days. Common ground.</p><button className="lp-icon" onClick={() => void load()} disabled={busy} aria-label="Refresh games"><RefreshCw size={20} /></button></div>
      : <><button className="lp-back" aria-label="Back to games" onClick={() => setView('menu')}><ArrowLeft size={18} /> Games</button><h1 className="lp-game-title">The common wurd.</h1></>}
    {error && <p className="lp-error" role="alert">{error} <button onClick={() => void load()} disabled={busy}>Retry</button></p>}
    <GameInviteButton />
    {!model && <p role="status">{busy ? 'Opening the games…' : 'The game could not be loaded.'}</p>}
    {model && !round && <p>The next round is being prepared. Check back soon.</p>}
    {model && round && (view === 'menu' ? <>
      <button className="lp-game-menu" onClick={() => { setView('game'); void load(); }}>
        <span className="lp-game-symbol"><Gamepad2 /></span><span><strong>The common wurd</strong><small>{closed ? 'The results are in' : model.my_answer ? 'You’re in. Answer sealed.' : 'One question. Think like everyone.'}</small></span>
        <span className="lp-game-state">{model.my_answer ? <Check size={18} /> : <i />}{closed ? 'Results' : menuTimeLeft(deadline, now)}<ChevronRight size={17} /></span>
      </button>
      <div className="lp-play-note"><h2>Not your Wurd of the day.</h2><p>This is a little game you play together. Guess the most popular answer. Everyone reveals at the same time.</p><button className="lp-text-button" onClick={() => setHelpOpen(true)}>How it works <HelpCircle size={16} /></button></div>
    </> : <>
      <div className="lp-timer production-round">
        <svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" /><circle className="lp-clock-progress" cx="22" cy="22" r="18" pathLength="100" strokeDasharray="100" strokeDashoffset={100 * (1 - remainingFraction)} /></svg>
        <div role="timer" aria-label={closed ? 'Round ended' : `${gameCountdown(deadline, now)} remaining, hours, minutes and seconds`}><strong>{closed ? 'The reveal' : gameCountdown(deadline, now)}</strong><span>{closed ? 'Here’s what we had in common.' : 'Until answers open together'}</span></div>
        <button className="lp-icon" onClick={() => void load()} disabled={busy} aria-label="Refresh round"><RefreshCw size={20} /></button>
      </div>
      <section className="lp-game-question">
        <span className="lp-kicker">THIS ROUND</span><h2>{round.prompt}</h2><p>Choose the answer most people will pick.</p>
        {!closed && !model.my_answer && (!review ? <form className="lp-form" onSubmit={prepareAnswer}>
          <label className="lp-sr-only" htmlFor="common-wurd-answer">Your answer</label>
          <div className="lp-answer-field"><input id="common-wurd-answer" value={draft} disabled={checking || busy} onChange={event => { setDraft(event.target.value); setError(''); }} placeholder="Your guess…" maxLength={30} autoComplete="off" spellCheck lang="en" /><button type="submit" aria-label="Review answer" disabled={!draft.trim() || checking || busy}><ArrowRight size={22} /></button></div>
          <small>{checking ? 'Checking spelling on your device…' : 'One answer. Review it before you lock it in.'}</small>
        </form> : <div className="lp-guess-review">
          <h3>{review.suggestions.length ? 'Did you mean?' : 'Ready to lock it in?'}</h3>
          {review.warning && <p>{review.warning}</p>}
          {!review.known && !review.suggestions.length && !review.warning && <p>We don’t recognize this spelling. You can keep it or go back.</p>}
          <div className="lp-chips">{[...new Set([...review.suggestions.slice(0, 3), review.original])].map(word => <button type="button" key={word} disabled={busy} aria-pressed={word === review.chosen} onClick={() => setReview({ ...review, chosen: word })}>{word}</button>)}</div>
          <p>You can’t change it after confirming.</p><div className="lp-actions"><button className="lp-action secondary" type="button" disabled={busy} onClick={() => setReview(null)}>Go back</button><button className="lp-action" type="button" disabled={busy} onClick={() => void act('submit_common_wurd')}>{busy ? 'Saving…' : 'Lock it in'}</button></div>
        </div>)}
        {model.my_answer && <div className="lp-sealed"><span><Check size={15} /> {closed ? 'YOU PICKED' : 'YOUR ANSWER IS SEALED'}</span><strong>{model.my_answer.toUpperCase()}</strong></div>}
      </section>
      {model.ended ? <section className="lp-results">
        <div className="lp-section-heading"><h2>{model.answer_count ? 'The common ground.' : 'A quiet round.'}</h2>{model.my_answer && <span>+{model.xp_awarded} XP</span>}</div>
        <p className="lp-fine">{model.answer_count} answers</p>
        {model.results.length ? model.results.map((row, index) => <div key={row.answer} className={`lp-result ${row.answer === model.my_answer ? 'mine' : ''}`}>
          <span>{String(index + 1).padStart(2, '0')}</span><div><strong>{row.answer}{row.answer === model.my_answer && <small>YOU</small>}</strong><p className="production-result-people">{row.usernames.map(name => `@${name}`).join(' · ')}</p><i><b style={{ width: `${row.count / model.answer_count * 100}%` }} /></i></div><b>{row.count}<small>XP each</small></b>
        </div>) : <p>No answers this round.</p>}
        <p className="lp-fine">Matching players each get the group’s size in XP, including themselves. Awarded once.</p><p className="lp-fine">{model.total_game_xp} XP earned playing · Counts toward your Wurd level</p>
        <button className="lp-action" disabled={busy} onClick={() => void act('acknowledge_common_wurd')}>On to the next round <ArrowRight size={16} /></button>
      </section> : closed ? <p role="status">{busy ? 'Opening the results…' : 'Results are ready to load.'}</p> : <p className="lp-sealed-count"><Shield size={16} /> {model.answer_count} {model.answer_count === 1 ? 'answer' : 'answers'} sealed. No peeking.</p>}
    </>)}
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent className="lp-dialog production-dialog"><DialogHeader><DialogTitle>The common wurd</DialogTitle><DialogDescription>A little game you play together.</DialogDescription></DialogHeader><p>Guess the answer most people will choose. Review the spelling, then lock it in. Answers stay sealed until the round ends.</p><p>If three players choose the same word, all three earn 3 XP. A unique answer earns 1 XP. XP is awarded once, when the results open.</p><p>New rounds start at 3 AM and 3 PM Israel time. The deadline is the same for everyone.</p></DialogContent></Dialog>
  </section>;
}
