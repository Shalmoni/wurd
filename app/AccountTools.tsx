import { useEffect, useState } from 'react';
import { MoreHorizontal, Shield, HelpCircle, Home, MessageCircle, Download, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { supabase, type FeedWord } from '../lib/supabase';
import './account-tools.css';

export async function accountAction(action: string, options: { p_target?: string; p_word?: number; p_text?: string } = {}) {
  if (!supabase) throw new Error('Sign in to continue.');
  const result = await supabase.rpc('account_tools', { p_action: action, ...options });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function CardSafety({ item, onChanged }: { item: FeedWord; onChanged: () => Promise<void> }) {
  const [view, setView] = useState('');
  const [reason, setReason] = useState('Harassment or hate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(action: 'block' | 'report') {
    setBusy(true); setError('');
    try {
      await accountAction(action, action === 'block' ? { p_target: item.user_id } : { p_word: item.id, p_text: reason });
      if (action === 'block') { setView(''); await onChanged(); }
      else setView('sent');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Try again.'); }
    finally { setBusy(false); }
  }
  return <><button className="card-safety-button" aria-label={`More options for @${item.username}`} onClick={() => { setError(''); setView('menu'); }}><MoreHorizontal /></button><Dialog open={Boolean(view)} onOpenChange={open => { if (!open && !busy) setView(''); }}><DialogContent data-reply-list className="account-tools-dialog"><DialogHeader><DialogTitle>{view === 'block' ? `Block @${item.username}?` : view === 'report' ? 'Report this Wurd' : view === 'sent' ? 'Report received' : `@${item.username}`}</DialogTitle></DialogHeader>{error && <p role="alert">{error}</p>}{view === 'menu' && <div className="account-menu"><button onClick={() => setView('report')}>Report Wurd</button><button onClick={() => setView('block')}>Block account</button></div>}{view === 'report' && <><p>Choose a reason. Your report is private and is not shared with the poster.</p><select aria-label="Report reason" value={reason} onChange={e => setReason(e.target.value)}>{['Harassment or hate', 'Spam', 'Inappropriate content', 'Something else'].map(r => <option key={r}>{r}</option>)}</select><Button disabled={busy} onClick={() => void save('report')}>{busy ? 'Sending…' : 'Send report'}</Button></>}{view === 'block' && <><p>You won’t see each other’s Wurds or be able to send new requests, replies or echoes. Existing friendship and pending requests will be removed.</p><p>You can unblock them in Settings. They won’t be notified.</p><Button variant="outline" disabled={busy} onClick={() => setView('')}>Cancel</Button><Button className="danger-action" disabled={busy} onClick={() => void save('block')}>{busy ? 'Blocking…' : 'Block account'}</Button></>}{view === 'sent' && <><p>Saved for the app owner to review. You can also block this account to hide its posts immediately.</p><Button onClick={() => setView('')}>Done</Button></>}</DialogContent></Dialog></>;
}

export function InviteButton() {
  const [message, setMessage] = useState('');
  return <><Button variant="outline" onClick={async () => {
    try { await navigator.clipboard.writeText('https://shalmoni.github.io/wurd/'); setMessage('Link copied. Send it to your people.'); }
    catch { setMessage('Share this link: https://shalmoni.github.io/wurd/'); }
  }}><Copy /> Invite a friend</Button>{message && <small role="status">{message}</small>}</>;
}

export function PrivacyNote() {
  const [open, setOpen] = useState(false);
  return <><button className="privacy-note" onClick={() => setOpen(true)}>About your data</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="account-tools-dialog"><DialogHeader><DialogTitle>Your data on wurd</DialogTitle></DialogHeader><p>Google handles sign-in. We store your account and activity with Supabase. Other signed-in users can see your username, Wurds, replies, optional city and profile photo—not your email on Wurd cards.</p><p>Game answers stay sealed until the round ends. Expired Wurds remain in your history. Notifications are optional.</p><p>In Settings, you can export your account data, manage alerts, block accounts, send private feedback or permanently delete your account.</p></DialogContent></Dialog></>;
}

export function RecentXp() {
  const [rows, setRows] = useState<{ id: number; kind: string; points: number }[]>([]);
  useEffect(() => { let live = true; if (supabase) void supabase.from('xp_events').select('id,kind,points').order('created_at', { ascending: false }).limit(12).then(r => { if (live && !r.error) setRows(r.data || []); }); return () => { live = false; }; }, []);
  const labels: Record<string, string> = { daily_word: 'Your daily Wurd', echo_received: 'Echoes received', friend_match: 'Friendship', streak_week: 'Streak reward', common_wurd: 'The common wurd' };
  return <section className="xp-explanation"><h3>Little things add up.</h3><p>Post daily. Make friends. Receive echoes. Match answers in Play.</p><small>Giving echoes and posting replies don’t earn XP. Your bar shows progress in this level, not lifetime XP.</small>{rows.length > 0 && <><h3>Recent XP</h3>{rows.map(r => <div className="xp-ledger-row" key={r.id}><span>{labels[r.kind] || 'XP reward'}</span><b>+{r.points}</b></div>)}</>}</section>;
}

export default function AccountTools({ onChanged }: { onChanged: () => Promise<void> }) {
  const [panel, setPanel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [feedback, setFeedback] = useState('');
  const [blocks, setBlocks] = useState<{ id: string; username: string }[]>([]);
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action(); } catch(e) { setError(e instanceof Error ? e.message : 'Could not finish. Please try again.'); } finally { setBusy(false); } }
  function open(name: string) { setError(''); setMessage(''); setPanel(name); if (name === 'Blocked accounts') void run(async () => setBlocks(await accountAction('blocks'))); }
  return <><div className="account-menu">{[{ name: 'Add to Home Screen', icon: Home }, { name: 'Blocked accounts', icon: Shield }, { name: 'Privacy & account', icon: Shield }, { name: 'How wurd works', icon: HelpCircle }, { name: 'Send feedback', icon: MessageCircle }].map(row => <button key={row.name} onClick={() => open(row.name)}><row.icon /><span>{row.name}</span><span>›</span></button>)}</div><Dialog open={Boolean(panel)} onOpenChange={value => { if (!value && !busy) setPanel(''); }}><DialogContent className="account-tools-dialog"><DialogHeader><DialogTitle>{panel}</DialogTitle></DialogHeader>{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {panel === 'Add to Home Screen' && <><img className="account-app-icon" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="wurd app icon" /><p>Keep your people one tap away.</p><h3>iPhone</h3><p>In Safari, tap Share → Add to Home Screen. Then open the W icon.</p><h3>Android</h3><p>In Chrome, open the menu → Add to Home screen or Install app.</p><p>On iPhone, enable notifications from the installed app’s Settings. Banner and sound options are controlled by your device.</p></>}
    {panel === 'How wurd works' && <><h3>One Wurd, each day.</h3><p>Posting resets at your local midnight. Your Wurd lasts 24 hours, unless you replace it with the next day’s.</p><h3>An echo says “I feel that.”</h3><p>Tap the waves. Meh, Okay or Wurd: choose 1, 2 or 3 echo points. Change it whenever the Wurd is still active.</p><h3>One word back.</h3><p>Tap reply to send one word. View all shows every reply and who said it.</p><h3>Top, explained.</h3><p>Echo points count twice, replies once. Refresh to reorder; interacting won’t move cards around.</p><h3>Play together.</h3><p>Guess the most common answer. Answers stay sealed until the round ends. Three matching players each earn 3 XP—including you.</p><InviteButton /></>}
    {panel === 'Blocked accounts' && <>{busy && <p>Loading…</p>}{!busy && !blocks.length && <p>No blocked accounts.</p>}{blocks.map(person => <div className="xp-ledger-row" key={person.id}><strong>@{person.username}</strong><Button variant="outline" disabled={busy} onClick={() => void run(async () => { await accountAction('unblock', { p_target: person.id }); setBlocks(await accountAction('blocks')); await onChanged(); })}>Unblock</Button></div>)}</>}
    {panel === 'Send feedback' && <form className="account-feedback" onSubmit={e => { e.preventDefault(); void run(async () => { await accountAction('feedback', { p_text: feedback }); setFeedback(''); setMessage('Feedback received. Thank you for helping shape wurd.'); }); }}><label htmlFor="feedback-message">What could feel better?</label><textarea id="feedback-message" rows={5} minLength={3} maxLength={2000} required value={feedback} onChange={e => setFeedback(e.target.value)} /><small>Sent privately to the app owner. Please don’t include passwords or sensitive information.</small><Button disabled={busy || feedback.trim().length < 3}>{busy ? 'Sending…' : 'Send feedback'}</Button></form>}
    {panel === 'Privacy & account' && <><p>Your username, chosen city, Wurds, replies and profile photo are visible to other signed-in users. Your email is not shown on Wurd cards.</p><p>Google handles sign-in. Supabase stores your account and activity. Game answers stay hidden until their round ends; expired Wurds remain in your personal history.</p><p>Device notification subscriptions are stored only when you enable alerts. Reports and feedback are private to the app owner. You can leave your city blank and manage your photo and alerts in Settings.</p><p>Deleting your account removes your profile, Wurds, replies, echoes, friendships and game answers from the active database. Backups and service logs may remain temporarily under the hosting providers’ retention settings.</p><Button variant="outline" disabled={busy} onClick={() => void run(async () => { const data = await accountAction('export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href=url; a.download='wurd-account.json'; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); })}><Download /> Export my data</Button><Button className="danger-action" variant="outline" onClick={() => { setConfirmation(''); open('Delete account'); }}>Delete my account</Button></>}
    {panel === 'Delete account' && <><p>This permanently deletes your account and its activity. Export your data first if you want to keep a copy. This cannot be undone.</p><label htmlFor="delete-confirmation">Type DELETE to confirm</label><input id="delete-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /><Button variant="outline" disabled={busy} onClick={() => open('Privacy & account')}>Keep my account</Button><Button className="danger-action" disabled={busy || confirmation !== 'DELETE'} onClick={() => void run(async () => { if (!supabase) throw new Error('Sign in to continue.'); const result = await supabase.functions.invoke('delete-account', { body: { confirm: confirmation } }); if (result.error || !result.data?.ok) throw new Error(result.data?.error || 'Could not delete your account. Please try again.'); await supabase.auth.signOut({ scope: 'local' }); window.location.assign(import.meta.env.BASE_URL); })}>{busy ? 'Deleting…' : 'Permanently delete my account'}</Button></>}
  </DialogContent></Dialog></>;
}
