import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Missing #root element in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Only in production: a service worker in dev would cache Vite's modules and hide your changes.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}
