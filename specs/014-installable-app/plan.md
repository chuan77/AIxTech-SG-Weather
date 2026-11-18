# Implementation Plan: Installable App with an Offline Page

**Branch**: `014-installable-app` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-installable-app/spec.md`

## Summary

Make the app installable as "Lepak". Three pieces do this:

- **App description and head tags.** A manifest and icons in a new `frontend/public/`, plus head tags in `frontend/index.html`.
- **iPhone button and tip.** On iPhone/iPad Safari, after the first saved place, a labelled "Add Lepak to Home Screen" button sits on its own line directly under Use my location and Add, decided by a pure module. It opens a tip that says the home-screen app keeps its own list. Got it removes the button for good (owner's choice A2, 2026-11-18).
- **Offline helper.** A tiny hand-written service worker that caches only a self-contained `/offline.html` and answers with it only when a page navigation fails for lack of a network.

Online, nothing is cached or intercepted, so deploys and rollbacks behave as today. The server change is limited to `Cache-Control: no-cache` on `/sw.js` and the manifest. There is no new dependency, route, data.gov.sg call or stored data. Details and sources: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (frontend and backend), plain ES2020 JavaScript for the service worker and kill-switch worker; Node 24 (container)

**Primary Dependencies**: React 18, Vite 7 (copies `frontend/public/` into `dist/` unchanged), Express 4 (`express.static`). No new dependencies.

**Storage**: Browser Cache Storage (one cache, `lepak-offline-v1`, holding only `/offline.html`). `localStorage` holds two per-browser flags, `weather-starter.install-hint.seen` and `weather-starter.install-hint.dismissed`. No server storage or schema change.

**Testing**: vitest for the pure modules (`installHint.ts`, `offlineHelper.ts`, `staticHeaders.ts`); new agent-browser check `scripts/e2e/installable-app.sh`; manual real-device steps in quickstart.md

**Target Platform**: Android Chrome (current), iPhone/iPad Safari (iOS 16.4+), desktop Chrome/Edge; served from the Vercel container (HTTPS) and `127.0.0.1` for checks

**Project Type**: Web application (npm workspaces `frontend`, `backend`, one Node process)

**Performance Goals**: No change to online load time. The worker adds no work to non-navigation requests, and the offline page appears as fast as a local file.

**Constraints**:
- Only `/offline.html` may be cached (FR-014).
- Online responses come only from the network (FR-015).
- No personal data on the offline page (FR-013).
- No data.gov.sg calls (FR-018).
- Privacy notice unchanged (FR-019).
- AA contrast (SC-009).

**Scale/Scope**: Under 5 users today. Roughly 10 new files plus edits to `index.html`, `main.tsx`, one layout component, `server.ts`, `eslint.config.js` and four docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Snapshot-only weather data | Pass | No weather call is added. The worker never intercepts `/api/*`, and the offline page shows no data. |
| II. One process, relative API | Pass | Static files come from the same Express process. There is no router: `/offline.html` is a separate static page served only by the worker when offline, not a client route. The tip's seen and dismissed flags are per-viewer UI state kept in the component, not server state, so the store is untouched. |
| III. Injectable weather provider | Pass | Not touched. |
| IV. Testing within real limits | Pass | Hint and registration logic are pure `.ts` modules with vitest tests. The worker and the DOM are covered by the browser check, as for other UI work. |
| V. Theme-driven UI | **Deviation, justified** | Manifest colours, `theme-color` and the offline page use literal colours from the default theme, because browsers read them before any CSS and the offline page can't load `index.css`. The in-app button and tip use theme classes and `rounded-card`. See Complexity Tracking. |
| VI. Testing & quality gate | Pass | No new Express route. `staticHeaders.ts` gets a unit test. Lint and tests stay in pre-commit, and the ESLint config gains service-worker globals so `sw.js` is linted rather than ignored. |
| Workflow: docs updated with the change | Planned | `docs/architecture.md` (installable app paragraph), `docs/theming.md` (fixed colours), `docs/deployment.md` (kill switch and rollback note), `docs/testing.md` (new check). |

**Post-design re-check (after Phase 1)**: still passing. The contracts add no route, store or data path. The only deviation is still the Principle V one recorded below.

## Project Structure

### Documentation (this feature)

```text
specs/014-installable-app/
├── plan.md              # This file
├── research.md          # Phase 0: platform facts, worker design, rollback, icons
├── data-model.md        # Phase 1: app identity, offline cache, tip state
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── app-manifest.md      # manifest fields and head tags
│   ├── offline-helper.md    # worker lifecycle, fetch rules, kill switch, headers
│   └── install-hint.md      # when the button shows, the tip's text, closing and accessibility
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
frontend/
├── index.html                      # + manifest link, theme-color, icons, apple-* meta
├── icons/lepak-mark.svg            # source artwork (not served)
├── public/                         # new; Vite copies it to dist/ as is
│   ├── manifest.webmanifest
│   ├── sw.js                       # offline helper (contracts/offline-helper.md)
│   ├── offline.html                # self-contained offline page
│   ├── favicon.svg
│   └── icons/ icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
└── src/
    ├── main.tsx                    # + registerOfflineHelper() after load (production only)
    ├── install/
    │   ├── installHint.ts          # pure: shouldShowInstallHint(), isIosSafari()
    │   ├── installHint.test.ts
    │   ├── offlineHelper.ts        # pure decision + thin register/unregister wrapper
    │   └── offlineHelper.test.ts
    └── components/
        ├── InstallHint.tsx         # labelled button under the Add row + non-modal tip (contracts/install-hint.md)
        └── Sidebar.tsx             # renders <InstallHint savedCount={…} /> in the Add row

backend/src/
├── staticHeaders.ts                # pure: headers for /sw.js and the manifest
├── staticHeaders.test.ts
└── server.ts                       # express.static(…, { index: false, setHeaders })

scripts/
├── icons/render-icons.sh           # one-off: headless Chrome renders the SVG to PNGs
├── pwa/sw-kill.js                  # kill-switch worker, copied over sw.js to switch off
└── e2e/installable-app.sh          # us1 | us2 | us3 | themes

eslint.config.js                    # + serviceworker globals for frontend/public/**/*.js, scripts/pwa/**/*.js
docs/architecture.md, docs/theming.md, docs/deployment.md, docs/testing.md
```

**Structure Decision**: follow the existing web-application layout. Browser-only static files go in a new `frontend/public/`, which is Vite's standard pass-through folder, so `npm run build` copies them to `frontend/dist/` and the existing `express.static` serves them. Logic worth testing lives in `frontend/src/install/` as pure modules (Principle IV). The worker stays plain JavaScript, because files in `public/` are not compiled.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle V: literal colours in `manifest.webmanifest` (`theme_color`, `background_color`), `<meta name="theme-color">` and `offline.html`'s inline CSS | Browsers read manifest and meta colours before any stylesheet loads, so they can't be CSS variables. `offline.html` must be the only cached file (FR-014), so it can't load `index.css`. Values are copied from the default `apple` theme (`#202a36`, `#ffffff`, 85% white) and documented in `docs/theming.md` as the single place to update them. | Per-theme colours updated by JavaScript can't affect the launch screen or the offline page, add moving parts, and still need literal defaults. Caching `index.css` for the offline page would break FR-014 and bring back stale-file risk after deploys. |
