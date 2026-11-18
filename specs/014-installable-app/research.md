# Research: Installable App with an Offline Page

**Feature**: `014-installable-app` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

Every NEEDS CLARIFICATION from the Technical Context is resolved below. The platform facts were checked with web searches on 2026-11-18. Sources are listed at the end.

## R1. Does an iPhone home-screen app share storage with Safari?

- **Decision**: No. Treat the home-screen app as a separate browser profile, with its own `localStorage` and therefore its own visitor key (spec 013). Keep FR-007's wording ("the home-screen app keeps its own list of places, separate from Safari's").
- **Rationale**:
  - WebKit bug 181849 ("Add to homescreen apps don't share storage with Safari") was answered that this is by design: Home Screen apps are created as isolated entities without shared state with the browser.
  - Community reports date the split to iOS 6–7, and no later change was found.
  - WebKit's 2020 storage-policy clarification exempts home-screen web apps from Safari's 7-day clearing of script-written storage. Once installed on iPhone, the list is therefore *safer* than in a Safari tab.
- **Alternatives considered**: carrying the key into the app with a link or code. This was rejected in the assessment because the key acts as a password, and spec 013 forbids putting it in a URL. It is out of scope.
- **Residual uncertainty**: the sources are WebKit bug comments and older forum posts, not a current Apple documentation page. The hint wording is the only thing that depends on this. Confirm on a real iPhone in quickstart §4.

## R2. What does Chrome need before it offers to install?

- **Decision**: Ship a manifest with the required fields, served over HTTPS, *and* a service worker with a real `fetch` handler, the offline page (US3). The same worker therefore serves both goals.
- **Rationale**:
  - The Chrome developer blog ("Revisiting Chrome's installability criteria") says Chrome 108 on mobile and 112 on desktop dropped the `fetch`-handler requirement **only for the menu's "Install app" item**.
  - The automatic install prompt still requires a `fetch` handler, and Chrome ignores empty handlers.
  - Without US3, Android users would find install only in the menu.
- **Manifest fields Chrome reads**: `name` or `short_name`; icons of 192 px and 512 px; `start_url`; `display` of `standalone`, `fullscreen` or `minimal-ui`. Add `id`, `scope`, `theme_color`, `background_color` and a `maskable` icon for Android's adaptive icons.
- **Alternatives considered**: no service worker (concept Option A). This was rejected because install would then hide in the menu, and US3 would be missing.

## R3. What does the offline helper keep, and how does it decide?

- **Decision**: A hand-written, dependency-free `frontend/public/sw.js`:
  - **install**: cache exactly one URL, `/offline.html`, in a versioned cache `lepak-offline-v1`.
  - **activate**: delete every other cache whose name starts with `lepak-offline-`, then `clients.claim()`.
  - **fetch**: act only on same-origin **navigation** requests (`request.mode === 'navigate'`). Try the network with `fetch(request)`, and only if that *rejects* (no connection) answer with the cached `/offline.html`. Any HTTP response, including 4xx or 5xx, passes through untouched, so server errors still show as today. Every other request (scripts, styles, `/api/*`, map tiles, fonts, analytics) is not intercepted at all, so the worker never calls `respondWith` for it.
- **Rationale**:
  - Meets FR-014: only the offline page is kept.
  - Meets FR-015: online, everything comes from the server.
  - Meets FR-016: only a page navigation that fails for lack of a network gets the offline page. A failed `/api` call inside a running app is never touched.
  - A rejected `fetch` is the browser's signal for "no network". `navigator.onLine` is unreliable and is not used.
- **Offline page is self-contained**: inline CSS, an inline SVG mark, no web fonts, no script beyond a "Try again" button that reloads. One cached file then covers everything the page needs, and cached files can't drift out of step with a deploy.
- **Alternatives considered**:
  - *Workbox / `vite-plugin-pwa`*: rejected. It is a new dependency, and its precaching of build output is exactly what FR-014 forbids.
  - *Caching the app shell* (`index.html` plus assets): that is step B, out of scope.
  - *Navigation preload*: unnecessary for a pass-through handler.

## R4. Will a deploy or rollback still reach users at once?

- **Decision**: Yes, with three safeguards:
  1. `/sw.js` is served with `Cache-Control: no-cache`, so the browser checks for a new worker on every navigation.
  2. Register with `updateViaCache: 'none'`.
  3. Online navigations go to the network.
- **Rationale**:
  - The app's own files are never in the worker's cache (R3). After a Vercel Instant Rollback, the next online open is served by whichever deployment is live.
  - The only cached file is the offline page, which is not the app.
  - The rendered `index.html` is sent by `app.get('*')` without validators, so the browser doesn't reuse it heuristically. Vite's hashed asset names already change per build.
- **Rollback to a build from before this feature**: that build has no `/sw.js` file, so `GET /sw.js` falls through to `index.html` (the `app.get('*')` catch-all). The browser's update check gets an HTML response with a non-JavaScript MIME type and fails, so the *installed worker stays*. That worker passes online navigations straight through, so users get the old build normally, and only the offline page remains. This is harmless, but it must be known. See R5 for removing it properly.
- **Alternatives considered**: a `Clear-Site-Data` header. This was rejected as heavy-handed: it would also wipe the visitor key and lose the saved list.

## R5. How is the offline helper switched off later (FR-017)?

- **Decision**: Keep a tested kill-switch worker in the repo, `scripts/pwa/sw-kill.js`. To switch the helper off, a release copies it over `frontend/public/sw.js`. It installs immediately (`skipWaiting`). On activate it deletes every `lepak-offline-*` cache, calls `self.registration.unregister()`, and has no `fetch` handler. The registration code also gets a build-time switch, `VITE_OFFLINE_HELPER=off`, which makes `main.tsx` unregister any existing worker instead of registering one. That covers clients that load the page before fetching the new `sw.js`.
- **Rationale**: the switch-off path follows the standard "self-destroying service worker" pattern. Both halves can be tested before they're ever needed (quickstart §6). The kill-switch file must stay available at `/sw.js` for at least the 90-day visitor window, so returning devices pick it up.
- **Alternatives considered**: deleting `sw.js`. This was rejected because a 404 or HTML response leaves the existing worker installed (R4).

## R6. How does the app tell it's on iPhone/iPad Safari and not installed?

- **Decision**: A pure module, `frontend/src/install/installHint.ts`, takes plain inputs and returns whether to show the hint. It is unit-tested.
  - **Inputs**: `userAgent`, `maxTouchPoints`, `standalone`, `dismissed`, `savedCount`.
  - `standalone` is true for `navigator.standalone === true` or `matchMedia('(display-mode: standalone)').matches`.
  - **iOS device**: `/iPhone|iPad|iPod/` in the user agent, *or* `Macintosh` with `maxTouchPoints > 1` (iPadOS 13+ reports a desktop user agent).
  - **Safari only** (FR-009): exclude `CriOS`, `FxiOS`, `EdgiOS`, `OPiOS`, `GSA`, `YaBrowser`, `DuckDuckGo` and in-app browsers (`FBAN`, `FBAV`, `Instagram`, `Line/`). Their share menus differ, and some can't add to the home screen at all.
  - **Show when**: iOS, Safari, not standalone, not dismissed, and `savedCount >= 1` (FR-008).
- **Rationale**: detection by user agent is imperfect, but the hint is a dismissible convenience, so a miss costs little. Keeping it pure satisfies Principle IV.
- **Tip memory**: `localStorage` keys `weather-starter.install-hint.seen` and `weather-starter.install-hint.dismissed`, each `"1"`. Every read and write is wrapped in try/catch, like `visitorKey.ts`. If storage is blocked, it falls back to in-memory state for the page (spec edge case). It is never sent to the server.
- **Alternatives considered**: the `beforeinstallprompt` event. That is Chromium-only and gives no signal on iOS, and FR-005 forbids a custom install button on Chromium.

## R7. Icons without a logo or image tools

- **Decision**:
  - Hand-author one SVG mark, `frontend/icons/lepak-mark.svg`: a simple sun-and-cloud glyph in white on the default theme's `#202a36`, with its artwork inside the central 80% safe zone so it also works as a maskable icon.
  - Render PNGs once with headless Chrome, which is already installed for agent-browser, through `scripts/icons/render-icons.sh`, and commit them to `frontend/public/icons/`.
  - Files: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (full-bleed background), `apple-touch-icon.png` (180 px, opaque, because iOS fills transparency with black), and `favicon.svg`.
- **Rationale**: no ImageMagick, rsvg or Inkscape is installed, and a new npm dependency (for example `sharp`) isn't worth it for a one-off render. The PNGs are build inputs, not build outputs, so `npm run build` needs no image step.
- **Alternatives considered**: `sharp` as a dev dependency (rejected: a native module for a one-time job); emoji or text icons (rejected: they render differently per platform).

## R8. Fixed colours outside the theme system

- **Decision**:
  - `theme_color` and `background_color` in the manifest, `<meta name="theme-color">`, and the offline page's inline CSS use the default `apple` theme's literal colours: `#202a36` (darkest sky stop) for backgrounds, `#ffffff` for text, and `rgba(255,255,255,0.85)` for secondary text. This matches `--ink-muted`.
  - The iPhone status bar uses `apple-mobile-web-app-status-bar-style` `black`, not `black-translucent`, so content never slides under the status bar and no safe-area work is needed.
  - The in-app button and tip are normal React elements and use theme classes (`rounded-card`, `text-white`, `text-ink-muted`) like any other panel.
- **Rationale**:
  - Browsers read these values before any CSS loads, and the offline page can't load `index.css`, which is not cached (R3). Literal values are therefore unavoidable.
  - The contrast of `#ffffff` on `#202a36` is about 14.9:1, and of 85% white on it about 11:1, both above AA.
  - This is a deviation from Principle V, justified in plan.md Complexity Tracking.
- **Alternatives considered**: a per-theme `theme-color`, updated by `applyTheme`. This was rejected for step A: the launch screen and icon can't follow it anyway, and it would add moving parts.

## R9. Testing the offline open and the hint

- **Decision**: Add a new browser check, `scripts/e2e/installable-app.sh [us1|us2|us3|themes]`, built on `lib.sh`.
  - **Offline**: `agent-browser set offline on|off` is available (checked with `agent-browser --help` on 2026-11-18). The temporary server runs on `http://127.0.0.1:<port>`, which browsers treat as a secure context, so the worker registers there.
  - **Cache audit**: list the Cache Storage keys with `agent-browser eval` (SC-008).
  - **iPhone hint**: override the user agent and `maxTouchPoints` with an init script before navigation, and stub `GET /api/locations` with `network route`, as the other checks do.
- **Rationale**:
  - vitest has no DOM, so only the pure modules (`installHint.ts` and the registration decision) get unit tests. The worker itself is checked in the browser.
  - Real install prompts and home-screen behaviour can't be automated. Those are manual quickstart steps on real devices (SC-001 to SC-003).
- **Alternatives considered**: Lighthouse's PWA category. It was removed from Lighthouse (v12, 2024), so the chrome-devtools MCP's Application panel is used for manual inspection instead.

## R10. Server and lint changes

- **Decision**:
  - In `backend/src/server.ts`, pass `setHeaders` to `express.static`. A small pure helper, `backend/src/staticHeaders.ts` (unit-tested), returns `Cache-Control: no-cache` for `/sw.js` and `/manifest.webmanifest`, and nothing for other files.
  - Express already serves `.webmanifest` as `application/manifest+json` (checked in the assessment).
  - In `eslint.config.js`, add a block for `frontend/public/**/*.js` and `scripts/pwa/**/*.js` with `globals.serviceworker`. Without it, `js.configs.recommended` flags `self`, `caches` and `clients` as undefined.
- **Rationale**: there is no new route, so Principle VI's Supertest requirement is not triggered. The header logic is still covered by a unit test. The production static branch isn't exercised by the existing route tests, because they don't build `frontend/dist`.

## Sources

- https://bugs.webkit.org/show_bug.cgi?id=181849 (host: bugs.webkit.org): "Add to homescreen" apps don't share storage with Safari
- https://lists.webkit.org/pipermail/webkit-unassigned/2022-February/1018496.html (host: lists.webkit.org): the same bug's mailing-list thread
- https://www.osnews.com/?p=131566 (host: www.osnews.com): coverage of WebKit's clarification that home-screen web apps are exempt from the 7-day storage cap
- https://developer.chrome.com/blog/update-install-criteria (host: developer.chrome.com): Revisiting Chrome's installability criteria
- https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide (host: www.magicbell.com): secondary summary of iOS PWA limits
- Repo: `agent-browser --help` (offline setting), `eslint.config.js`, `backend/src/server.ts`, `frontend/src/visitorKey.ts`, `frontend/src/index.css`, `docs/deployment.md` (Rollback), `docs/testing.md`
