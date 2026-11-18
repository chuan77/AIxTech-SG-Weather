# Data Model: Installable App with an Offline Page

No server data changes: no schema, migration or API field. The three entities below live in static files or in the browser.

## App identity (static, the same for every visitor)

Served as `/manifest.webmanifest` and as head tags in `index.html`. Full field list: [contracts/app-manifest.md](contracts/app-manifest.md).

| Field | Value | Rule |
|---|---|---|
| name, short_name | `Lepak` | FR-001. Both the same, so the label is never truncated |
| id, start_url, scope | `/` | One app per origin. Opening from the icon lands on the dashboard |
| display | `standalone` | FR-004, full-screen without browser controls |
| theme_color, background_color | `#202a36` | Default theme's darkest sky stop (research R8) |
| icons | 192, 512, maskable 512 (PNG); 180 Apple touch icon; SVG favicon | FR-002. Maskable artwork sits inside the central 80% |

There are no personal fields, and the values are not read from the environment.

## Offline cache (browser Cache Storage, per device)

| Item | Value | Rule |
|---|---|---|
| Cache name | `lepak-offline-v<N>` (starts at `v1`) | Bump `N` when `offline.html` changes. Activate deletes other `lepak-offline-*` caches |
| Entries | exactly one: `/offline.html` | FR-014, SC-008. Never app code, `/api/*`, the visitor key, or other origins |

**Lifecycle**:

`not installed` → (first online page load, production build) `installing: cache /offline.html` → `active: pass-through, offline fallback for navigations` → (new `sw.js` with a new version) `replaced` | (kill switch deployed) `removed: caches deleted, unregistered`

- If the install step can't cache `/offline.html`, installation fails and the old worker, or none, stays. The app is unaffected.
- `VITE_OFFLINE_HELPER=off` at build time: the page unregisters any worker instead of registering one (research R5).

## Tip state (browser `localStorage`, per browser)

| Key | Value | Rule |
|---|---|---|
| `weather-starter.install-hint.seen` | `"1"` once the tip has been opened; absent otherwise | Hides the button's dot |
| `weather-starter.install-hint.dismissed` | `"1"` once Got it is pressed; absent otherwise | FR-008. The button and tip never render again |

Both are read and written in try/catch. If storage is blocked, in-memory flags for the page are used. Neither is ever sent to the server.

**Button show rule** (pure, `shouldShowInstallHint`): `isIosDevice && isSafari && !standalone && !dismissed && savedCount >= 1`. Inputs and detection: [contracts/install-hint.md](contracts/install-hint.md).

**States**:

`hidden (rule false)` → `button with dot` → (tap) `tip open` (sets `seen`) → (Escape / outside / tap button) `button, no dot` ⇄ `tip open` → (Got it) `dismissed` (persisted; button gone)

Clearing site data returns it to `hidden` or `button with dot`, according to the rule.
