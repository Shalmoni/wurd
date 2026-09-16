import { useState } from 'react';
import { FeedCard, FloatingReplies, ReplyThread, WurdCard } from './CozyPreview';
import type { FeedWord, WurdReply } from '../lib/supabase';

// DEV-only harness using the actual card components and fake save callbacks.
// No account, real replies, echoes, or database writes.
const seed: FeedWord = { id: -1, user_id: 'sample', username: 'noa', display_name: null, avatar_url: null,
  city: 'Jerusalem', country_code: 'IL', word: 'SAME', emoji: null, color: 'mint', word_style: 'bold',
  local_date: '2026-09-16', created_at: new Date().toISOString(), echo_count: 4, reply_count: 20,
  spoke_count: 2, echoed_by_me: false, my_echo_strength: 0 };
const replies: WurdReply[] = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, daily_word_id: -1,
  user_id: `sample-${i}`, username: `friend_${i + 1}`, avatar_url: null,
  word: ['SAME', 'WOW', 'HOPE', 'EXACTLY', 'REALLY', 'YES', 'MOOD', 'FELT'][i % 8], created_at: seed.created_at }));

export default function LaunchReviewPreview() {
  const [items, setItems] = useState([seed, { ...seed, id: -2, username: 'ari', word: 'HOPE', reply_count: 0 }]);
  const [rows, setRows] = useState<Record<number, WurdReply[]>>({ [-1]: replies, [-2]: [] });
  const [open, setOpen] = useState<{ id: number; kind: 'echo' | 'reply' } | null>(null);
  const [fail, setFail] = useState(false);
  const [saved, setSaved] = useState('No echo saved yet');
  return <main className="cozy-stage today-app active-today"><section className="cozy-shell" style={{ minHeight: '100dvh' }}>
    <header style={{ padding: 20 }}><div className="today-brand">wurd</div><p>Your Wurd: SAME</p><p>Local review · Sample data only</p><label><input type="checkbox" checked={fail} onChange={event => setFail(event.target.checked)} /> Simulate failed echo save</label><p role="status">{saved}</p></header>
    <div className="today-view" style={{ padding: 12 }}><div className="live-grid" style={{ flex: 'none', overflow: 'visible' }}>
      {items.map(item => <WurdCard key={item.id} className={`wurd-cloud-card ${open?.id === item.id && open.kind === 'reply' ? 'composing-reply' : ''}`} item={item} onDismiss={() => setOpen(null)}>
        <FeedCard item={{ ...item, reply_count: rows[item.id].length }} ownWord="SAME" now={Date.now()} friendState="friend" pickerOpen={open?.id === item.id && open.kind === 'echo'} repliesOpen={open?.id === item.id && open.kind === 'reply'} onPickerChange={show => setOpen(show ? { id: item.id, kind: 'echo' } : null)} onFriendRequest={() => {}} onOpenReply={() => setOpen(open?.id === item.id && open.kind === 'reply' ? null : { id: item.id, kind: 'reply' })} onEcho={async strength => {
          await new Promise(resolve => setTimeout(resolve, 300));
          if (fail) throw new Error('Simulated connection failure');
          setItems(current => current.map(row => row.id === item.id ? { ...row, echo_count: 4 + strength, my_echo_strength: strength, echoed_by_me: strength > 0 } : row));
          setSaved(`Saved ${strength} for @${item.username}`);
        }} />
        <FloatingReplies replies={rows[item.id]} currentUserId="reviewer" />
        {open?.id === item.id && open.kind === 'reply' && <ReplyThread replies={rows[item.id]} currentUserId="reviewer" loading={false} sending={false} error="" onClose={() => setOpen(null)} onSubmit={async word => {
          setRows(current => ({ ...current, [item.id]: [...current[item.id], { id: Date.now(), daily_word_id: item.id, user_id: 'reviewer', username: 'you', avatar_url: null, word, created_at: new Date().toISOString() }] }));
          return true;
        }} />}
      </WurdCard>)}
    </div></div>
  </section></main>;
}
