// Development-only acceptance fixture. These are the production components,
// with synthetic inputs and no Supabase client or real writes.
import { useCallback, useState, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { BrandHeader, CurrentWurd, TodayTab, YouTab, YouToolsDialog } from '../app/CozyPreview';
import PlayTab from '../app/PlayTab';
import type { commonWurdRequest, CommonWurdState } from '../lib/common-wurd';
import type { FeedWord } from '../lib/supabase';
import '../app/globals.css';
import '../app/product-design.css';
import '../app/product-live.css';

const now = Date.now();
const stamp = new Date(now - 3600000).toISOString();
const date = new Date().toLocaleDateString('en-CA');
const feed: FeedWord[] = [{ id: 991, user_id: 'fixture-other', username: 'twenty_character_usr', display_name: null, avatar_url: null, city: 'Jerusalem', country_code: 'IL', word: 'BATMAN=SUPERHERO', emoji: null, color: 'mint', word_style: 'bold', animation: 'still', local_date: date, created_at: stamp, echo_count: 6, reply_count: 0, spoke_count: 2, echoed_by_me: false, my_echo_strength: 0 }];
const history = [{ id: 992, local_date: date, word: 'ABCDEFGHIJKLMNOPQRST', emoji: null, color: 'mint' as const, word_style: 'bold' as const, city: 'Harish', created_at: stamp, echo_count: 8 }];
const noop = async () => {};
const yes = async () => true;
const friend = { id: 'fixture-friend', username: 'noa', city: 'Jerusalem' };
let game: CommonWurdState = { server_now: new Date(now).toISOString(), round: { id: 'fixture-round', prompt: 'Name a fruit.', starts_at: new Date(now - 3600000).toISOString(), ends_at: new Date(now + 3600000).toISOString() }, ended: false, my_answer: null, answer_count: 5, results: [], points: 0, total_points: 0, xp_awarded: 0, total_game_xp: 0, profile_xp: 117 };
const request: typeof commonWurdRequest = async (action, args) => {
  if (action === 'submit_common_wurd') game = { ...game, my_answer: args?.p_answer || null, answer_count: 6 };
  if (action === 'acknowledge_common_wurd') game = { ...game, round: { ...game.round!, id: 'fixture-next', prompt: 'Name a feeling.', starts_at: new Date(now).toISOString(), ends_at: new Date(now + 43200000).toISOString() }, ended: false, my_answer: null, results: [], answer_count: 0, xp_awarded: 0 };
  return { ...game, server_now: new Date().toISOString() };
};
if (new URLSearchParams(location.search).get('round') === 'ended') game = { ...game, ended: true, my_answer: 'orange', answer_count: 6, xp_awarded: 3, profile_xp: 120, total_game_xp: 3, results: [{ answer: 'orange', count: 3, usernames: ['fixture_you','noa','maya'] }, { answer: 'apple', count: 2, usernames: ['ari','ben'] }, { answer: 'banana', count: 1, usernames: ['eli'] }] };

function Fixture() {
  const [tab, setTab] = useState('today');
  const [panel, setPanel] = useState<ComponentProps<typeof YouToolsDialog>['panel']>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'New' | 'Top' | 'Friends'>('New');
  const [posted, setPosted] = useState('');
  const syncXp = useCallback(() => {}, []);
  const props: ComponentProps<typeof YouToolsDialog> = { panel, setPanel, userId: 'fixture-you', connections: [{ id: 1, requester_id: 'fixture-friend', addressee_id: 'fixture-you', status: 'pending', other: friend }], searchResults: query.length > 1 ? [friend] : [], searchQuery: query, onSearchQueryChange: setQuery, searchPeople: noop, sendFriendRequest: yes, acceptFriend: noop, declineFriend: noop, unfriend: yes, xp: 117, level: 2, streak: 3, saveSettings: async e => { e.preventDefault(); }, signOut: noop, usernameDraft: 'fixture_you', setUsernameDraft: () => {}, cityDraft: '', setCityDraft: () => {}, citySelection: null, setCitySelection: () => {}, profilePhoto: '', saveProfilePhoto: noop, removeProfilePhoto: noop, pushStatus: 'unsupported', notificationPreferences: { requests: true, friendWords: true, replies: false }, notificationBusy: false, notificationError: '', setNotificationPreferences: () => {}, enableNotifications: noop, saveNotificationPreferences: noop, disableNotifications: noop, busy: false, onAccountChanged: noop, accountError: '' };
  return <main className="lp live-product today-app"><div className="lp-preview-bar">TEST FIXTURE · No real accounts or saves</div><BrandHeader xp={117} level={2} streak={3} onToday={() => setTab('today')} onProgress={() => setPanel('xp')} /><div className="lp-content">
    {tab === 'today' && <>{posted && <CurrentWurd word={posted} submittedAt={stamp} now={now} emoji={null} color="mint" wordStyle="bold" animation="still" city="Harish" countryCode="IL" echoes={8} replies={[]} loading={false} canReplace onReplace={() => setPosted('')} />}<TodayTab submitted={posted} replacementMode={false} level={2} feed={feed} feedLoading={false} now={now} spokeCount={2} feedMode={mode} setFeedMode={setMode} setSubmitted={async p => setPosted(p.word)} refreshFeed={noop} friendStateFor={() => 'none'} sendFriendRequest={yes} echoStrengths={{}} echoed={[]} setEchoStrength={noop} currentUserId="fixture-you" currentUsername="fixture_you" onAccountChanged={noop} hasPostedToday={false} onFindFriends={() => setPanel('friends')} onPlay={() => setTab('play')} /></>}
    {tab === 'you' && <YouTab history={history} incomingRequestCount={1} onOpenPanel={setPanel} loadEarlier={noop} hasEarlier={false} historyBusy={false} username="fixture_you" memberSince={stamp} onToday={() => setTab('today')} />}
    {tab === 'play' && <PlayTab onXpChanged={syncXp} request={request} />}
  </div><nav className="lp-nav">{['today','play','you'].map(t => <button key={t} onClick={() => setTab(t)}>{t}</button>)}</nav><YouToolsDialog {...props} /></main>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Fixture />);
