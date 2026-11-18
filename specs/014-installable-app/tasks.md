---

description: "Task list for the installable app with an offline page"
---

# Tasks: Installable App with an Offline Page

**Input**: Design documents from `specs/014-installable-app/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution Principle IV requires vitest tests for pure frontend modules, and Principle VI requires lint and test to pass. UI and worker behaviour are covered by a new agent-browser check, following `CLAUDE.md` Browser checks. Write each unit test before its module, and see it fail first.

**Organization**: Tasks are grouped by user story (spec.md: US1 P1 install, US2 P2 iPhone Add to Home Screen button and tip, US3 P3 offline page).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2, US3. Setup, Foundational and Polish tasks have no story label.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Folders, lint config and the browser-check skeleton every story uses.

- [X] T001 Create `frontend/public/`, `frontend/public/icons/`, `frontend/icons/`, `frontend/src/install/`, `scripts/icons/` and `scripts/pwa/`. Confirm Vite's default `publicDir` (`frontend/public`) is unchanged in `frontend/vite.config.ts`, so files there are copied to `frontend/dist/` as is.
- [X] T002 [P] Add an ESLint flat-config block in `eslint.config.js`, before the final `prettier` entry, with `files: ['frontend/public/**/*.js', 'scripts/pwa/**/*.js']` and `languageOptions: { globals: globals.serviceworker, sourceType: 'script' }`. The worker files then lint with `self`, `caches` and `clients` defined (research R10). Run `npm run lint` to confirm nothing else changes.
- [X] T003 [P] Create `scripts/e2e/installable-app.sh`:
  - shebang, `set -euo pipefail`, `SESSION=installable-app`, `OUT=e2e-artifacts/installable-app`, `pass`/`fail` helpers;
  - `source scripts/e2e/lib.sh`, an `EXIT` trap calling `e2e_cleanup`, `e2e_start_server` (unless `E2E_BASE_URL` is set) and `e2e_launch_browser`;
  - a dispatcher over `us1 | us2 | us3 | themes`, where no argument runs all four, with empty sub-check functions to fill in later.
  Copy the structure from `scripts/e2e/privacy-notice.sh`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The server must send `Cache-Control: no-cache` for `/sw.js` and `/manifest.webmanifest` before any story ships (research R4, R10; contracts/offline-helper.md "Files and headers").

**⚠️ CRITICAL**: US1 (manifest) and US3 (worker) both depend on this.

- [X] T004 [P] Write `backend/src/staticHeaders.test.ts` (vitest, node environment). `headersFor('/sw.js')` and `headersFor('/manifest.webmanifest')` each return exactly `{ 'Cache-Control': 'no-cache' }`. `headersFor('/assets/index-abc.js')`, `headersFor('/icons/icon-192.png')`, `headersFor('/offline.html')` and `headersFor('/')` return `{}`. Run it and see it fail.
- [X] T005 Implement `backend/src/staticHeaders.ts`, exporting `headersFor(path: string): Record<string, string>` with a short header comment explaining why the worker and manifest must never be served from HTTP cache (rollback, research R4). T004 must pass.
- [X] T006 In `backend/src/server.ts`, change the production `express.static(staticPath, { index: false })` to also pass `setHeaders: (response, filePath) => { for (const [name, value] of Object.entries(headersFor('/' + relative(staticPath, filePath).split(sep).join('/')))) response.setHeader(name, value); }`. Import `relative` and `sep` from `node:path` and `headersFor` from `./staticHeaders.js`. Leave the `index.html` handling and the `app.get('*')` fallback unchanged.

**Checkpoint**: `npm test` and `npm run typecheck` pass.

---

## Phase 3: User Story 1 - Put the app on the home screen (Priority: P1) 🎯 MVP

**Goal**: Browsers see an installable app named "Lepak" with its own icon and dark launch colours. Android menu install and desktop install work. The tab shows the app's icon. (FR-001 to FR-005, FR-021)

**Independent Test**: `scripts/e2e/installable-app.sh us1` passes. On Android Chrome the menu's "Install app" item installs "Lepak" with its icon and opens it full-screen with the same saved places (quickstart §3). The automatic install prompt arrives with US3's worker.

### Implementation for User Story 1

- [X] T007 [P] [US1] Hand-author `frontend/icons/lepak-mark.svg`:
  - a 512×512 `viewBox` with a full-bleed `#202a36` square background;
  - a simple white (`#ffffff`) sun-partly-behind-cloud glyph drawn with plain paths;
  - no text, no gradients, no external references;
  - all artwork inside the central circle of diameter 410 (80%) so it survives maskable cropping (contracts/app-manifest.md "Icon files").
  Also write `frontend/public/favicon.svg` as the same glyph, with a `#202a36` rounded-square background.
- [X] T008 [US1] Create `scripts/icons/render-icons.sh`. It finds headless Chrome (the binary agent-browser uses, or `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, overridable with `CHROME`), then renders `frontend/icons/lepak-mark.svg` with `--headless=new --screenshot=<out> --window-size=<n>,<n> --default-background-color=00000000` through a temporary HTML wrapper sized to the viewport. It writes:
  - `frontend/public/icons/icon-192.png` (192);
  - `frontend/public/icons/icon-512.png` (512);
  - `frontend/public/icons/icon-maskable-512.png` (512, same full-bleed art);
  - `frontend/public/icons/apple-touch-icon.png` (180, opaque).
  Verify each size with `sips -g pixelWidth -g pixelHeight`. Clean up temp files in an `EXIT` trap. Run it once and commit the four PNGs (research R7).
- [X] T009 [P] [US1] Create `frontend/public/manifest.webmanifest` with exactly the JSON in contracts/app-manifest.md: `id`, `name` and `short_name` `"Lepak"`, `start_url` and `scope` `"/"`, `display` `"standalone"`, `theme_color` and `background_color` `"#202a36"`, and three icons (192 `any`, 512 `any`, 512 `maskable`). Add no other keys.
- [X] T010 [US1] Add the eight head tags from contracts/app-manifest.md "Head tags" to `frontend/index.html`, after the viewport meta: the manifest link, `theme-color` `#202a36`, the SVG icon, `apple-touch-icon`, `apple-mobile-web-app-title` `Lepak`, `mobile-web-app-capable`, `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` `black`. Keep `<title>Weather</title>` and the existing preconnect and dev-only script unchanged.
- [X] T011 [US1] Fill the `us1` function in `scripts/e2e/installable-app.sh`. Fetch the following with `curl -sS -D -` against the server base URL and assert:
  - `/manifest.webmanifest` has `Content-Type: application/manifest+json` and `Cache-Control: no-cache`, and its JSON equals the contract (compare with `node -e`);
  - each icon path returns `200` with `Content-Type: image/png`, or `image/svg+xml` for `/favicon.svg`, never `text/html`;
  - in the browser: open `/`, `assert_clean "us1 open"`, and confirm with `agent-browser eval` that `link[rel=manifest]`, `meta[name=theme-color][content="#202a36"]`, `link[rel=apple-touch-icon]` and `meta[name=apple-mobile-web-app-title][content=Lepak]` exist and `document.title === 'Weather'`.

**Checkpoint**: `npm run verify`, then `scripts/e2e/installable-app.sh us1`, pass. US1 can ship alone. Android then offers install from the menu (research R2).

---

## Phase 4: User Story 2 - iPhone users learn how to add it, and what happens to their places (Priority: P2)

**Goal**: On iPhone/iPad Safari only, after the first saved place, an "Add Lepak to Home Screen" button on its own full-width line directly under Use my location and Add, at every width, with a dot until first opened. It opens a non-modal tip explaining Share → Add to Home Screen and that the home-screen app keeps its own list. Got it removes the button for good. (FR-006 to FR-010; owner's choice A2)

**Independent Test**: `scripts/e2e/installable-app.sh us2` passes. On a real iPhone, quickstart §4 shows the button and tip, the steps work, and the home-screen app opens to the empty state.

### Tests for User Story 2

- [X] T012 [P] [US2] Write `frontend/src/install/installHint.test.ts` covering contracts/install-hint.md "Decision" with real user-agent strings:
  - **true**: iPhone Safari 17 with 1 place; iPad Safari with an iPad UA; iPadOS desktop-mode UA (`Macintosh`, `Version/17`, `Safari/`) with `maxTouchPoints: 5`.
  - **false**: the same iPhone UA with `standalone: true`, with `dismissed: true`, or with `savedCount: 0`.
  - **false**: CriOS, FxiOS, EdgiOS, `GSA/`, `FBAN`/`FBAV` and `Instagram` on iPhone; Android Chrome; Mac Safari with `maxTouchPoints: 0`.
  - `readFlag(storage, HINT_SEEN_KEY)` and `readFlag(storage, HINT_DISMISSED_KEY)` return false for an empty fake storage and true after `writeFlag` with the same key; the two keys are independent; `readFlag` returns false (no throw) when `getItem` throws; `writeFlag` doesn't throw when `setItem` throws.
  Run it and see it fail.

### Implementation for User Story 2

- [X] T013 [US2] Implement `frontend/src/install/installHint.ts`:
  - `HINT_SEEN_KEY = 'weather-starter.install-hint.seen'` and `HINT_DISMISSED_KEY = 'weather-starter.install-hint.dismissed'`;
  - `isIosDevice(userAgent, maxTouchPoints)`, `isIosSafari(userAgent, maxTouchPoints)` and `shouldShowInstallHint({ userAgent, maxTouchPoints, standalone, dismissed, savedCount })`, with rule `isIosSafari && !standalone && !dismissed && savedCount >= 1`;
  - `readFlag(storage, key)` (value `"1"` means set) and `writeFlag(storage, key)`, both catching every error, with storage typed like `KeyStorage` in `frontend/src/visitorKey.ts`;
  - `isStandalone(nav, matchMediaFn)`, true for `nav.standalone === true` or `matchMediaFn('(display-mode: standalone)').matches`.
  T012 must pass. No DOM or React imports.
- [X] T014 [US2] Create `frontend/src/components/InstallHint.tsx` (props: `savedCount: number`) per contracts/install-hint.md "Button" and "Tip". On mount it computes `shouldShowInstallHint` from `navigator.userAgent`, `navigator.maxTouchPoints`, `isStandalone(navigator, window.matchMedia)` and `readFlag(window.localStorage, HINT_DISMISSED_KEY)`, and reads `seen` the same way, accessing `localStorage` inside try/catch. It recomputes when `savedCount` changes, and returns `null` when the rule is false.
  - **Round button**: `<button type="button" aria-label="How to add Lepak to your Home Screen" aria-expanded={open} aria-controls="install-hint-tip">`. It matches the size and theme classes of the row's existing buttons (`min-h-11` touch target, `border-white/…`, `bg-white/[0.08]`, `text-white`, theme focus ring), with no literal colours (Principle V). Its content is an `aria-hidden` iOS share glyph; add `ShareIcon` to `frontend/src/components/icons.tsx` if none exists.
  - **Dot**: while `seen` is false, an `aria-hidden` dot on the top-right corner, styled like `dock-badge`.
  - **Tip**: when open, `<section id="install-hint-tip" aria-labelledby="install-hint-title" className="app-popover rounded-card …">`, anchored below the row and the sidebar's width on narrow screens. It is opaque and non-modal: no focus trap or scroll lock, and it doesn't cover the dock. It contains:
    - title **Add Lepak to your Home Screen** (`id="install-hint-title"`);
    - steps "Tap **Share** <ShareIcon aria-hidden>, then **Add to Home Screen**.";
    - note "The Home Screen app keeps its own list. Places saved here in Safari won't appear there, so you'll add them again.";
    - a **Got it** `<button>`.
  - **Opening** sets `seen` (`writeFlag`, plus in-memory state) so the dot disappears.
  - **Escape**, a pointer-down outside the tip and the button, or tapping the round button again closes the tip and returns focus to the round button. Reuse `DockSheet`'s outside-click and Escape approach.
  - **Got it** sets `dismissed` (`writeFlag`, plus in-memory state). The component then returns `null`, and focus moves to the row's first control (Use my location).
  - No network call, no log, no analytics event.
- [X] T015 [US2] In `frontend/src/components/Sidebar.tsx`, render `<InstallHint savedCount={locations.length} />` inside the existing `<div className="flex flex-wrap gap-2">` row, **after** `<UseMyLocation />` and `<AddLocationForm />`. Not inside any `md:`-only wrapper: the saved-place cards are `hidden md:block`, so phones have no list view (analysis finding U1). Read `docs/theming.md` first. Check the tip, when open, sits below the whole row even when `AddLocationForm` is expanded, and that the row is unchanged for non-iOS visitors, where the component renders `null`.
- [X] T016 [US2] Fill the `us2` function in `scripts/e2e/installable-app.sh`. Stub `GET /api/locations` with `agent-browser network route` (one saved place, as in `scripts/e2e/privacy-notice.sh`). Before navigating, register an init script overriding `navigator.userAgent`, `navigator.maxTouchPoints` and `navigator.standalone`. Run cases 1 to 6 in order **without** clearing `localStorage`, at a **375 px** viewport, then repeat cases 1 and 2 at 1280 px after clearing:
  1. iPhone Safari UA, 1 place: the button `[aria-label="How to add Lepak to your Home Screen"]` exists, has a non-zero bounding box inside the viewport, sits in the same row as Use my location, and shows its dot. `assert_clean`.
  2. Tab to it and press Enter: `aria-expanded="true"` and the tip shows the exact title, steps and note text. The dot is gone, and `localStorage['weather-starter.install-hint.seen'] === '1'`.
  3. Press Escape: the tip closes, the button is still there, and `document.activeElement` is the button.
  4. Open it again and activate **Got it** by keyboard: the tip and button are gone, and `localStorage['weather-starter.install-hint.dismissed'] === '1'`.
  5. Reload: still no button. `assert_clean`.
  6. Clear `localStorage`, set 0 places: no button.
  7. Clear `localStorage`. CriOS UA, Android Chrome UA, and iPhone UA with `standalone: true`, each with 1 place: no button.

**Checkpoint**: US1 and US2 both pass their checks, independently.

---

## Phase 5: User Story 3 - A clear offline message instead of a browser error (Priority: P3)

**Goal**: After one online visit, an offline open shows the app's own offline page. Only `/offline.html` is ever kept on the device. Online, everything comes from the server. A tested switch-off path exists. (FR-011 to FR-017; also enables Chrome's automatic install prompt, research R2)

**Independent Test**: `scripts/e2e/installable-app.sh us3` passes, plus the rollback and kill-switch drills in quickstart §6.

### Tests for User Story 3

- [X] T017 [P] [US3] Write `frontend/src/install/offlineHelper.test.ts` for `offlineHelperAction({ prod, hasServiceWorker, setting })`:
  - `prod: false` gives `'none'`;
  - `hasServiceWorker: false` gives `'none'`;
  - `setting: 'off'` with prod and a service worker gives `'unregister'`;
  - `setting: undefined` or `'on'` gives `'register'`.
  Also test `OFFLINE_CACHE_PREFIX === 'lepak-offline-'`, and that `isOfflineCache(name)` is true for `lepak-offline-v1` and false for `other-v1`. Run it and see it fail.

### Implementation for User Story 3

- [X] T018 [P] [US3] Create `frontend/public/offline.html` per contracts/offline-helper.md "`offline.html` content":
  - `<!doctype html>`, `<html lang="en">`, charset and viewport metas, `<meta name="theme-color" content="#202a36">`, `<title>Lepak – offline</title>`;
  - inline `<style>` only: body background `#202a36`, text `#ffffff`, secondary `rgba(255,255,255,0.85)`, system font stack, centred layout, a button with a visible 2px white focus outline;
  - an inline copy of the SVG mark from T007;
  - heading **You're offline**; body "Lepak can't reach the internet right now. Your places and weather will be here when you're back online.";
  - a **Try again** `<button>` with an inline `onclick="location.reload()"`.
  No external URL of any kind (no fonts, images or scripts) and no visitor data (FR-013).
- [X] T019 [P] [US3] Create `frontend/public/sw.js` exactly per contracts/offline-helper.md "Worker behaviour":
  - `const CACHE = 'lepak-offline-v1'`, `const OFFLINE_URL = '/offline.html'`;
  - **install**: `event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()))`;
  - **activate**: delete caches whose name starts with `lepak-offline-` and is not `CACHE`, then `self.clients.claim()`;
  - **fetch**: return without `respondWith` unless `request.mode === 'navigate'` and the URL's origin equals `self.location.origin`. Otherwise `respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL, { cacheName: CACHE }).then((r) => r || Response.error())))`.
  Start the file with a comment stating the rule "only /offline.html is ever cached; never app files, /api, or other origins (spec 014 FR-014)" and that the cache name must be bumped when `offline.html` changes. Plain script, no `import`.
- [X] T020 [P] [US3] Create `scripts/pwa/sw-kill.js` per contracts/offline-helper.md "Kill switch":
  - **install** calls `self.skipWaiting()`;
  - **activate** deletes every cache starting with `lepak-offline-`, calls `self.registration.unregister()`, then `self.clients.matchAll({ type: 'window' })` and `client.navigate(client.url)` for each;
  - no fetch handler.
  Add a header comment with the switch-off steps.
- [X] T021 [US3] Implement `frontend/src/install/offlineHelper.ts`:
  - pure exports `OFFLINE_CACHE_PREFIX`, `isOfflineCache` and `offlineHelperAction` (T017 must pass);
  - `applyOfflineHelper()`, which reads `import.meta.env.PROD`, `'serviceWorker' in navigator` and `import.meta.env.VITE_OFFLINE_HELPER`;
    - on `'register'`: `navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })`;
    - on `'unregister'`: unregister every `getRegistrations()` entry, then delete every cache matching `isOfflineCache`;
    - any rejection is caught and reported with a single `console.warn('[offline helper] …')`, never `console.error`.
  Declare `VITE_OFFLINE_HELPER?: 'on' | 'off'` in `frontend/src/vite-env.d.ts`.
- [X] T022 [US3] In `frontend/src/main.tsx`, after `createRoot(...).render(...)`, add `window.addEventListener('load', () => { void applyOfflineHelper(); }, { once: true });`, importing from `./install/offlineHelper`. Rendering must not wait on it.
- [X] T023 [US3] Fill the `us3` function in `scripts/e2e/installable-app.sh`:
  1. Open `/` online. Wait until `navigator.serviceWorker.controller` is non-null (poll with `agent-browser eval`, then reload once if needed). `assert_clean`.
  2. `eval` `caches.keys()` equals `['lepak-offline-v1']`, and that cache's `keys()` URLs are exactly `[<base>/offline.html]` (SC-008).
  3. `curl -sS -D - <base>/sw.js` shows `Cache-Control: no-cache`.
  4. `agent-browser set offline on`, reload: the page has heading "You're offline", the Try again button, and no text from the stubbed place name. `assert_clean`, allowing only the browser's own network-failure lines via `E2E_ALLOW_ERRORS` for this step, as `rain-view.sh` does.
  5. `set offline off`, click Try again: the dashboard renders. `assert_clean`.
  6. Back online, open the dashboard (worker active), then `set offline on` **without reloading**:
     - `eval` `fetch('/api/locations', { headers: { 'X-Visitor-Key': localStorage.getItem('weather-starter.visitor.key') ?? '' } }).then(() => 'ok', () => 'failed')` returns `'failed'`. This proves no saved-place data is served from the device (FR-014; replaces the earlier `workerStart` idea, analysis finding I1).
     - At a **1280 px** viewport, where the Hero's own Refresh button is shown (`md:inline-flex`; on phones refresh lives in the dock's "Switch place and refresh" sheet), click the Hero's **Refresh** button. The Hero's existing `role="alert"` error ("Couldn’t refresh <area>. …", with Retry) appears, the dashboard (place heading and tiles) stays on screen, and the heading "You're offline" is **not** present (US3 scenario 4, FR-016; analysis finding C2). Allow only the browser's network-failure lines via `E2E_ALLOW_ERRORS` for this step.
     - Then `set offline off`.
- [X] T024 [US3] Run the quickstart §6 drills against a temporary production server started with `E2E_BASE_URL`, never `npm run dev`:
  - **Rollback**: build A, open, build B with a visible marker, reload and see B; serve A, reload and see A.
  - **Kill switch**: copy `scripts/pwa/sw-kill.js` over `frontend/public/sw.js`, build with `VITE_OFFLINE_HELPER=off`, serve, reload twice, then assert `navigator.serviceWorker.getRegistrations()` is empty and `caches.keys()` has no `lepak-offline-*`. Then `git checkout frontend/public/sw.js` and rebuild.
  Record results and dates in `specs/014-installable-app/quickstart.md` §6.

**Checkpoint**: all three stories pass their checks. Chrome's automatic install prompt is now possible on Android.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 [P] Fill the `themes` function in `scripts/e2e/installable-app.sh`. At a 375 px viewport, with the iPhone UA and one stubbed place, for each of the six themes (`apple`, `glass`, `radar`, `sticker`, `memphis`, `singapore`; set as the app does via `localStorage`/`applyTheme`):
  - measure the round button's icon at 3:1 or better against its background;
  - open the tip and measure its title, body and Got it text at 4.5:1 or better against the nearest opaque background, and both focus rings at 3:1;
  - then load `/offline.html` directly and check its text at 4.5:1 (SC-009).
  Reuse the contrast helper approach in `scripts/e2e/privacy-notice.sh`.
- [X] T026 [P] Update `docs/architecture.md` with an "Installable app (spec 014)" paragraph covering:
  - the manifest and icons in `frontend/public/`;
  - `sw.js` caching only `/offline.html`, intercepting only navigations and falling back only on network failure;
  - registration in `main.tsx` via `install/offlineHelper.ts` (production only, `VITE_OFFLINE_HELPER=off` unregisters);
  - the iPhone Add to Home Screen button in the Add row and its tip (`install/installHint.ts`, `components/InstallHint.tsx`, keys `weather-starter.install-hint.seen` and `weather-starter.install-hint.dismissed`);
  - `staticHeaders.ts`;
  - that the home-screen app on iPhone has its own visitor key.
- [X] T027 [P] Update `docs/theming.md` with a "Fixed colours outside the theme" note. `manifest.webmanifest`, the `theme-color` meta and `offline.html` use `#202a36`, `#ffffff` and 85% white, copied from the `apple` theme, because browsers read them before CSS. Update all three if the default theme's darkest sky colour changes. The iPhone button and tip use theme classes as usual.
- [X] T028 [P] Update `docs/deployment.md`:
  - **Rollback section**: note that the offline helper never caches the app, so Instant Rollback reaches users at once. Rolling back to a build from before spec 014 leaves the worker installed but harmless (research R4).
  - **New "Switching off the offline helper" section**: the T020 and T024 steps; keep the kill-switch `sw.js` live for at least 90 days; never delete `sw.js` outright.
- [X] T029 [P] Update `docs/testing.md` with a bullet for `scripts/e2e/installable-app.sh [us1|us2|us3|themes]`: what each sub-check asserts, that it uses `agent-browser set offline`, and that real install and home-screen behaviour is manual (quickstart §3–5).
- [X] T030 Confirm the privacy notice needs no change. `frontend/src/components/PrivacyNotice.tsx` text is untouched, `scripts/e2e/privacy-notice.sh` passes, and a search confirms no new code sends the user agent, the tip's seen or dismissed flags or the visitor key anywhere (FR-019, FR-020).
- [X] T031 Run `npm run verify`, then `scripts/e2e/installable-app.sh` (all), plus the existing checks most likely affected by the head and Sidebar changes: `scripts/e2e/privacy-notice.sh`, `scripts/e2e/town-search.sh` and `scripts/e2e/use-my-location.sh`. Confirm afterwards that no process from the checks still holds a port. When opening the PR, copy the Principle V justification from plan.md "Complexity Tracking" into the PR description: the fixed colours in `manifest.webmanifest`, the `theme-color` meta and `offline.html`, why they can't come from the theme, and that `docs/theming.md` records them. The constitution's Governance section requires any deviation to be justified "in the plan or pull request" (analysis finding K1).
- [ ] T032 Run the manual device checks in quickstart §3–5 (Android Chrome, desktop Chrome/Edge, iPhone Safari, airplane mode) on the production deployment after the owner merges. Then run the **production rollback drill** (quickstart §6 step 1.4, SC-005; analysis finding C1):
  1. With the app installed on a phone, deploy a commit with a small visible marker and open the app to confirm it shows.
  2. Run `npx vercel@65.9.0 rollback <previous-deployment-url> --yes` (or Instant Rollback in the dashboard).
  3. Reopen the installed app online and confirm the marker is gone without clearing any data.
  4. Restore with `npx vercel@65.9.0 promote <deployment>`, then remove the marker in a follow-up commit.
  Record the outcomes, the two deployment ids and the date in `specs/014-installable-app/quickstart.md`, including whether the iPhone home-screen app opened with an empty list (research R1).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after T001. T004 → T005 → T006.
- **US1 (Phase 3)**: after Phase 2. T007 → T008 (needs the SVG). T009 and T010 are independent of the icons. T011 needs T003 and T008 to T010.
- **US2 (Phase 4)**: after Phase 1 only. It doesn't need the manifest or the headers. T012 → T013 → T014 → T015 → T016.
- **US3 (Phase 5)**: after Phase 2 (`no-cache` on `/sw.js`). T017 → T021 → T022. T018, T019 and T020 run in parallel with T017. T023 needs T018, T019, T021 and T022. T024 needs T020 and T023.
- **Polish (Phase 6)**: T025 needs T014 to T016 and T018. The doc tasks (T026 to T029) can start once their story is done. T031 and T032 come last.

### User Story Dependencies

- **US1**: independent; it is the MVP.
- **US2**: independent of US1 in code. Its value ("the app's icon after adding") is fuller once US1 is in, so it ships after US1.
- **US3**: independent of US1 and US2 in code. It completes Android's automatic install prompt (research R2).

### Within Each Story

- Unit test first, and see it fail. Then the pure module, the component or wiring, and the browser check.

## Parallel Example: after Phase 2

```text
# Different files, no shared state:
T007 [US1] frontend/icons/lepak-mark.svg + frontend/public/favicon.svg
T009 [US1] frontend/public/manifest.webmanifest
T012 [US2] frontend/src/install/installHint.test.ts
T017 [US3] frontend/src/install/offlineHelper.test.ts
T018 [US3] frontend/public/offline.html
T019 [US3] frontend/public/sw.js
T020 [US3] scripts/pwa/sw-kill.js
```

## Implementation Strategy

### MVP first (US1)

1. Phase 1 and Phase 2.
2. Phase 3 (US1). Then run `npm run verify` and `installable-app.sh us1`.
3. **Stop and validate**: installable from Android Chrome's menu and on desktop, with the right icon and name. This can be merged and deployed alone.

### Incremental delivery

1. US1: home-screen icon, name, full-screen.
2. US2: iPhone hint with the separate-list warning.
3. US3: offline page, plus Chrome's automatic prompt; rollback and kill-switch drills.
4. Polish: themes check, docs, full gate, device checks after deploy.

Each increment is a candidate commit. The pre-commit hook runs lint and test, and `--no-verify` is never used.
