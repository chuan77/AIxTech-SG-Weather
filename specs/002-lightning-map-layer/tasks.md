# Tasks: Lightning Strikes on the Map

**Input**: Design documents from `/specs/002-lightning-map-layer/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/lightning-api.md](./contracts/lightning-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV requires vitest tests for backend routes and logic, and pure-module tests for extracted frontend logic. There are no DOM tests (no DOM environment).

**Constitution**: Principle I was amended to 1.1.0 on 2026-11-12 and already permits this feature's user-triggered, island-wide, non-persisted fetch. No constitution task remains.

**Organization**: Grouped by user story. Paths are repo-root relative. Run all commands from the repo root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 to US5 from spec.md

---

## Phase 1: Setup

- [X] T001 Read `docs/architecture.md`, `docs/theming.md` and `docs/testing.md` (required by the constitution before touching backend, theming or tests), then run `npm test` and `npm run build -w frontend` to confirm a passing baseline

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: Backend lightning client, endpoint and dev fixture; shared frontend types, API call, store slice and theme colour.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [X] T002 [P] Create `backend/src/lightning.ts` exporting `LightningStrike`, `LightningObservation` and `LightningClient { getRecentLightning(now?: Date): Promise<LightningObservation> }`, plus the pure function `normaliseStrikes(records, now)` implementing data-model.md: `latitude` "finite, -90 to 90 (parsed from the provider's string)", `longitude` "finite, -180 to 180" (a Singapore-only box drops most real strikes; see research.md §4), `occurred_at` "parseable; within `[now − 60 min, now + 5 min]`", `type` = provider code or `"unknown"`, `label` = provider `text` else `"Lightning"`, `id` = `"{datetime}|{latitude}|{longitude}"`; drop invalid strikes individually, de-duplicate by `id`, sort newest first
- [X] T003 Add `SingaporeLightningClient` to `backend/src/lightning.ts` implementing `LightningClient`: calls `https://api-open.data.gov.sg/v2/real-time/api/weather?api=lightning&date=<today SGT, UTC+8>`, follows `paginationToken` (query param `paginationToken=`) until the oldest record is older than `now − 60 min` or no token remains, max 3 pages, and also requests the previous SGT date once when the cutoff falls on it; reuse the existing request spacing (250 ms), 429 single retry, 8 s timeout, `WeatherProviderError` behaviour and `x-api-key` header (only when `WEATHER_API_KEY` is set) from `backend/src/weather.ts` by extracting a small shared fetch helper there instead of copying; constructor takes optional `fetchImpl` for tests; keep one in-memory window cached for 120 000 ms, share in-flight requests, on upstream failure return the previous window with `stale: true` else throw `WeatherProviderError`; always trim returned strikes to the last 60 minutes at response time; response fields `window_minutes: 60`, `fetched_at`, `provider_updated_at`, `stale` (depends on T002)
- [X] T004 [P] Create `backend/src/lightning.test.ts` with a fake `fetchImpl`: normalisation (string coords, out-of-range, NaN, missing datetime, unknown type code, missing `text` → "Lightning", +4 min kept and +6 min dropped, older than 60 min dropped, duplicates removed, newest first), pagination (2 pages, stops at cutoff, caps at 3), previous-date request after midnight SGT, cache reuse within 2 minutes (one upstream call for two `getRecentLightning` calls), re-fetch after 2 minutes, stale fallback on failure, throw when failing with no cache, and no `x-api-key` header without a key / header sent with one (depends on T002, T003)
- [X] T005 Create `backend/src/routes/lightning.ts` exporting `createLightningRouter({ lightningClient })` with `POST /lightning/refresh`: 200 with the observation per contracts/lightning-api.md; on `WeatherProviderError` with no fallback respond 502 `{ "detail": "Lightning data is currently unavailable" }` (never leak provider text or keys); default client is `new SingaporeLightningClient({ apiKey: process.env.WEATHER_API_KEY })` (depends on T003)
- [X] T006 [P] Create `backend/src/lightningFixture.ts` exporting `createFixtureLightningClient()`: a `LightningClient` returning three strikes inside Singapore aged 2, 30 and 55 minutes at the moment of each call (labels "Cloud to Cloud", `type` "C"), so the demo always shows fresh ages (depends on T002)
- [X] T007 Edit `backend/src/server.ts`: add `lightningClient?: LightningClient` to `AppOptions`; mount `app.use('/api', createLightningRouter({ lightningClient }))` next to the locations router; when `options.lightningClient` is absent and `process.env.LIGHTNING_FIXTURE === 'demo'` and `process.env.NODE_ENV !== 'production'`, use `createFixtureLightningClient()` and log a warning that demo lightning data is active (depends on T005, T006)
- [X] T008 [P] Create `backend/src/routes/lightning.test.ts` using `createApp({ serveFrontend: false, enableRequestLogging: false, lightningClient })` and `supertest`: 200 shape with strikes, 200 with empty `strikes`, `stale: true` passthrough, 502 body `{ detail }` without provider text, `GET /api/lightning/refresh` is 404, and the fixture client returns three strikes with ages near 2, 30 and 55 minutes (depends on T006, T007)
- [X] T009 [P] Edit `frontend/src/types.ts`: add `LightningStrike` and `LightningObservation` mirroring contracts/lightning-api.md, and `LightningStatus = 'idle' | 'loading' | 'ok' | 'empty' | 'unavailable'`
- [X] T010 Edit `frontend/src/api.ts`: add `export const refreshLightning = () => request<LightningObservation>('/lightning/refresh', { method: 'POST' })` (depends on T009)
- [X] T011 [P] Create `frontend/src/components/map/lightningHelpers.ts` with `LIGHTNING_FRESH_MS = 120_000`, `LIGHTNING_WINDOW_MS = 3_600_000`, `isFresh(observation, now)` (fetched under 2 minutes ago) and `visibleStrikes(strikes, now)` (drops strikes older than 60 minutes, tolerates future times and invalid dates without throwing) (depends on T009)
- [X] T012 Edit `frontend/src/state/store.tsx`: add a `lightning` slice to the single store context (`enabled`, `status`, `observation`, `setEnabled(boolean)`, `refresh()`); `status` starts `idle` and follows the transitions in data-model.md; `refresh()` calls `refreshLightning()` via `api.ts`, sets `loading`, then `ok` (strikes present) or `empty` (none) on success, or `unavailable` on failure while retaining the previous `observation`; it skips the request when `isFresh`, ignores calls while one is in flight, logs `lightning_refreshed` through `logInteraction` only when a request is actually made, and MUST NOT fetch on mount (depends on T010, T011)
- [X] T013 [P] Edit `frontend/src/index.css`: add a `--lightning` colour variable to the palette block of every theme (each existing `[data-theme='…']` block, as described in `docs/theming.md`), chosen to stay legible on that theme's basemap; the `apple` theme's existing look MUST NOT change

**Checkpoint**: `npm test` passes; `POST /api/lightning/refresh` works against the real provider and with `LIGHTNING_FIXTURE=demo`; the store exposes lightning state but nothing renders it yet.

---

## Phase 3: User Story 1 - See where lightning has struck recently (P1) 🎯 MVP

**Goal**: One marker per valid strike from the last hour at its real position, with a popup showing type and time.

**Independent Test**: Run `LIGHTNING_FIXTURE=demo npm run dev`, select a location, press the temporary load button, and confirm three markers at the right positions and a popup with type and time; strikes older than 60 minutes are not drawn.

- [X] T014 [P] [US1] Add to `frontend/src/components/map/lightningHelpers.ts`: `formatStrikeTime(occurredAt)` (local time, for example "9:38 pm") and `formatStrikePopup(strike, now)` returning `{ title: strike.label, time, relative }` (for example "12 min ago")
- [X] T015 [P] [US1] Create `frontend/src/components/map/lightningHelpers.test.ts` covering `visibleStrikes` (59 min kept, 61 min dropped, +4 min future kept, invalid date dropped without throwing), `isFresh` boundaries (119 s true, 120 s false, missing observation false) and `formatStrikePopup` (depends on T011, T014)
- [X] T016 [US1] Create `frontend/src/components/map/LightningLayer.tsx`: react-leaflet component that renders nothing when `lightning.enabled` is false, otherwise a `CircleMarker` per visible strike (keyed by `strike.id`, so toggling never duplicates markers) inside a dedicated Leaflet pane (via `map.createPane`) with a `zIndex` below the marker pane so location pins stay clickable; semi-transparent fill so near-identical positions stay discernible; colour read from `--lightning` via `getComputedStyle(document.documentElement)` and refreshed when the theme changes; a `Popup` from `formatStrikePopup`; and a 30-second `setInterval` tick (cleared on unmount) that re-evaluates `visibleStrikes` so strikes expire at 60 minutes without a network call (depends on T012, T013, T014)
- [X] T017 [US1] Edit `frontend/src/components/map/WeatherMap.tsx` to render `<LightningLayer />` inside `MapContainer` after the pin markers (depends on T016)
- [X] T018 [US1] (skipped: not needed, T021 and T026 landed in the same pass) Add a temporary "Load lightning" button (`aria-label="Load lightning"`) in `frontend/src/components/map/MapCard.tsx` and `frontend/src/components/map/MapFullscreen.tsx` calling `lightning.refresh()`, so US1 can be exercised alone; it is replaced in T022 (depends on T012)

**Checkpoint**: The button loads strikes; markers and popups work on the real provider and the demo fixture.

---

## Phase 4: User Story 2 - Turn the lightning display on and off (P1)

**Goal**: A keyboard-accessible switch that hides and shows the layer, remembers the choice across reloads, defaults to on, and works in the card and full-screen views.

**Independent Test**: Toggle off: markers vanish, pins and basemap unchanged. Reload: still off, no lightning request. Clear storage: on.

- [X] T019 [P] [US2] Add to `frontend/src/components/map/lightningHelpers.ts`: `LIGHTNING_STORAGE_KEY = 'weather-starter.lightning.enabled'`, `parseEnabled(raw: string | null): boolean` (missing, unreadable or any value other than `"false"` means on) and `serialiseEnabled(enabled): string`; add tests for both to `frontend/src/components/map/lightningHelpers.test.ts`
- [X] T020 [US2] Edit `frontend/src/state/store.tsx`: initialise `lightning.enabled` from `localStorage` via `parseEnabled`, persist in `setEnabled`, wrapping every storage read and write in try/catch so blocked storage still renders (default on); `setEnabled(true)` calls `refresh()` (a no-op when fresh) and `setEnabled(false)` never makes a request; log `lightning_toggled` with `{ enabled }` through `logInteraction` (depends on T012, T019)
- [X] T021 [P] [US2] Create `frontend/src/components/map/LightningControl.tsx`: a native `<button type="button" role="switch" aria-checked>` with accessible name "Lightning", a visible label and `ThunderIcon` from `frontend/src/components/icons.tsx`; at least 44 px touch target; styled like the existing map buttons (`rounded-full border border-white/20 bg-black/40 text-[#fff] backdrop-blur-xl`) with `z-[1000]`; reads and writes the store's `lightning` slice so card and full-screen stay in sync (depends on T012)
- [X] T022 [US2] Replace the temporary button from T018 with `<LightningControl />` in `frontend/src/components/map/MapCard.tsx` (left of the expand button) and `frontend/src/components/map/MapFullscreen.tsx` (left of the close button, respecting `safe-area-inset-*`), leaving the existing buttons and behaviour unchanged; confirm pins, selection, basemap switching and full screen behave as before with the layer on and off (SC-007) (depends on T020, T021)

**Checkpoint**: P1 stories complete: toggleable, persistent lightning layer. Suggested MVP.

---

## Phase 5: User Story 3 - Understand how recent each strike is (P2)

**Goal**: Newer strikes look stronger; older ones fade and disappear at 60 minutes.

**Independent Test**: With the demo fixture, the 2-minute strike is visibly stronger than the 55-minute one.

- [X] T023 [P] [US3] Add to `frontend/src/components/map/lightningHelpers.ts`: `strikeStyle(occurredAt, now)` returning `{ opacity, radius }` with age in minutes clamped to `[0, 60]`, `opacity = 1 − 0.85 × (age / 60)` and `radius = 8 − 3 × (age / 60)`; add tests to `frontend/src/components/map/lightningHelpers.test.ts` (0 min → 1 and 8, 30 min → 0.575 and 6.5, 60 min → 0.15 and 5, negative age clamps to 0, strictly decreasing)
- [X] T024 [US3] Edit `frontend/src/components/map/LightningLayer.tsx` to apply `strikeStyle` to each `CircleMarker`, using the existing 30-second tick so fading advances without a network call (depends on T016, T023)

**Checkpoint**: Fading works on every theme.

---

## Phase 6: User Story 4 - Clear feedback when empty or unavailable (P2)

**Goal**: A status strip that distinguishes idle, loading, empty, unavailable and ok, with the last-updated time.

**Independent Test**: Idle shows "Show latest lightning" (a button) with no request made; an empty result shows "No lightning in the last hour"; a failed refresh shows "Lightning data is currently unavailable" while earlier strikes stay drawn and the map remains usable; layer off shows nothing.

- [X] T025 [P] [US4] Add to `frontend/src/components/map/lightningHelpers.ts`: `statusMessage(status, observation, now)` returning `{ text, updatedText | null }`: idle → "Show latest lightning"; loading → "Loading lightning…"; empty → "No lightning in the last hour"; unavailable → "Lightning data is currently unavailable"; ok → "{n} strike(s) in the last hour"; `updatedText` = "Updated {time}" from `fetched_at` whenever an observation exists; add tests to `frontend/src/components/map/lightningHelpers.test.ts` for every status, including unavailable with a retained observation, and singular/plural
- [X] T026 [US4] Add a status strip to `frontend/src/components/map/LightningControl.tsx`, rendered only when `lightning.enabled`: `role="status"`, text from `statusMessage`, `rounded-card` plus theme `white` classes per `docs/theming.md`, placed bottom-left over the map clear of the attribution; in the `idle` status the text is a button that calls `lightning.refresh()`; render nothing when the layer is off (depends on T021, T025)

**Checkpoint**: All visible states render correctly; SC-004 satisfied.

---

## Phase 7: User Story 5 - Refresh the lightning data (P3)

**Goal**: A visible refresh action, with data fresher than 2 minutes reused.

**Independent Test**: Refresh updates strikes and the last-updated time; repeated toggling and refreshing within 2 minutes makes one request.

- [X] T027 [US5] Add a refresh icon button to `frontend/src/components/map/LightningControl.tsx` using the existing `RefreshIcon` from `frontend/src/components/icons.tsx`, with accessible name "Refresh lightning", disabled with `aria-busy` while `status === 'loading'`, calling `lightning.refresh()` (depends on T026)
- [X] T028 [P] [US5] Extend `frontend/src/components/map/lightningHelpers.test.ts` with a regression that `isFresh` is false once `fetched_at` is 120 s old or older and true at 119 s, so repeated actions follow the 2-minute reuse rule (depends on T015)

**Checkpoint**: All five stories functional.

---

## Phase 8: Polish & Cross-Cutting

- [X] T029 [P] Update `docs/architecture.md` (Snapshot pattern and Map sections) to describe the lightning layer, `POST /api/lightning/refresh`, the 2-minute server cache, the user-action-only rule (constitution 1.1.0 exception), the `localStorage` toggle and `LIGHTNING_FIXTURE=demo`; update `docs/theming.md` with the `--lightning` variable
- [X] T030 Run `npm test` and `npm run build -w frontend`; both MUST pass
- [ ] T031 Run [quickstart.md](./quickstart.md) §2, §3 rows 1 to 9 and §4 (with `LIGHTNING_FIXTURE=demo`) in the browser across every theme, in the card and full-screen views; also time a toggle (SC-002, under 1 second) and confirm SC-005: no more than one upstream request per 2-minute period
- [X] T032 Verify the real provider's strike format when lightning next occurs (quickstart §5); if field names differ from `{ location: { latitude, longitude }, type, text, datetime }`, fix `normaliseStrikes` and add a regression test in `backend/src/lightning.test.ts`
- [ ] T033 Before committing: remove the temporary Sync Impact Report comment from the top of `.specify/memory/constitution.md`, and confirm `RealtimeWeatherReadingsacrossSingapore/`, `.env` and `.env.local` are not staged

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → stories → Polish.** Phase 2 blocks everything.
- Phase 2 backend track: T002 → T003 → T005; T004 needs T002+T003; T006 needs T002; T007 needs T005+T006; T008 needs T006+T007.
- Phase 2 frontend track: T009 → T010 and T011; T012 needs T010+T011; T013 is independent. The two tracks are independent until US1.
- **US1** needs T012, T013. **US2**: T019 and T021 can start after Phase 2; T022 needs T020+T021. **US3** needs T016 (and T023). **US4** needs T021 (and T025). **US5** needs T026.
- Tasks that edit the same file must not run in parallel even if marked [P] elsewhere: `lightningHelpers.ts` and its test (T014, T015, T019, T023, T025, T028), `LightningLayer.tsx` (T016, T024), `LightningControl.tsx` (T021, T026, T027), `store.tsx` (T012, T020), `MapCard.tsx` and `MapFullscreen.tsx` (T018, T022), `server.ts` (T007).

## Parallel Opportunities

- Phase 2: T002, T009 and T013 together; then T004, T006, T008 and T011 as their dependencies land.
- After Phase 2: T019 and T021 (US2) can run alongside T014 and T015 (US1).
- After T021: T023 (US3) and T025 (US4) are independent helpers; T029 (docs) can run at any time after T007.

## Implementation Strategy

- **MVP**: Phases 1 to 4 (US1 + US2): a visible, toggleable, persistent lightning layer, verifiable with the demo fixture.
- **Increment**: US3 (fade), then US4 (status messages and idle prompt), then US5 (refresh button), validating each with its independent test.
- Commit per phase with conventional prefixes (`feat:`, `docs:`), and never commit sample dumps or `.env` files.

## Implementation notes (2026-11-12)

- **T018** was skipped: the real `LightningControl` (T021) and idle-prompt button (T026) were built together, which also fixes analysis finding G1.
- **T002 / research §4**: coordinates are validated as WGS84 ranges, not a Singapore box. The live feed on 2026-11-12 had 370 strikes, only 22 inside Singapore; the rest were in the wider region.
- **T026**: the status strip uses the map's dark-glass style (`bg-black/50`, `text-[#fff]`) and `rounded-xl` instead of `rounded-card`, like the map's other overlay buttons, so it stays legible on every basemap (see `docs/theming.md`).
- **T031** is left open: verified in the browser (scratch server, demo fixture): no request on load, idle prompt, markers and fading, toggle off/on, persistence across reload, unavailable then recovery, Midnight Radar theme, fullscreen markers. Not yet checked: the other themes, card/fullscreen switch sync, an actual Space-key press, and the SC-002 timing.
- **T032**: the real feed matches the documented shape (`location` strings, `type` `C` or `G`, `text`, `datetime`).
- **T033** is left open: remove the Sync Impact Report comment from the constitution when committing.
