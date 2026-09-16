import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CozyPreview from './app/CozyPreview';
import AppErrorBoundary from './app/AppErrorBoundary';
import './app/globals.css';

const introPreview = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'play-intro';
const launchPreview = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'card-review';
const productPreview = import.meta.env.DEV && ['product', 'launch-review'].includes(new URLSearchParams(location.search).get('preview') || '');
const App = productPreview ? (await import('./app/LocalProduct')).default : launchPreview ? (await import('./app/LaunchReviewPreview')).default : introPreview ? (await import('./app/PlayIntroPreview')).default : CozyPreview;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
);
