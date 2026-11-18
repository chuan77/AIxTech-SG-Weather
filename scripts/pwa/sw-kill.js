// Kill switch for the Lepak offline helper (spec 014, FR-017, contracts/offline-helper.md).
//
// To switch the helper off for everyone:
//   1. cp scripts/pwa/sw-kill.js frontend/public/sw.js
//   2. Build and deploy with VITE_OFFLINE_HELPER=off (the page then unregisters instead of
//      registering).
//   3. Keep this file live at /sw.js for at least 90 days, so returning devices pick it up.
//      Never just delete sw.js: a missing file leaves the old helper installed.
//
// On its next online visit each device installs this worker at once, deletes the helper's
// caches, unregisters itself and reloads its open windows, which then run without any worker.
// It has no fetch handler, so it never answers a request.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('lepak-offline-'))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((windows) => Promise.all(windows.map((client) => client.navigate(client.url)))),
  );
});
