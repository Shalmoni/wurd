import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import CozyPreview from './app/CozyPreview';
import './app/globals.css';

// Isolated, local-only game sandbox: no account or production writes.
const PlayPrototype = import.meta.env.DEV ? lazy(() => import('./app/CategoryPrototype')) : null;
const showPlay = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'play';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showPlay && PlayPrototype ? <Suspense fallback={<p>Opening the playground…</p>}><PlayPrototype /></Suspense> : <CozyPreview />}
  </StrictMode>,
);
