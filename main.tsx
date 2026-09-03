import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CozyPreview from './app/CozyPreview';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CozyPreview />
  </StrictMode>,
);
