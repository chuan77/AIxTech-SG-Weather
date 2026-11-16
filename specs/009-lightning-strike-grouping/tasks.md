---
description: "Task list for lightning strike grouping (spec 009)"
---

# Tasks: Lightning Strike Grouping for Storm-Scale Volumes

**Input**: design documents in `specs/009-lightning-strike-grouping/`: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: included. The constitution requires them: Principle IV (pure frontend modules tested in node), Principle VI (Supertest for route changes), and a failing test before each fix where testable.

**Organization**: grouped by user story (spec.md). US1 (no freeze) needs grouping to bound the number of marks, so US1 delivers a working grouped layer with a plain count mark. US2 adds recency, theming and the group interactions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5 from spec.md
- Paths are from the repo root (web app: `backend/src/`, `frontend/src/`)

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: baseline, dependencies, and the storm data in its final place.

- [X] T001 Run `npm run verify` from the repo root on the unchanged tree and note in the PR description that it passes (baseline).
- [X] T002 Add dependencies:
  - `npm install supercluster@9.1.0 --save-exact -w frontend` (it ships its own types and brings `kdbush` ^4.1.0);
  - in the root workspace, `npm install compression@1.8.2 --save-exact` and `npm install -D @types/compression` (the backend runs from the root, see `package.json` `dependencies`).

  Confirm `package-lock.json` changes only for these packages. Versions are from research.md §12.
- [X] T003 [P] Move `specs/009-lightning-strike-grouping/data/lightning-storm-2026-11-16.json.gz` to `backend/fixtures/lightning-storm-2026-11-16.json.gz` with `git mv` once it's tracked, otherwise `mv`. It must be ≤ about 1 MB (it's 252 KB). Leave a one-line `specs/009-lightning-strike-grouping/data/README.md` pointing to the new location.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: the storm replay (needed to check US1, US2 and US5 by hand) and the pure grouping core (needed by US1 and US2).

**⚠️ CRITICAL**: no user story work starts until this phase is done.

- [X] T004 [P] Write failing tests in `backend/src/lightningFixture.test.ts` for `createStormLightningClient()` (contract in [contracts/lightning-refresh.md](./contracts/lightning-refresh.md)). Calling `getRecentLightning(now)` returns:
  - exactly 37,242 strikes;
  - every `occurred_at` inside `[now − 60 min, now + 5 min]`;
  - strikes sorted newest first;
  - unique ids of the form `occurred_at|latitude|longitude`;
  - `window_minutes: 60`, `stale: false`, `fetched_at === now.toISOString()`;
  - identical output on two calls with the same `now`.
- [X] T005 Implement `createStormLightningClient()` in `backend/src/lightningFixture.ts`:
  - read `backend/fixtures/lightning-storm-2026-11-16.json.gz` once (lazily, on the first call) with `fs.readFileSync` + `zlib.gunzipSync`, resolving the path from `process.cwd()` as the DB path does (the server runs from the repo root);
  - the format is `{ captured_at, provider_updated_at, window_minutes, fields: ["latitude","longitude","occurred_at","type","label"], strikes: [[lat, lng, occurred_at, type, label], …] }`;
  - shift every `occurred_at` by `now − Date.parse(captured_at)` and output it as ISO;
  - build `LightningStrike` objects with `id = \`${occurred_at}|${latitude}|${longitude}\``;
  - sort newest first and return a `LightningObservation`.

  Make T004 pass.
- [X] T006 Wire `LIGHTNING_FIXTURE=storm` in `backend/src/server.ts` next to `demo` and `busy`. Use the same `NODE_ENV !== 'production'` guard and `logger.warn('LIGHTNING_FIXTURE=storm: serving the 2026-11-16 storm (37,242 strikes, development only)')`.
- [X] T007 [P] Write failing tests in `frontend/src/components/map/lightningGroups.test.ts` for the pure helpers (data-model.md, LightningMark):
  - `formatGroupCount`: 2 → "2"; 999 → "999"; 1000 → "1k"; 1240 → "1.2k"; 9950 → "9.9k" (one decimal under 10k, truncated, not rounded up to "10k"); 10000 → "10k"; 37242 → "37k".
  - `groupAgeLabel(newestAtMs, now)`: under 1 min → "now"; 2.5 min → "2m"; 59.9 min → "59m"; future → "now"; NaN → "59m".
  - `groupSizeBand(count)`: `small` (<100), `medium` (<1,000), `large` (≥1,000).
  - `isSplittable(expansionZoom)`: `expansionZoom ≤ 20`.
- [X] T008 [P] In `frontend/src/components/map/lightningGroups.test.ts`, write failing tests for `buildStrikeIndex(strikes, now)` and `marksInView(index, bbox, zoom, now)`, with small hand-made strike sets:
  - two strikes 10 m apart at zoom 11 → one `group` mark with `count: 2`, `newestAtMs` = the newer strike, and `step` from `strikeStep`;
  - the same two at zoom 20 with identical positions → one `group` with `splittable: false`;
  - two strikes 50 km apart at zoom 11 → two `bolt` marks with keys `s:<id>`;
  - strikes older than 60 min or with unparseable times are excluded (via `visibleStrikes`);
  - group keys are `g:<groupId>@<zoom>`;
  - options are exported constants `GROUP_RADIUS_PX = 60` (changed to 40 during implementation, research §3), `GROUP_MIN_POINTS = 2`, `GROUP_MAX_ZOOM = 20`.
- [X] T009 [P] In `frontend/src/components/map/lightningGroups.test.ts`, write failing tests for `diffMarks(current: Map<key, appearanceKey>, wanted: LightningMark[])` → `{ add, remove, restyle }`:
  - unchanged keys and appearance → nothing to do;
  - a new key → `add`;
  - a missing key → `remove`;
  - same key, different appearance (bolt `step`; group `step|countLabel|ageLabel|sizeBand`) → `restyle`.
- [X] T010 Implement `frontend/src/components/map/lightningGroups.ts`. Use `supercluster` with `radius: GROUP_RADIUS_PX`, `minPoints: GROUP_MIN_POINTS`, `minZoom: 0`, `maxZoom: GROUP_MAX_ZOOM`, `map: (p) => ({ newest: p.occurredAtMs })`, and `reduce: (acc, p) => { if (p.newest > acc.newest) acc.newest = p.newest; }`. Points are GeoJSON `[lng, lat]` with properties `{ id, occurredAtMs }`. Export:
  - `formatGroupCount`, `groupAgeLabel`, `groupSizeBand`, `isSplittable`;
  - `buildStrikeIndex` (returns `{ index, strikeIds: Set<string>, strikesById }`);
  - `marksInView`;
  - `appearanceKey(mark)`;
  - `diffMarks`;
  - `groupLeaves(index, groupId, limit = 20)` (newest first);
  - `GROUP_RADIUS_PX`, `GROUP_MIN_POINTS`, `GROUP_MAX_ZOOM`.

  Reuse `strikeStep` from `strikeMarker.ts` and `visibleStrikes` from `lightningHelpers.ts`. No Leaflet or DOM imports. Make T007–T009 pass.

**Checkpoint**: `npm test` passes. `LIGHTNING_FIXTURE=storm npm run dev` serves 37,242 strikes. The map still uses the old per-strike layer, so it still freezes.

---

## Phase 3: User Story 1 - The map stays usable during a big storm (Priority: P1) 🎯 MVP

**Goal**: with 37,242 strikes, no action freezes the page for more than 200 ms (desktop), and the hidden card map does no lightning work in fullscreen.

**Independent Test**: `scripts/e2e/lightning-grouping.sh` (storm replay against the production build). Load, pan, zoom, fullscreen open and close, toggle and a 30 s tick each have no long task over 200 ms, and the card map has 0 lightning marks while fullscreen is open.

### Tests for User Story 1

- [X] T011 [P] [US1] Write failing tests in `frontend/src/components/map/groupMarker.test.ts` for `groupMarkup({ countLabel, ageLabel, step, sizeBand, count, splittable })`:
  - the root has class `strike-group`, `strike-group--<sizeBand>`, `data-count="<count>"` (exact integer), `data-step="<step>"` and `data-splittable="true|false"`;
  - it contains `.strike-group__count` with `countLabel` and `.strike-group__age` with `ageLabel`;
  - an inline `--strike-fresh` equals `strikeFresh(step)`;
  - any svg is `aria-hidden="true" focusable="false"`;
  - no `#`, `rgb(` or `hsl(` colour literal;
  - no `tabindex`.

  Also test `groupIconSizePx(sizeBand)` → 36 / 42 / 48 (shrunk to 28 / 32 / 36 during implementation so marks fit the 40 px radius).

### Implementation for User Story 1

- [X] T012 [US1] Create `frontend/src/components/map/groupMarker.ts` with `groupIconSizePx` and `groupMarkup` per T011. The structure is a halo `span.strike-group__halo`, a core `span.strike-group__core` holding a small bolt svg (reuse `STRIKE_BOLT_PATH`) and `span.strike-group__count`, and a `span.strike-group__age` tab below. Make T011 pass.
- [X] T013 [US1] Add base `.strike-group` styles to `frontend/src/index.css` next to `.strike-mark`. They must be enough to read the count for US1; US2 finalises the design:
  - `.strike-group-wrapper` has a transparent background and no border;
  - the core disc is filled `var(--lightning)` and outlined `var(--lightning-outline)`;
  - the count and age text use `var(--lightning-ink, var(--lightning-outline))`;
  - the age tab is a small pill under the disc;
  - no literal colours (Principle V).
- [X] T014 [US1] Rewrite `frontend/src/components/map/LightningLayer.tsx` as an imperative, diffed layer (research.md §2, §8):
  - `useMap()`; keep `<Pane name="lightning" style={{ zIndex: 450 }}>` and create one `L.layerGroup()` in it;
  - keep a `Map<key, { marker: L.Marker, appearance: string }>`;
  - keep the strike index in a ref, rebuilt with `buildStrikeIndex` only when the observation changes or a tick changes the in-window strike-id set;
  - `update()`:
    1. get `bbox` from `map.getBounds().pad(0.25)` and the zoom from `Math.round(map.getZoom())`;
    2. `marks = marksInView(...)`;
    3. `diffMarks`;
    4. remove, then add each mark as `L.marker(pos, { icon, pane: 'lightning', keyboard: false, riseOnHover: false })` into the layer group;
    5. call `setIcon` on restyled marks.
  - Icons: bolts reuse the 12 existing step icons; group icons come from a cache keyed by `appearanceKey`, built with `L.divIcon({ html: groupMarkup(…), className: 'strike-group-wrapper', iconSize: [s, s], iconAnchor: [s/2, s/2] })`.
  - Run `update()` on `moveend` and `zoomend`, on observation change, and on each `useNow(30_000)` tick.
  - Bolt click opens today's popup lazily: `L.popup().setLatLng(...).setContent(...)` with the `formatStrikePopup` text built with DOM `textContent`, never HTML strings from data.
  - Clear the layer group and the map when `enabled` is false, there's no observation, or `showLightning` is false.

  Keep the `reportDrawn` hook working for now (US5 changes it).
- [X] T015 [US1] Add a `showLightning?: boolean` prop (default `true`) to `WeatherMap` in `frontend/src/components/map/WeatherMap.tsx` and pass it to `<LightningLayer showLightning={…} />`. In `frontend/src/components/map/MapCard.tsx`, pass `showLightning={!expanded}` to the card's `WeatherMap` (FR-009).
- [X] T016 [US1] Create `scripts/e2e/lightning-grouping.sh` following `scripts/e2e/lightning-markers.sh` and `scripts/e2e/lib.sh`:
  - temporary server, `e2e_launch_browser` with `--init-script`, and `assert_clean` after every open, view switch and theme switch;
  - generate `e2e-artifacts/lightning-grouping/replay-init.js` from `backend/fixtures/lightning-storm-2026-11-16.json.gz` with an inline node script. It must:
    - replace `window.fetch` only for `/api/lightning/refresh`, returning the replay with times shifted to `Date.now()`;
    - record long tasks (`PerformanceObserver` `longtask`, buffered) and frame gaps over 50 ms into `window.__diag`;
  - stub `/api/locations` with one saved place (copy `locations_json` from `lightning-markers.sh`);
  - check:
    - (a) after pressing "Show latest lightning", `.strike-group` + `.strike-mark` count is > 0 and ≤ 1,500, and the max long task since the press is ≤ 200 ms;
    - (b) a 32 s wait (age tick) has max long task ≤ 200 ms;
    - (c) opening fullscreen has max long task ≤ 200 ms, and the card map (`section .leaflet-container`) has 0 `.strike-group`/`.strike-mark` while fullscreen is open;
    - (d) a mouse drag-pan and wheel zoom out and in on fullscreen each have max long task ≤ 200 ms;
    - (e) closing fullscreen has max long task ≤ 200 ms;
    - (f) toggling the layer off then on has max long task ≤ 200 ms;
    - (g) `performance.memory.usedJSHeapSize` ≤ 100 MB with the storm shown (SC-008).
  - Print each measured value; exit non-zero on any failure.
- [X] T017 [US1] Run `npm run verify`, then `scripts/e2e/lightning-grouping.sh`. If any 200 ms check fails, apply the plan.md fallbacks **in order** and stop when it passes:
  1. Pre-parse group and bolt icon HTML once and clone it in a `createIcon` override instead of setting `innerHTML` for each mark (`frontend/src/components/map/LightningLayer.tsx`).
  2. Reduce the bounds padding from 0.25 to 0.1.
  3. Raise `GROUP_RADIUS_PX` to 80 (update T008's expectation).
  4. Stop and raise canvas bolts (Option D) with the owner.

  Record the measured values in the PR.

**Checkpoint**: the MVP. The storm no longer freezes the map; crowded areas show count marks; zooming in shows single bolts.

---

## Phase 4: User Story 2 - See where and how recently lightning is striking (Priority: P2)

**Goal**: group marks show count and recency (a fading halo plus an "Nm" label) in every theme at WCAG AA. Selecting a group zooms in (fullscreen), opens fullscreen on it (card), or lists its strikes (can't split).

**Independent Test**: storm replay, whole island. The owner names the busiest area and the most recent area without popups on all 6 themes. Tapping a card group opens fullscreen there. Fullscreen group selection splits down to bolts. A group that can't split lists ≤ 20 strikes plus "and N more".

### Tests for User Story 2

- [X] T018 [P] [US2] In `frontend/src/components/map/lightningGroups.test.ts`, add failing tests for `groupListRows(leaves, now, total)`:
  - it returns at most 20 rows, newest first;
  - each row is `formatStrikePopup` text (`title`, `time`, `relative`);
  - there's a trailing `{ more: total - 20 }` only when `total > 20`.
- [X] T019 [P] [US2] In `frontend/src/components/map/lightningGroups.test.ts`, add failing tests for `groupSelectView(groupCenter, expansionZoom, maxZoom = 20)`. It returns `{ center, zoom: min(expansionZoom, 20) }` when splittable and `null` when `expansionZoom > 20`.

### Implementation for User Story 2

- [X] T020 [US2] Implement `groupListRows` and `groupSelectView` in `frontend/src/components/map/lightningGroups.ts`. Make T018 and T019 pass.
- [X] T021 [US2] Finish the group mark design in `frontend/src/index.css` (research.md §4):
  - the halo fill is `var(--lightning)` with `fill-opacity`/`opacity` equal to `calc(var(--lightning-fill-floor, 0.25) + (1 - var(--lightning-fill-floor, 0.25)) * var(--strike-fresh, 1))`;
  - the core disc and age tab stay solid `var(--lightning)` with text in `var(--lightning-ink)`, never faded;
  - the outline is `var(--lightning-outline)` and never fades;
  - three size bands at 36, 42 and 48 px (built as 28, 32 and 36 px);
  - the shape stays circular, distinct from the pill-shaped `.weather-pin`.
- [X] T022 [US2] Add `--lightning-ink` to all 6 theme blocks in `frontend/src/index.css` (apple/`:root`, glass, radar, sticker, memphis, singapore). For each value:
  - its contrast against that theme's `--lightning` must be ≥ 4.5:1;
  - write the measured ratio in a comment beside it, as the `--lightning-outline` comments do;
  - confirm the outline still gives ≥ 3:1 against the basemap.

  Don't change any other `apple` value (Principle V).
- [X] T023 [US2] Add group selection to `frontend/src/components/map/LightningLayer.tsx`:
  - on a group marker click, read `expansionZoom` via `index.getClusterExpansionZoom(groupId)` and call `groupSelectView`;
  - if the view isn't null and an `onGroupSelect` prop is set (card), call it with `{ center, zoom }`;
  - else if it's not null (fullscreen), `map.flyTo(center, zoom)`, or `map.setView(center, zoom, { animate: false })` when `prefersReducedMotion()` (same helper `FocusSelected` uses in `WeatherMap.tsx`);
  - else (can't split), open an `L.popup` at the group centre whose content is a `div.strike-group-list` built with DOM `textContent` from `groupListRows(groupLeaves(index, groupId, 20), now, count)`.
- [X] T024 [US2] Add an `onLightningGroupSelect?: (view: MapView) => void` prop to `WeatherMap` in `frontend/src/components/map/WeatherMap.tsx` and pass it through to `LightningLayer` as `onGroupSelect`. In `frontend/src/components/map/MapCard.tsx`, pass a handler that calls `setFullscreenView(view)` and then `expand()`, so fullscreen opens centred and zoomed on the group (clarification Q1). Leave `MapFullscreen` unchanged (it already takes `initialView`).
- [X] T025 [US2] Extend `scripts/e2e/lightning-grouping.sh`:
  - (h) every `.strike-group` has non-empty `.strike-group__count` and `.strike-group__age` text matching `^(now|[1-5]?[0-9]m)$`;
  - (i) clicking a card-map group opens the fullscreen dialog and its map zoom is greater than the card's zoom;
  - (j) in fullscreen, clicking groups repeatedly reaches a `.strike-mark` whose click shows a popup containing "Cloud to";
  - (k) for each of the 6 themes (`localStorage 'weather-theme'`), group marks are present, the computed `--lightning-ink` and `--lightning` are non-empty, and no `lightning/refresh` request fires on a theme switch;
  - (l) pins (`.leaflet-marker-pane`) have a higher z-index than `.leaflet-lightning-pane`.

**Checkpoint**: storm groups are legible and navigable on every theme.

---

## Phase 5: User Story 3 - Normal days look and behave as today (Priority: P2)

**Goal**: no visible change at normal volumes (spec 002 and 007 criteria hold).

**Independent Test**: `LIGHTNING_FIXTURE=demo` shows three single bolts. `LIGHTNING_FIXTURE=busy` shows almost all single bolts at the default zoom. `scripts/e2e/lightning-markers.sh` passes.

- [X] T026 [P] [US3] In `frontend/src/components/map/lightningGroups.test.ts`, add a test that builds the busy-fixture shape: about 370 strikes spread over lat 0.8–1.9 and lng 103.2–104.6 (generate deterministically in the test, or import `createBusyLightningClient` output saved as a small JSON fixture under `frontend/src/components/map/__fixtures__/` if importing the backend isn't allowed). At zoom 12 over the whole bbox, ≥ 95% of marks must be `bolt`. Also: the 3 demo strikes (2, 30 and 55 min old, at the demo positions) give 3 `bolt` marks at zoom 11 (FR-007, SC-006).
- [X] T027 [US3] Run `scripts/e2e/lightning-markers.sh` (spec 007's check). It must pass unchanged: three bolts, sizes "24,19,14", popup, toggle, pins on top, 6 themes. If its selectors relied on per-strike React markers, adjust only the selectors in `scripts/e2e/lightning-markers.sh`, never the assertions.
- [X] T028 [US3] Check by hand with `LIGHTNING_FIXTURE=busy npm run dev` and `LIGHTNING_FIXTURE=demo npm run dev` (quickstart.md §3):
  - empty, unavailable and stale messages unchanged (FR-019);
  - the Hero's "lightning near you" still reports the nearest individual strike (FR-014; `nearestStrike` unchanged in `frontend/src/components/map/lightningHelpers.ts`).

---

## Phase 6: User Story 4 - Readable count and less data on mobile (Priority: P3)

**Goal**: "37,242 strikes in the last hour", and a storm refresh ≤ 1.5 MB on the wire.

**Independent Test**: storm replay. Read the status strip. `curl --compressed` the refresh and check the size.

- [X] T029 [P] [US4] In `frontend/src/components/map/lightningHelpers.test.ts`, add failing tests:
  - `statusMessage('ok', observation with 37,242 visible strikes, now).text === '37,242 strikes in the last hour'`;
  - 1 strike → "1 strike in the last hour";
  - 999 → "999 strikes in the last hour".
- [X] T030 [US4] In `frontend/src/components/map/lightningHelpers.ts`, format the count in `statusMessage` with a module-level `new Intl.NumberFormat('en-SG')`. Make T029 pass.
- [X] T031 [P] [US4] In `backend/src/routes/lightning.test.ts`, add failing Supertest tests (contract: [contracts/lightning-refresh.md](./contracts/lightning-refresh.md)), using a fake `LightningClient` that returns 2,000 strikes:
  - with `Accept-Encoding: gzip`, the response has `content-encoding: gzip`, `vary` includes `Accept-Encoding`, and the parsed body deep-equals the fake observation;
  - with `Accept-Encoding: identity`, there's no `content-encoding` and the body is equal;
  - the `server-timing` header is present in both.
- [X] T032 [US4] Add `app.use(compression())` in `backend/src/server.ts` inside `createApp`, after `pinoHttp` and before `express.json()` and the routers. Use default options (threshold 1 KB, brotli when accepted). Make T031 pass. Confirm `Server-Timing` is still set on `POST /api/lightning/refresh` and the Vite dev middleware still serves the page in `npm run dev`.
- [X] T033 [US4] Measure: `LIGHTNING_FIXTURE=storm npm run dev`, then `curl -s --compressed -o /dev/null -w '%{size_download}\n' -X POST -H 'content-type: application/json' http://weather-starter.localhost:1355/api/lightning/refresh`. It must be ≤ 1,572,864 bytes (SC-005; expected about 545 KB gzip). Record the value in the PR.

---

## Phase 7: User Story 5 - The owner can measure storm-scale behaviour (Priority: P3)

**Goal**: the timing record's `drawMs` matches reality within 20% and reports `groups` and `bolts`. The storm replay works in development only.

**Independent Test**: storm replay plus a performance trace. Compare `drawMs` with the trace. In the production build, `LIGHTNING_FIXTURE=storm` is ignored.

- [X] T034 [P] [US5] In `frontend/src/components/map/lightningTiming.test.ts`, add failing tests:
  - `buildTimingRecord` accepts `groups` and `bolts` and copies them onto the record;
  - `buildReusedRecord` sets `groups: 0` and `bolts: 0` unless they're given.
- [X] T035 [US5] Extend `LightningTimingRecord`, `buildTimingRecord` and `buildReusedRecord` in `frontend/src/components/map/lightningTiming.ts` with `groups: number` and `bolts: number`. Make T034 pass.
- [X] T036 [US5] Change `reportDrawn` in `frontend/src/state/store.tsx` to `reportDrawn(observation, counts: { groups: number; bolts: number })` and pass the counts into `buildTimingRecord`. In `frontend/src/components/map/LightningLayer.tsx`, call it from the layer itself:
  - record a start mark when an update begins applying a **new** observation (index rebuild plus marker diff, synchronous);
  - then, in a **double** `requestAnimationFrame`, call `reportDrawn(observation, { groups, bolts })` with the drawn counts;
  - remove the old effect-scheduled single-rAF report;
  - when `showLightning` is false (hidden card map), don't report, so only the visible map reports.

  Research.md §9.
- [X] T037 [P] [US5] In `backend/src/lightningFixture.test.ts` or a server-level test, add a test that `LIGHTNING_FIXTURE=storm` with `NODE_ENV=production` does **not** select the storm client. Follow how the existing `demo` and `busy` guards are tested; if they aren't, test the selection through `createApp` with env stubbed via `vi.stubEnv`.
- [X] T038 [US5] Validate SC-007 (quickstart.md §5.3). Use the chrome-devtools MCP (`--isolated --no-performance-crux --no-usage-statistics`) against a temporary production server with the replay injected:
  - trace pressing "Show latest lightning";
  - compare the console `[lightning] refresh timing` `drawMs` with the trace's time from response to the first frame showing marks (must be within ±20%);
  - record both numbers in the PR.

---

## Phase 8: Polish and cross-cutting concerns

- [X] T039 [P] Update `docs/architecture.md`, in the lightning layer section:
  - the imperative grouped layer (supercluster, radius 40, bounded marks, diffing, lazy popups);
  - `showLightning` while fullscreen is open;
  - group selection;
  - `compression` middleware;
  - `LIGHTNING_FIXTURE=storm` and its fixture file;
  - the new `groups`/`bolts` timing fields.
- [X] T040 [P] Update `docs/theming.md`: document `--lightning-ink` (text on the group core, ≥ 4.5:1 against `--lightning`) and the group mark (the halo fades like bolts; the core, the text and the outline never fade).
- [X] T041 [P] Update `docs/testing.md` with the storm replay technique: an init-script `fetch` replacement, because 6 MB can't go through `agent-browser network route --body`. Add `scripts/e2e/lightning-grouping.sh` to the list of browser checks.
- [X] T042 Run SC-002 (quickstart.md §5.1): chrome-devtools MCP at `cpuThrottlingRate: 4` with the storm replay. Load, pan, zoom, fullscreen open and close, a theme switch, toggling the layer and a 30 s tick must each have no long task over 500 ms. Also check SC-003: lightning visible ≤ 2 s after the press. Record the values in the PR.
- [ ] T043 Real-phone pass (quickstart.md §6, SC-002 clarification): a mid-range phone about 3 years old with `LIGHTNING_FIXTURE=storm`. No visible freeze over about 0.5 s, and no reload or crash. Record the device model and result in the PR. (This is a manual owner step; mark it done only with a recorded result.)
- [ ] T044 Run the whole quickstart.md, including the six-theme legibility check in §7 (SC-004: the owner names the busiest and most recent areas without popups). Then run `npm run verify`, `scripts/e2e/lightning-grouping.sh` and `scripts/e2e/lightning-markers.sh`. After the checks, confirm no process still holds a port and no `backend/e2e-run-*.db` is left.
- [X] T045 Remove `specs/009-lightning-strike-grouping/data/` once `backend/fixtures/` holds the capture and docs point there. Keep the `README.md` pointer if any other doc links to `data/`, otherwise delete it.

---

## Dependencies and execution order

### Phase dependencies

- **Setup (T001–T003)**: start immediately.
- **Foundational (T004–T010)**: after Setup. Blocks every story.
- **US1 (T011–T017)**: after Foundational. **This is the MVP**, and US2's interaction tasks build on it.
- **US2 (T018–T025)**: after US1's T014 (the rewritten layer) for T023–T025. T018–T022 can start once Foundational is done.
- **US3 (T026–T028)**: T026 after T010. T027 and T028 after T014 and T015.
- **US4 (T029–T033)**: independent of US1 and US2 (status strip and backend only). It can run in parallel with US1 after Foundational, or even after Setup.
- **US5 (T034–T038)**: T034 and T035 are independent. T036 after T014. T037 after T006. T038 after T036.
- **Polish (T039–T045)**: after the stories it documents or measures.

### Story dependency graph

```text
Setup ─► Foundational ─┬─► US1 (MVP) ─┬─► US2 (T023–T025)
                       │              ├─► US3 (T027–T028)
                       │              └─► US5 (T036, T038)
                       ├─► US2 (T018–T022)
                       ├─► US3 (T026)
                       ├─► US4 (all)
                       └─► US5 (T034, T035, T037)
                                            ─► Polish
```

### Within each story

Tests first (they must fail), then the pure modules, then the Leaflet/React glue, then the browser check, then verification.

## Parallel examples

```text
# Foundational: write all failing tests together
T004 backend/src/lightningFixture.test.ts
T007 / T008 / T009 frontend/src/components/map/lightningGroups.test.ts (one file: run sequentially, or as one task)

# After Foundational: separate files, separate stories
T011 [US1] frontend/src/components/map/groupMarker.test.ts
T029 [US4] frontend/src/components/map/lightningHelpers.test.ts
T031 [US4] backend/src/routes/lightning.test.ts
T034 [US5] frontend/src/components/map/lightningTiming.test.ts

# Docs at the end
T039 docs/architecture.md   T040 docs/theming.md   T041 docs/testing.md
```

## Implementation strategy

### MVP first (US1)

1. Setup → Foundational (storm replay plus the grouping core with tests).
2. US1: group markup, base CSS, layer rewrite, `showLightning`, e2e storm check.
3. **Stop and validate**: `scripts/e2e/lightning-grouping.sh` passes the 200 ms checks. If not, follow T017's fallbacks before going further.

### Incremental delivery

1. US1: the map no longer freezes (shippable alone: crowded areas show plain count marks).
2. US4: readable count and a compressed payload (small, independent; can land in parallel).
3. US2: legible, themed, navigable groups.
4. US3: regression sign-off at normal volumes.
5. US5: a truthful timing record; then Polish (docs, phone checks, quickstart).

### Notes

- Never set `innerHTML` from strike data. Popups are built with `textContent` (the XSS rule from the weather-code-review skill).
- Pre-commit runs `npm run lint` and `npm test`. Don't bypass it with `--no-verify`.
- Commit after each task or logical group with conventional prefixes (`feat:`, `test:`, `docs:`, `chore:`).
