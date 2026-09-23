import { useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { gameInviteUrl } from '../lib/game-invite';

export default function GameInviteButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const url = gameInviteUrl(new URL(import.meta.env.BASE_URL, window.location.origin).href);
  async function share() {
    setSharing(true); setMessage('');
    try {
      await navigator.share({ title: 'The common wurd', text: 'Play The common wurd with me. Guess the most popular answer—answers open together.', url });
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setMessage('Could not open sharing. Copy the link below instead.');
    } finally { setSharing(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage('Link copied. Send it to your people.'); }
    catch { setMessage('Select and copy the link below.'); }
  }
  return <>
    <button className="lp-text-button game-invite-button" onClick={() => { setMessage(''); setOpen(true); }}><Share2 size={17} /> Invite to play</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="lp-dialog production-dialog game-invite-dialog"><DialogHeader><DialogTitle>Better with your people.</DialogTitle><DialogDescription>Invite someone to The common wurd. They’ll join the shared game—not a private match.</DialogDescription></DialogHeader>
      <p>New to wurd? They can sign in, choose a username, and come straight to the game. Answers stay sealed.</p>
      <div className="lp-actions">{typeof navigator.share === 'function' && <button className="lp-action" disabled={sharing} onClick={() => void share()}><Share2 size={17} /> Share invite</button>}<button className="lp-action secondary" onClick={() => void copy()}><Copy size={17} /> Copy link</button></div>
      <label className="lp-sr-only" htmlFor="game-invite-link">Game invitation link</label><input id="game-invite-link" className="game-invite-link" readOnly value={url} onFocus={event => event.currentTarget.select()} />
      <small role="status">{message}</small>
    </DialogContent></Dialog>
  </>;
}
