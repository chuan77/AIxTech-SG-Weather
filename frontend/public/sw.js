// Lepak offline helper (spec 014, contracts/offline-helper.md).
//
// Rule: only /offline.html is ever cached. Never the app's own page or files, never /api, never
// anything from another site (spec 014 FR-014). Page loads go to the network as usual; only when
// that fails for lack of a connection does the offline page answer instead. Every other request
// is left alone, so deploys and rollbacks reach users on their next online visit.
//
// Bump CACHE whenever offline.html changes. To switch this helper off, see scripts/pwa/sw-kill.js.

const CACHE = 'lepak-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('lepak-offline-') && name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode !== 'navigate') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    // Any HTTP response, error statuses included, passes through as is. Only a rejected fetch
    // (no connection) falls back to the offline page.
    fetch(request).catch(() =>
      caches
        .match(OFFLINE_URL, { cacheName: CACHE })
        .then((response) => response || Response.error()),
    ),
  );
});
