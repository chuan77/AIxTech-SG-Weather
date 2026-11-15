---

description: "Task list for Themed Lightning Bolt Markers and Refresh Timing"
---

# Tasks: Themed Lightning Bolt Markers and Refresh Timing

**Input**: Design documents from `/specs/007-lightning-bolt-markers/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution Principles IV and VI require vitest coverage for pure frontend modules and Supertest coverage for backend routes, and quickstart §1 lists the expected cases. Write each test task before its implementation task and confirm it fails first.

**Organization**: Tasks are grouped by user story so each can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Web app: `backend/src/`, `frontend/src/`, run from the repo root. Read `docs/architecture.md`, `docs/theming.md` and `docs/testing.md` before starting (constitution, Development Workflow).

---

## Phase 1: Setup

**Purpose**: confirm a clean baseline and the one open tooling question.

- [X] T001 Run `npm run verify` from the repo root on the unchanged tree and record that it passes (baseline for this feature).
- [X] T002 Check whether the installed agent-browser can stub a network response (`agent-browser --help`, look for network routing such as `network route`). Record the answer and the exact command syntax at the top of `scripts/e2e/lightning-markers.sh` as a comment (create the file with a shebang and that comment only). This decides T030's approach (research.md §8).

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: test data with many strikes, used by US1's and US3's manual checks.

- [X] T003 Add a `createBusyLightningClient()` to `backend/src/lightningFixture.ts` that returns about 370 **deterministic** strikes (a seeded pseudo-random spread, no `Math.random`) spread over lat 0.8–1.9 and lng 103.2–104.6. Ages spread evenly across 0–59 minutes, and include at least 5 near-duplicate pairs within ~50 m of each other. Build them with `normaliseStrikes` as the demo client does, with type `C`, text `Cloud to Cloud`.
- [X] T004 Wire `LIGHTNING_FIXTURE=busy` in `backend/src/server.ts` next to the existing `demo` branch, with the same `NODE_ENV !== 'production'` guard and a matching `logger.warn('LIGHTNING_FIXTURE=busy: …')`.
- [X] T005 [P] Add a test in `backend/src/lightning.test.ts` (or a new `backend/src/lightningFixture.test.ts`) that the busy client returns between 350 and 400 strikes, all inside the 60-minute window, and the same coordinates on two calls with the same `now`.

**Checkpoint**: `LIGHTNING_FIXTURE=busy npm run dev` shows ~370 circles (still the old markers).

---

## Phase 3: User Story 1 - Recognise a strike as lightning at a glance (Priority: P1) 🎯 MVP

**Goal**: each strike shows as a filled bolt silhouette, clearly different from a thunderstorm pin, with the same popup and layering.

**Independent Test**: with `LIGHTNING_FIXTURE=demo`, the three strikes show as bolt marks at their positions; a saved location with a thunderstorm pin is plainly a different mark; selecting a bolt opens the type and time popup; turning the layer off removes all bolts.

### Tests for User Story 1

- [X] T006 [P] [US1] Create `frontend/src/components/map/strikeMarker.test.ts` covering `strikeStep(occurredAt, now)`. Ages 0, 2, 4.9 map to step 0; 5 → 1; 30 → 6; 55 → 11; 59.9 → 11. A future time (−3 min) → 0. An unparseable date → 11. The step changes only at 5-minute boundaries. The rule is "`floor(ageMinutes / 5)`, clamped 0–11".
- [X] T007 [P] [US1] In `frontend/src/components/map/strikeMarker.test.ts`, cover `strikeMarkup(step)`. The SVG is `aria-hidden="true"` and `focusable="false"`. It contains the `STRIKE_BOLT_PATH` path and **not** the `thunder` glyph's cloud path (`M7 14h10a4 4 0 0 0 .8-7.92…` from `frontend/src/components/icons.tsx`). It carries class `strike-mark`. It contains no `#` hex, `rgb(` or `hsl(` literal colour.

### Implementation for User Story 1

- [X] T008 [US1] Create `frontend/src/components/map/strikeMarker.ts`:
  - `STRIKE_STEPS = 12` and `STRIKE_STEP_MINUTES = 5`.
  - `strikeStep(occurredAt, now)` per T006.
  - `strikeSizePx(step)`, linear 24 (step 0) → 14 (step 11), rounded.
  - `strikeFresh(step)`, linear 1 → 0.
  - `STRIKE_BOLT_PATH`: a single closed, filled bolt polygon in a 24×24 viewBox, with no cloud.
  - `strikeMarkup(step)`: returns `<div class="strike-mark" style="--strike-fresh:<fresh>;width:<size>px;height:<size>px"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="…"/></svg></div>`.
  - `strikeIcon(step)`: returns a cached `L.divIcon({ html, className: 'strike-mark-wrapper', iconSize: [size, size], iconAnchor: [size/2, size/2] })`, at most 12 cached icons.
  Make T006 and T007 pass.
- [X] T009 [US1] Add `.strike-mark-wrapper` and `.strike-mark` styles to `frontend/src/index.css`: transparent wrapper with no default divIcon background or border; the svg fills the box; `fill: var(--lightning)`; `stroke: var(--lightning-outline)`; `stroke-width` ~1.5 (in viewBox units, scaled to the size); `stroke-linejoin: round`; `fill-opacity: calc(var(--lightning-fill-floor, 0.25) + (1 - var(--lightning-fill-floor, 0.25)) * var(--strike-fresh, 1))`; `stroke-opacity: 1`. Add a temporary `--lightning-outline` to `:root` only (the value of today's outline, `rgba(20, 25, 40, 0.85)`) so US1 works on every theme before US2 sets per-theme values.
- [X] T010 [US1] Rewrite `frontend/src/components/map/LightningLayer.tsx` to render one react-leaflet `Marker` per visible strike in the existing `lightning` pane (z-index 450), with `icon={strikeIcon(strikeStep(strike.occurred_at, now))}`, `keyboard={false}`, `riseOnHover={false}` and the existing `Popup` content from `formatStrikePopup`. Remove `CircleMarker`, `OUTLINE`, `FALLBACK_COLOUR`, `readLightningColour`, the colour `useState` and `useEffect`, and the `useTheme` import (CSS now handles theme colour). Keep the 30 s `useNow` tick and `visibleStrikes`.
- [X] T011 [US1] Remove `strikeStyle()` from `frontend/src/components/map/lightningHelpers.ts` and its `describe('strikeStyle')` block from `frontend/src/components/map/lightningHelpers.test.ts`. Move the "newest is most prominent" assertion for ages 2/30/55 into `strikeMarker.test.ts`: steps strictly increasing, sizes strictly decreasing.
- [X] T012 [US1] Run `LIGHTNING_FIXTURE=demo npm run dev` and do quickstart §3's mark checks on the default theme: bolts at positions, distinct from a thunderstorm pin, popup content unchanged, pins on top and clickable, toggle off removes bolts. Then run `LIGHTNING_FIXTURE=busy npm run dev` and pan and zoom for 10 s to confirm no visible stutter (SC-004). Restart dev between fixtures.

**Checkpoint**: US1 works and passes its tests on its own.

---

## Phase 4: User Story 2 - Bolt marks match the selected theme and stay legible (Priority: P1)

**Goal**: every theme sets its own bolt fill and outline with ≥3:1 contrast at every age, recolouring instantly on theme change.

**Independent Test**: with `LIGHTNING_FIXTURE=demo`, switch through all 6 themes in card and full-screen views. The bolts take each theme's colour with no new request, the 2/30/55-minute order is clear, and the 55-minute bolt is still findable with ≥3:1 contrast.

### Implementation for User Story 2

- [X] T013 [US2] In `frontend/src/index.css`, set `--lightning-outline` in **every** theme block next to its `--lightning`: `:root`/`apple`, `glass`, `radar`, `sticker`, `memphis` and `singapore` (find each `--lightning:` line). Remove the temporary `:root`-only value from T009 if it duplicates. Use a dark ink for light basemaps (apple and glass on `voyager`, sticker and memphis on `light_all`). On dark-basemap themes (radar and singapore on `dark_all`), use a dark separator and add `--lightning-fill-floor` (e.g. `0.45`) where needed so the oldest fill still reaches 3:1 against `dark_all`. Values must be theme tokens, not set in components (Principle V).
- [X] T014 [US2] Check contrast per theme. For each of the 6 themes, take a screenshot with the demo strikes in view. Measure the step-11 bolt's outline (light basemaps) or fill (dark basemaps) against the surrounding basemap pixel, and adjust T013's values until every theme is ≥3:1 (SC-003, FR-004). Record each theme's measured ratio as a comment beside its `--lightning-outline` in `frontend/src/index.css`.
- [X] T015 [US2] Confirm a theme switch with strikes drawn recolours the bolts at once with no `POST /api/lightning/refresh` in the Network tab (FR-003), and the overlapping near-duplicates from the busy fixture stay visibly overlapping (FR-006). Fix in `frontend/src/index.css` if not.
- [X] T016 [P] [US2] Update `docs/theming.md`: describe `--lightning-outline` and optional `--lightning-fill-floor` next to the existing `--lightning` line. State that strike marks get colour only through these variables, and that the outline is never faded.

**Checkpoint**: US1 and US2 both work; every theme is legible.

---

## Phase 5: User Story 3 - Know how long a lightning refresh took, and why (Priority: P2)

**Goal**: each owner-triggered refresh produces a server log line, a `Server-Timing` header and a browser `console.info` record showing provider time, pacing, retries, drawing time and strike count. Nothing is added to the dashboard.

**Independent Test**: with `LIGHTNING_FIXTURE=busy`, press Show latest lightning. One `[lightning] refresh timing` console record has every field; the response has `Server-Timing`; pressing Refresh again within 2 minutes logs `served: "reused"`. With the real client, the server log has a `lightning refresh timing` line.

### Tests for User Story 3

- [X] T017 [P] [US3] In `backend/src/providerHttp.test.ts`, add tests for `getJson(url, stats)` using a fake `fetchImpl`, `requestIntervalMs: 0` and `rateLimitRetryDelayMs: 0`:
  - one 200 → `requests: 1, retries: 0`;
  - a 429 then a 200 → `requests: 2, retries: 1, retryWaitMs ≥ 0`;
  - two calls with `requestIntervalMs: 50` → the second's `pacingWaitMs > 0`;
  - calling without `stats` still works.
  Field rules: "`requests` integer ≥ 0 … a 429 retry counts as 2", "`pacingWaitMs` number ≥ 0", "`retries` integer ≥ 0", "`retryWaitMs` number ≥ 0".
- [X] T018 [P] [US3] In `backend/src/lightning.test.ts`, add tests that `getRecentLightning(now, timing)` fills the sink. `served` is one of `'cache' | 'shared' | 'fetch'`, and `outcome` is one of `'ok' | 'empty' | 'stale' | 'error'`.
  - A first call → `served: 'fetch'`, `pages ≥ 1`, `requests ≥ 1`, `strikes` equal to the returned count, `outcome` `'ok'` or `'empty'`.
  - A second call within 2 minutes → `served: 'cache'`, `pages: 0`, `requests: 0`.
  - Two concurrent calls → one `'fetch'` and one `'shared'`.
  - A failure after a cached window → `outcome: 'stale'` with `errorKind`.
  - A failure with no cache → `outcome: 'error'`.
  - `errorKind` never contains `http`, `api-open` or `x-api-key`.
- [X] T019 [P] [US3] Create `backend/src/serverTiming.test.ts` for `formatServerTiming(timing)`. A full timing gives `total;dur=…, provider;dur=…;desc="fetch", pacing;dur=…, retry;dur=…, requests;desc="N", pages;desc="N"`, plus `retries;desc="N"` only when N > 0. A timing with only `totalMs` gives just `total;dur=…`. Durations are rounded integers. No `desc` ever holds anything but those enums or digits.
- [X] T020 [P] [US3] In `backend/src/routes/lightning.test.ts`, add Supertest cases via `createApp` with a fake `lightningClient`. A 200 response has a `Server-Timing` header with a `total;dur=` metric. A fake that fills the sink produces `provider`/`requests` metrics. A 502 response also carries `Server-Timing`. The header never contains `http`, `?` or `key`.
- [X] T021 [P] [US3] Create `frontend/src/components/map/lightningTiming.test.ts`:
  - `parseServerTiming(header)` round-trips T019's format, returns `{}` for `null`, empty or garbage, and ignores unknown metrics.
  - `buildTimingRecord({ trigger, startedAt, respondedAt, drawnAt, strikes, outcome, serverTiming })` returns `networkMs`, `drawMs` and `totalMs` from known numbers, with `served: 'network'`.
  - `buildReusedRecord(trigger, strikes, outcome)` returns `served: 'reused', networkMs: 0`.
  - `trigger` is limited to `'toggle' | 'refresh' | 'prompt'`, and `outcome` to `'ok' | 'empty' | 'unavailable'`.

### Implementation for User Story 3

- [X] T022 [US3] In `backend/src/providerHttp.ts`, export `interface RequestStats { requests: number; pacingWaitMs: number; retries: number; retryWaitMs: number }` and a `createRequestStats()` that returns zeros. Change `getJson<T>(url: string, stats?: RequestStats)`: add the time spent in `waitForRequestSlot()` to `pacingWaitMs`, increment `requests` per attempt actually sent, and on the 429 retry increment `retries` and add the delay to `retryWaitMs`. Existing callers are unchanged. Make T017 pass.
- [X] T023 [US3] In `backend/src/lightning.ts`, export `interface LightningTiming` with exactly the data-model.md fields: `served`, `totalMs`, `providerMs`, `pages`, `requests`, `pacingWaitMs`, `retries`, `retryWaitMs`, `strikes`, `outcome`, optional `errorKind`.
  - Change the interface to `getRecentLightning(now?: Date, timing?: Partial<LightningTiming>)`.
  - In `SingaporeLightningClient`, fill the sink for each path: cache hit, joining the in-flight promise, or `load()`. Pass one `RequestStats` through `fetchRecords` → `fetchPage` → `requester.getJson`, count pages, and measure `providerMs` around `fetchRecords`.
  - Log once per call: `logger.info({ ...timing }, 'lightning refresh timing')`.
  - Set `errorKind` to the error class name or a fixed category only, never a message containing a URL.
  - Make T018 pass. Update `backend/src/lightningFixture.ts` clients to accept and ignore the new argument if the type requires it.
- [X] T024 [P] [US3] Create `backend/src/serverTiming.ts` exporting `formatServerTiming(timing: Partial<LightningTiming> & { totalMs: number }): string` per `contracts/lightning-refresh-timing.md`. Make T019 pass.
- [X] T025 [US3] In `backend/src/routes/lightning.ts`, pass `const timing: Partial<LightningTiming> = {}` to `getRecentLightning(undefined, timing)`. Measure `totalMs` around the call with `performance.now()`, and set `response.setHeader('Server-Timing', formatServerTiming({ ...timing, totalMs }))` before both the 200 `json` and the 502 `json`. Make T020 pass.
- [X] T026 [US3] Create `frontend/src/components/map/lightningTiming.ts` with `parseServerTiming`, `buildTimingRecord`, `buildReusedRecord` and `logRefreshTiming(record)`, which calls `console.info('[lightning] refresh timing', record)` and never `console.error`. Make T021 pass.
- [X] T027 [US3] In `frontend/src/api.ts`, make `refreshLightning()` return `{ observation, serverTiming: string | null }`, reading `response.headers.get('Server-Timing')`. Add a lightning-specific fetch if the shared `request()` helper discards headers. Keep its error behaviour identical for the store.
- [X] T028 [US3] In `frontend/src/state/store.tsx`:
  - Give `refreshLightningData` a `trigger: 'toggle' | 'refresh' | 'prompt'` argument. `setLightningEnabledAndLoad` passes `'toggle'`; check `frontend/src/components/map/LightningControl.tsx` and pass `'refresh'` from the refresh button and `'prompt'` from the idle prompt.
  - When the store's `isFresh` early return fires, call `logRefreshTiming(buildReusedRecord(...))`.
  - Otherwise record `startedAt = performance.now()` and `respondedAt` after the response. Keep `{ trigger, startedAt, respondedAt, serverTiming, outcome }` in a ref keyed to the new observation's `fetched_at`.
  - Expose `lightning.reportDrawn(fetchedAt: string, strikes: number)` on the store, which builds the full record with `drawnAt = performance.now()` and logs it once.
  - On failure with no new observation, log the record immediately with `drawMs: 0` and `outcome: 'unavailable'`.
  - Update the `lightning` type in the store's context type and in `frontend/src/types.ts` if it is declared there.
- [X] T029 [US3] In `frontend/src/components/map/LightningLayer.tsx`, add a `useEffect` keyed on `lightning.observation?.fetched_at` that calls `requestAnimationFrame(() => lightning.reportDrawn(fetched_at, visibleCount))` and cancels the frame on cleanup. Also report when the observation has zero strikes, so `empty` refreshes get a record. If the layer is off when data arrives, have the store log at response time with `drawMs: 0`.

**Checkpoint**: all three stories work; timing appears only in the console, the server log and the Network tab.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T030 Finish `scripts/e2e/lightning-markers.sh` with modes `us1 | us2 | themes`, sourcing `scripts/e2e/lib.sh` and following `scripts/e2e/use-my-location.sh`:
  - Stub `POST /api/lightning/refresh` with the three demo-age strikes, using T002's routing syntax. If routing is unavailable, start a dev-mode server with `LIGHTNING_FIXTURE=demo` on a free port under the same `EXIT` trap teardown.
  - Start on `about:blank`, clear `errors` and `console`, open, then `assert_clean` after each open, theme switch and full-screen switch.
  - `us1`: press Show latest lightning; assert 3 `.strike-mark` elements and 0 `circle`/`path.leaflet-interactive` lightning circles; click one and assert the popup text has "Cloud to Cloud".
  - `us2`/`themes`: for each of the 6 themes, assert 3 `.strike-mark` elements and that the computed `fill` differs between at least two themes; save a screenshot per theme to `e2e-artifacts/`.
  - Never target `weather-starter.localhost:1355`. Confirm no process from the check still holds a port afterwards.
- [X] T031 [P] Update `docs/architecture.md`. In the **Lightning layer** paragraph, replace "one fading `CircleMarker`" with the bolt `Marker` description: 12 cached age steps, theme variables. In the **Lightning exception** paragraph, add the `lightning refresh timing` log line, the `Server-Timing` header, the browser `console.info` record and `LIGHTNING_FIXTURE=busy`.
- [X] T032 [P] Update `docs/testing.md` to list `scripts/e2e/lightning-markers.sh [us1|us2|themes]` with the other scripts.
- [X] T033 Run `npm run verify` from the repo root; fix any lint, type, test or build failure until it passes.
- [X] T034 Run `scripts/e2e/lightning-markers.sh us1`, `us2` and `themes` after T033, and confirm all pass with teardown complete.
- [X] T035 Do quickstart.md §2 by hand: busy fixture, one console record, a `served: "reused"` record within 2 minutes, a `Server-Timing` header, and a server log line. Then mark spec 002 regression checks SC-001, SC-004, SC-005 and SC-007 as still holding: positions, empty and unavailable messages, ≤1 provider request per 2 minutes, pins and basemap and full screen unchanged.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup; needed by the manual checks in US1 (T012) and US3 (T035). Code work in US1 and US3 can start in parallel with it.
- **US1 (Phase 3)**: after Phase 2. It's the MVP.
- **US2 (Phase 4)**: after US1's T008–T010, because it themes the marks US1 creates.
- **US3 (Phase 5)**: independent of US1 and US2 for backend tasks T017–T025. Frontend T029 edits `LightningLayer.tsx`, so do it after T010.
- **Polish (Phase 6)**: after all stories.

### Within Each Story

- Tests first (they must fail), then implementation.
- US1: T006, T007 → T008 → T009 → T010 → T011 → T012.
- US3 backend: T017 → T022; T018 → T023; T019 → T024; T020 → T025 (T025 needs T023 and T024).
- US3 frontend: T021 → T026 → T027 → T028 → T029.

## Parallel Example: User Story 3

```text
# All US3 tests at once (different files):
T017 backend/src/providerHttp.test.ts
T018 backend/src/lightning.test.ts
T019 backend/src/serverTiming.test.ts
T020 backend/src/routes/lightning.test.ts
T021 frontend/src/components/map/lightningTiming.test.ts

# Then independent implementations:
T024 backend/src/serverTiming.ts  alongside  T026 frontend/src/components/map/lightningTiming.ts
```

## Parallel Example: User Story 1

```text
T006 and T007 both edit strikeMarker.test.ts, so write them together; T005 (fixture test) can run beside them.
```

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 → Phase 2 → Phase 3.
2. **Stop and validate**: bolts replace circles on the default theme, distinct from thunderstorm pins, smooth at ~370 strikes.

### Incremental delivery

1. + US2 → every theme legible at ≥3:1 (the bolt is then safe to ship on all themes).
2. + US3 → timing baseline available for the Option B decision (`.specify/assessments/lightning-aggregation-and-icon/decision.md`).
3. Polish → e2e script, docs, `npm run verify`.

US1 alone is shippable on the default theme. Don't ship US1 without US2 to all themes until T014 confirms contrast.
