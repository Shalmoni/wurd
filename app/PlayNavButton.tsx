import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Gamepad2, X } from 'lucide-react';
import './play-discovery.css';

// Per account and browser. Storage failures must never prevent navigation.
const handledThisSession = new Set<string>();
const storageKey = (userId: string) => `wurd:play-intro:v1:${userId}`;
function hasSeenIntro(userId: string) {
  if (handledThisSession.has(userId)) return true;
  try { return localStorage.getItem(storageKey(userId)) === 'done'; }
  catch { return false; }
}

export function PlayIntroduction({ userId, onOpen }: { userId: string; onOpen: () => void }) {
  const [seen, setSeen] = useState(() => hasSeenIntro(userId));
  function dismiss() {
    handledThisSession.add(userId);
    try { localStorage.setItem(storageKey(userId), 'done'); } catch { /* Session fallback. */ }
    setSeen(true);
  }
  if (seen) return null;
  return <aside className="lp-discovery"><div><span className="lp-kicker">SOMETHING TO PLAY TOGETHER</span><strong>Can you think like your people?</strong><p>One question. Secret answers. A shared reveal.</p></div><button className="lp-icon" aria-label="Dismiss Play introduction" onClick={dismiss}><X size={16} /></button><button className="lp-text-button" onClick={() => { dismiss(); onOpen(); }}>Try The common wurd <ArrowRight size={16} /></button></aside>;
}

export default function PlayNavButton({ userId, active, paused, onOpen, inlineIntroduction = false }: {
  userId: string; active: boolean; paused: boolean; onOpen: () => void; inlineIntroduction?: boolean;
}) {
  const [seen, setSeen] = useState(() => hasSeenIntro(userId));
  const [ready, setReady] = useState(false);
  const visible = ready && !seen && !active && !paused && !inlineIntroduction;

  const dismiss = useCallback(() => {
    handledThisSession.add(userId);
    try { localStorage.setItem(storageKey(userId), 'done'); } catch { /* In-memory fallback. */ }
    setSeen(true);
  }, [userId]);

  useEffect(() => {
    if (active) dismiss();
  }, [active, dismiss]);

  useEffect(() => {
    setReady(false);
    if (paused || active || seen) return;
    const timer = window.setTimeout(() => setReady(true), 1800);
    return () => window.clearTimeout(timer);
  }, [paused, active, seen]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dismiss]);

  function open() { dismiss(); onOpen(); }
  return <div className="play-nav-slot">
    <button className={`${active ? 'active' : ''} ${visible ? 'play-discovery-pulse' : ''}`} title="Play" aria-current={active ? 'page' : undefined} onClick={open}>
      <Gamepad2 /><span>Play</span>
    </button>
    {visible && <aside className="play-discovery-tip" aria-label="Discover Play">
      <div role="status"><strong>New: Play</strong><p>Can you guess what everyone else will say? Match answers. Earn XP.</p></div>
      <div className="play-discovery-actions"><button onClick={dismiss}>Not now</button><button onClick={open}>Let’s play</button></div>
    </aside>}
  </div>;
}
