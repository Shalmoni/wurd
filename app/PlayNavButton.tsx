import { useCallback, useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import './play-discovery.css';

// Per account and browser. Storage failures must never prevent navigation.
const handledThisSession = new Set<string>();
const storageKey = (userId: string) => `wurd:play-intro:v1:${userId}`;
function hasSeenIntro(userId: string) {
  if (handledThisSession.has(userId)) return true;
  try { return localStorage.getItem(storageKey(userId)) === 'done'; }
  catch { return false; }
}

export default function PlayNavButton({ userId, active, paused, onOpen }: {
  userId: string; active: boolean; paused: boolean; onOpen: () => void;
}) {
  const [seen, setSeen] = useState(() => hasSeenIntro(userId));
  const [ready, setReady] = useState(false);
  const visible = ready && !seen && !active && !paused;

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
