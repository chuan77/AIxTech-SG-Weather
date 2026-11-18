# Contract: Offline Helper (service worker)

## Files and headers

| Path | Served with | Notes |
|---|---|---|
| `/sw.js` | `Content-Type: application/javascript` (Express default), `Cache-Control: no-cache` | Scope `/` (served from the root, so no `Service-Worker-Allowed` header is needed) |
| `/offline.html` | Express defaults | Self-contained: inline CSS and SVG, no external requests, no data |

`Cache-Control` comes from `backend/src/staticHeaders.ts`:
`headersFor(path: string): Record<string, string>` returns `{ 'Cache-Control': 'no-cache' }` for `/sw.js` and `/manifest.webmanifest`, and `{}` for anything else.

## Registration (`frontend/src/install/offlineHelper.ts`)

- `offlineHelperAction({ prod, hasServiceWorker, setting })` returns `'register' | 'unregister' | 'none'`.
  - `'none'` when the build isn't a production build or the browser has no `serviceWorker`. The Vite dev server never registers.
  - `'unregister'` when `setting === 'off'` (`import.meta.env.VITE_OFFLINE_HELPER`).
  - Otherwise `'register'`.
- `main.tsx` runs the action after `window` `load`:
  - **register**: `navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })`.
  - **unregister**: unregister every registration, then delete every `lepak-offline-*` cache.
- Failures are swallowed with a single `console.warn`, never `console.error`. The app MUST work with no worker.

## Worker behaviour (`frontend/public/sw.js`)

```text
CACHE = 'lepak-offline-v1'; OFFLINE_URL = '/offline.html'

install:  cache.add(OFFLINE_URL) into CACHE; skipWaiting()
activate: delete caches named 'lepak-offline-*' except CACHE; clients.claim()
fetch(event):
  if event.request.mode !== 'navigate'                 -> return (do not call respondWith)
  if origin of event.request.url !== self.location.origin -> return
  event.respondWith(
    fetch(event.request)                                 // any HTTP status passes through as is
      .catch(() => caches.match(OFFLINE_URL, { cacheName: CACHE })
                      .then(r => r || Response.error()))
  )
```

Guarantees, each checked by `scripts/e2e/installable-app.sh us3`:

1. Cache Storage holds one cache, `lepak-offline-v1`, with one entry, `/offline.html` (SC-008).
2. Online navigations return the server's response, including error statuses.
3. Offline navigations, after one online visit, show `offline.html` (FR-011).
4. `/api/*`, scripts, styles, tiles, fonts and analytics are not intercepted. In DevTools their responses never show "from ServiceWorker".
5. No `console.error` and no page error at any step.

## `offline.html` content (FR-012, FR-013)

- Heading: **You're offline**
- Body: "Lepak can't reach the internet right now. Your places and weather will be here when you're back online."
- Button: **Try again**, which calls `location.reload()`.
- `<html lang="en">`, `<meta name="viewport">`, `<meta name="theme-color" content="#202a36">`. Background `#202a36`, text `#ffffff`, secondary text `rgba(255,255,255,0.85)`, and a visible focus ring on the button (3:1 or better).
- Nothing about any visitor: no place names, coordinates, readings, times or key.

## Kill switch (`scripts/pwa/sw-kill.js`, FR-017)

```text
install:  skipWaiting()
activate: delete every cache named 'lepak-offline-*'; self.registration.unregister();
          clients.matchAll({ type: 'window' }) -> client.navigate(client.url)
(no fetch handler)
```

To switch off: copy `scripts/pwa/sw-kill.js` to `frontend/public/sw.js`, build with `VITE_OFFLINE_HELPER=off`, deploy, and keep that `sw.js` live for at least 90 days. Documented in `docs/deployment.md`.
