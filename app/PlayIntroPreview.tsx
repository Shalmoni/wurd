import { useState } from 'react';
import { CircleUserRound, Sun } from 'lucide-react';
import PlayNavButton from './PlayNavButton';

// Local-only review harness; no account, API calls, or production data.
export default function PlayIntroPreview() {
  const [tab, setTab] = useState('today');
  const [paused, setPaused] = useState(false);
  const [version, setVersion] = useState(() => new URLSearchParams(location.search).get('test') || 'default');
  return <main className={`cozy-stage fixed-app active-${tab} today-app`}>
    <section className="cozy-shell">
      <header className="play-brand-header"><div className="today-brand">wurd</div></header>
      <div className="cozy-main" style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28 }}>{tab === 'play' ? 'Play.' : 'Play introduction preview'}</h1>
        <p>Local demo only. No account data.</p>
        {tab === 'play' ? <p>The common wurd</p> : <p>The new tip appears above the Play tab.</p>}
        <button style={{ display: 'block', marginTop: 24 }} onClick={() => { setVersion(String(Date.now())); setTab('today'); }}>Show tip again</button>
        <button style={{ display: 'block', marginTop: 24 }} onClick={() => setPaused(value => !value)}>{paused ? 'Resume tip' : 'Pause tip (simulate another dialog)'}</button>
      </div>
      <nav className="cozy-nav" aria-label="App navigation">
        <button onClick={() => setTab('today')} className={tab === 'today' ? 'active' : ''}><Sun /><span>Today</span></button>
        <PlayNavButton key={version} userId={`intro-preview-${version}`} active={tab === 'play'} paused={paused} onOpen={() => setTab('play')} />
        <button onClick={() => setTab('you')} className={tab === 'you' ? 'active' : ''}><CircleUserRound /><span>You</span></button>
      </nav>
    </section>
  </main>;
}
