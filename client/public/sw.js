/*
 * Perudo service worker.
 * - App shell is precached so the PWA opens instantly (and offline shows the app, not a browser error).
 * - Page navigations are network-first so a new deployment is picked up on the next load.
 * - Other same-origin GETs (hashed JS/CSS, icons) are served from cache and refreshed in the background.
 * - Cross-origin traffic (the Socket.io game server) is never intercepted: the game is online-only.
 */
const CACHE_NAME = 'perudo-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? networkFirst(request) : staleWhileRevalidate(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(request).catch(() => null);
  if (response !== null && response.ok) {
    cache.put('./index.html', response.clone());
    return response;
  }
  const cached = await cache.match('./index.html');
  return cached ?? response ?? Response.error();
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached ?? (await refresh) ?? Response.error();
}
