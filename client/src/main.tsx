import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { unlockAudio } from './sound';
import './styles.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Missing #root element in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Browsers only allow sound after a user gesture: unlock audio on the first tap or key press.
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// Only in production: a service worker in dev would cache Vite's modules and hide your changes.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}
