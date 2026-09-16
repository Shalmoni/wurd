import { Component, type ReactNode } from 'react';

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('Wurd screen failed', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="auth-stage"><div className="auth-card"><div className="cozy-logo">wurd</div><h1>A little hiccup.</h1><p>This screen couldn’t load. Your saved account and posts are safe.</p><button onClick={() => window.location.reload()}>Reload wurd</button></div></main>;
  }
}
