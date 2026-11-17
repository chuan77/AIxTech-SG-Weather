---

description: "Task list for Island-wide Rain on the Map (spec 011)"
---

# Tasks: Island-wide Rain on the Map

**Input**: Design documents from `specs/011-island-rain-view/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/rain-refresh.md](contracts/rain-refresh.md), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution IV and VI require vitest coverage for backend logic and routes and for pure frontend modules, and plan.md orders the backend work test-first. Write each test task first and confirm it fails before writing the code it covers.

**Organization**: Tasks are grouped by user story. Phase 1 contains **Gate 2**: if the owner rejects the mock-up, every task after T003 is cancelled.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5 from spec.md
- Paths are from the repo root (web app: `backend/src/`, `frontend/src/`)

## Reference patterns (read before starting)

Rain mirrors lightning one-for-one. Before writing a rain file, read its lightning counterpart:

| Rain file (new) | Lightning counterpart |
|---|---|
| `backend/src/rain.ts` | `backend/src/lightning.ts` (`SingaporeLightningClient`: `FRESH_MS`, in-flight sharing, `stale` fallback, timing) |
| `backend/src/routes/rain.ts` | `backend/src/routes/lightning.ts` |
| `backend/src/rainFixture.ts` | `backend/src/lightningFixture.ts` |
| `frontend/src/components/map/rainHelpers.ts` | `frontend/src/components/map/lightningHelpers.ts` |
| `frontend/src/components/map/rainMarker.ts` | `frontend/src/components/map/strikeMarker.ts`, `pinMarkup.ts` (`escapeHtml`) |
| `frontend/src/components/map/RainLayer.tsx` | `frontend/src/components/map/LightningLayer.tsx` (pane, `divIcon`, popups) |
| `frontend/src/components/map/RainControl.tsx` | `frontend/src/components/map/LightningControl.tsx` |
| `scripts/e2e/rain-view.sh` | `scripts/e2e/lightning-markers.sh` and `scripts/e2e/lib.sh` |

Also read `docs/architecture.md`, `docs/theming.md` and `docs/testing.md` first (constitution, Development Workflow).

---

## Phase 1: Setup and Gate 2 (blocking)

**Purpose**: create a working branch, then let the owner decide on the mock-up before any feature code is written.

- [X] T001 Ask the owner whether to create and switch to branch `011-island-rain-view` from `main` (the work is currently on `main`). Do it only if the owner says yes. Don't commit, push or stash the owner's uncommitted edit to `.specify/memory/constitution.md`.
- [X] T002 Build the throwaway Gate 2 mock-up. It must not be committed, so put it in the session scratchpad or a git-ignored folder such as `e2e-artifacts/rain-mockup/`.
  - **Content**: one static HTML page using Leaflet 1.9 from cdnjs. Draw about 88 rain station symbols at real station positions, taken from one `rainfall` response's `stations[].location`. Invent values so the page shows: dry; light (0.2–0.4 mm); moderate (0.6–2.4 mm); heavy (≥ 2.6 mm); partial (with a notch badge); and no reading (dashed ring with "–").
  - **Symbols**: they differ by size and shape as well as colour (research R7).
  - **Overlays**: the heaviness key, the rain status strip stacked above the lightning strip, and the Rain switch placed beside the Lightning switch (research R8).
  - **Views and themes**: render three views: the card map at 375 px, the full-screen map at 375 px, and the full-screen map at 1280 px. Show each in the `apple` theme (voyager basemap) and the `radar` theme (dark_all basemap).
  - **Hand-over**: give the owner the file path.
- [X] T003 Record the owner's Gate 2 verdict in `specs/011-island-rain-view/spec.md`, under Clarifications → Session 2026-11-17, and in `.specify/assessments/station-reading-map-layers/decision.md`, as a new "Gate 2 (date)" section:
  - **accept**: continue;
  - **accept with changes**: write the changes into spec.md Clarifications and adjust the affected tasks below, for example a combined Layers menu or new thresholds;
  - **reject**: change the decision verdict to **kill**, give the mock-up as the reason, and **stop: cancel T004 onward**.

**Checkpoint**: Gate 2 accepted. Feature work may start.

---

## Phase 2: Foundational (blocking prerequisites for all stories)

**Purpose**: the constitution amendment, the backend endpoint end to end, and the frontend data path. Every story depends on these.

**⚠️ CRITICAL**: no user-story work starts until this phase is complete.

- [X] T004 Amend Principle I in `.specify/memory/constitution.md`, building on the current working copy, which includes the owner's "fetched when" edit (research R10).
  - Add rain as a second named island-wide exception, `POST /api/rain/refresh`, on exactly lightning's terms:
    - explicit user action only, never during a page load;
    - not stored in SQLite or any location's `WeatherSnapshot`;
    - cached server-side for at least 2 minutes;
    - degrades to "unavailable" without affecting the rest of the app.
  - Keep "Any further exception requires its own amendment."
  - Bump **Version 1.4.0 → 1.5.0** and set Last Amended to the current date.
  - Replace the Sync Impact Report comment with this change. It must list `docs/architecture.md` and the docs-site pages from T053 as synced.
- [X] T005 [P] Add the rain types to `frontend/src/types.ts`, mirroring the lightning types and following data-model.md exactly.
  - `RainStationReading`: `{ id: string; name: string; latitude: number; longitude: number; total_mm: number | null; periods_covered: 0 | 1 | 2 | 3 }`.
  - `IslandRainObservation`: `{ stations: RainStationReading[]; window_minutes: number; window_start: string | null; window_end: string | null; periods_found: number; fetched_at: string; stale: boolean }`.
  - `RainStatus = 'idle' | 'loading' | 'ok' | 'empty' | 'unavailable'`.
  - `RainState`: `{ enabled; status; observation; setEnabled(enabled); refresh(trigger?: 'toggle' | 'refresh' | 'prompt') }`.
  - Add `rain: RainState` to the store value type.
- [X] T006 [P] Write the failing tests for the rain parser and window rules in `backend/src/rain.test.ts`. Build payloads with the Gate 1 response shape: `data.stations[] {id, deviceId, name, location:{latitude, longitude}}`, `data.readings[] {timestamp, data:[{stationId, value}]}`, newest first, plus `paginationToken`. Cover:
  - (a) The anchor `T` is the newest reading whose row count is **at least 80% of the largest row count** among the readings returned. An 08:20 reading with 3 of 87 rows is skipped, and the anchor becomes 08:15.
  - (b) The window is the periods `T`, `T−5 min` and `T−10 min`. `window_end = T`, `window_start = T − 15 min`, `window_minutes = 15`.
  - (c) `total_mm` is the sum of a station's numeric values over the covered periods, **rounded to 0.1 mm**, with values coerced using `Number()` (string `"0.2"` → 0.2).
  - (d) `periods_covered` counts 0–3. `total_mm` is `null` when `periods_covered = 0`.
  - (e) A period missing entirely from the response is uncovered for every station, and `periods_found` reflects it.
  - (f) Duplicate timestamps are counted once.
  - (g) Stations with missing or non-finite coordinates are left out. Output is sorted by `id`.
  - (h) No usable period, or every station at `periods_covered = 0`, makes the client throw `WeatherProviderError` (data-model.md Validation).
  - (i) Midnight: when the window reaches before 00:00 SGT, exactly one extra request is made with the previous SGT date, and the periods are merged.
  - (j) A request URL is `…/v2/real-time/api/rainfall?date=<YYYY-MM-DD in SGT>`.
  - Use a fake `ProviderRequester` or injected fetch, as `lightning.test.ts` does, with `requestIntervalMs: 0` and `rateLimitRetryDelayMs: 0`. Never touch the network.
- [X] T007 Implement `SingaporeRainClient` and the pure parsing helpers in `backend/src/rain.ts` so that T006 passes.
  - Export the `IslandRainObservation` and `RainStationReading` backend types, mirroring T005.
  - Export `RainTiming` (data-model.md, same fields as `LightningTiming` with `stations` instead of `strikes`).
  - Export `interface RainClient { getRecentRain(now?: Date, timing?: Partial<RainTiming>): Promise<IslandRainObservation> }`.
  - Export `class SingaporeRainClient implements RainClient`.
  - Make every call through the injected shared `ProviderRequester` (`getJson(url, stats?)`).
  - Read only the first page, and never follow `paginationToken`.
  - Keep one observation in memory with `FRESH_MS = 120_000`. A call within 2 minutes returns the cached copy without any request, `served: 'cache'`. Concurrent callers share one in-flight load, `served: 'shared'`. Match `SingaporeLightningClient` exactly.
- [X] T008 Add cache tests to `backend/src/rain.test.ts`, then make them pass in `backend/src/rain.ts`:
  - a second call within 120 000 ms makes zero requests;
  - a call at 120 001 ms fetches again;
  - two concurrent calls make one request;
  - `timing.served` is `cache`, `shared` or `fetch` as appropriate.
- [X] T009 Write the failing route tests for `POST /api/rain/refresh` in `backend/src/routes/rain.test.ts`. Follow the `backend/src/routes/locations.test.ts` and `backend/src/routes/lightning.test.ts` pattern: `createApp({ weatherClient: fake, rainClient: fake })`, a temporary SQLite database, Supertest. Cover:
  - a 200 response whose body matches contracts/rain-refresh.md;
  - a `Server-Timing` header;
  - no rows written to the locations table;
  - a `WeatherProviderError` from the fake producing **502 `{ "detail": "Rain data is currently unavailable" }`** with no provider text in the body.
- [X] T010 Create `backend/src/routes/rain.ts` with `createRainRouter({ rainClient?, requester? })`, mirroring `createLightningRouter`, so that T009 passes.
  - Default client: `new SingaporeRainClient({ apiKey: process.env.WEATHER_API_KEY, requester })`.
  - Route `router.post('/rain/refresh', …)`, with the comment "POST (not GET) because this is an explicit user action, never a page-load read."
  - Send `Server-Timing` through `formatServerTiming` on both 200 and 502.
  - Log `logger.warn({ err }, 'rain refresh failed')` on a provider error, and log the timing once as `rain refresh timing`.
- [X] T011 Wire rain into `backend/src/server.ts`:
  - add `rainClient?: RainClient` to `AppOptions`;
  - include `!rainClient` in the condition that builds the shared `ProviderRequester`, so all three clients share one paced stream (research R6);
  - mount `app.use('/api', createRainRouter({ rainClient, requester }))` beside the lightning router.
  - Add no per-device limiter: like `/api/lightning/refresh`, the 2-minute shared cache already caps provider calls at one per 2 minutes. Write a comment saying so.
- [X] T012 [P] Write the failing tests for `backend/src/rainFixture.test.ts`, then create `backend/src/rainFixture.ts` with `createFixtureRainClient()` (research R11).
  - It returns a deterministic `IslandRainObservation` built from a small hand-made list of about 20 stations, with ids, names and positions spread across Singapore. Don't copy anything from `RealtimeWeatherReadingsacrossSingapore/`.
  - It includes at least: 4 dry, 3 light (0.2, 0.4), 3 moderate (0.6, 1.4, 2.4), 3 heavy (2.6, 6.0, 12.0), 2 partial (`periods_covered` 1 and 2) and 2 no reading (`periods_covered` 0, `total_mm` null).
  - `window_end` is the current time rounded down to 5 minutes minus 10 minutes. `stale` is false.
- [X] T013 Wire `RAIN_FIXTURE=demo` in `backend/src/server.ts`. Copy the `LIGHTNING_FIXTURE=demo` block: use the fixture only when no `rainClient` was injected and `NODE_ENV !== 'production'`, and log the warning `RAIN_FIXTURE=demo: serving fake rain readings (development only)`.
- [X] T014 [P] Add `refreshRain()` to `frontend/src/api.ts`, mirroring `refreshLightning()`: `POST /rain/refresh` through `send()`, returning `{ observation: IslandRainObservation, serverTiming: string | null }`, and throwing on non-2xx.
- [X] T015 Add the rain state core to `frontend/src/state/store.tsx`, mirroring the lightning block (`refreshLightningData`, `lightningInFlightRef`, `lightningObservationRef`):
  - state `rainEnabled`, `rainStatus` (initially `'idle'`) and `rainObservation` (initially `null`);
  - `refreshRainData(trigger)`:
    - it is a no-op while a load is in flight, or while the current observation's `fetched_at` is under 120 000 ms old;
    - otherwise it sets `'loading'`, calls `refreshRain()`, and on success stores the observation;
    - its status is `'unavailable'` if `stale`, `'ok'` if any station has `total_mm > 0`, and `'empty'` otherwise;
    - on error it sets `'unavailable'` and **keeps the previous observation**.
  - Call `logInteraction('rain_refreshed')` and `logInteraction('rain_toggled', { enabled })`.
  - Expose `rain: { enabled, status, observation, setEnabled, refresh }` in the memoised store value. Add the new values to the dependency array.
  - Never call `refreshRainData` from a mount effect (constitution I).

**Checkpoint**: `npx vitest run backend/src/rain.test.ts backend/src/routes/rain.test.ts backend/src/rainFixture.test.ts` passes. With `RAIN_FIXTURE=demo`, `curl -X POST <server>/api/rain/refresh` returns the fixture.

---

## Phase 3: User Story 1 - See where it has rained in the last 15 minutes (Priority: P1) 🎯 MVP

**Goal**: with the rain view on, every station appears at its position, wet is visibly different from dry, and tapping a station shows its details.

**Independent Test**: with `RAIN_FIXTURE=demo` (or a stub), turn Rain on. Every fixture station with coordinates is drawn at its position, wet and dry differ, and a popup shows name, total, level and period (spec US1).

### Tests for User Story 1

- [X] T016 [P] [US1] Write the failing tests in `frontend/src/components/map/rainHelpers.test.ts` for:
  - `formatRainTotal(mm)`, giving `"0 mm"`, `"0.2 mm"` and `"12 mm"`;
  - `formatRainPeriod(window_start, window_end)`, giving SGT `"8:00–8:15 am"`, reusing the SGT formatting approach of `formatStrikeTime` in `lightningHelpers.ts`;
  - `isWet(reading)`: `total_mm > 0`;
  - `rainPopup(reading, observation)`, returning plain strings `{ title, total, level, period }`.

### Implementation for User Story 1

- [X] T017 [US1] Implement `formatRainTotal`, `formatRainPeriod`, `isWet` and `rainPopup` in `frontend/src/components/map/rainHelpers.ts` so that T016 passes.
- [X] T018 [P] [US1] Create `frontend/src/components/map/rainMarker.ts` with `rainMarkup(kind)` and `rainSizePx(kind)` for the kinds `dry` and `wet`. The markup carries class names only (`.rain-mark .rain-dry` / `.rain-wet`) and no colour, like `strikeMarker.ts`. Any text in the markup goes through `escapeHtml` from `pinMarkup.ts`. Add tests to `frontend/src/components/map/rainHelpers.test.ts`, or to a new `rainMarker.test.ts`, covering markup classes and sizes.
- [X] T019 [US1] Create `frontend/src/components/map/RainLayer.tsx`.
  - Use a react-leaflet `<Pane name="rain">` with **z-index 440**: below lightning (450), above the overlay pane (400) and below markers (600), so location pins and lightning stay on top.
  - Draw one `L.marker` per station, with an `L.divIcon` from `rainMarkup`.
  - Each marker gets a popup built with `rainPopup`. Escape it, or build it with DOM text nodes, never by injecting raw API strings.
  - Draw nothing when `rain.enabled` is false or `observation` is null.
  - Take a `showRain` prop matching `showLightning`.
  - Rebuild markers only when the `observation` object changes.
- [X] T020 [US1] Create `frontend/src/components/map/RainControl.tsx` with a `className` prop, mirroring `LightningControl.tsx`: a `role="switch"` button with `aria-label="Rain"`, `aria-checked={rain.enabled}`, the existing `RainIcon` from `frontend/src/components/icons.tsx` and an On/Off label, using the `map-control` class and the same 44 px touch size. This is the **full-screen** control. Leave the status strip, key and refresh button for US3–US5. In the same task, also create `frontend/src/components/map/MapLayersControl.tsx` for the **card map only** (Gate 2 change 1). It replaces the card's separate switches with one 44 px "Layers" `map-control` button (`aria-haspopup="true"`, `aria-expanded`). The button opens a small `rounded-card map-control` menu containing:
  - the Rain switch, with its refresh button once US5 adds one;
  - the Lightning switch and lightning's refresh button, wired to the existing `lightning.setEnabled` and `lightning.refresh`.

  The menu closes on Escape, on an outside tap and on a second press. Lightning's behaviour stays exactly as it is; only where its switch sits on the card changes. Put any logic worth testing, for example the button's summary label ("Rain · Lightning"), in `rainHelpers.ts` with tests.
- [X] T021 [US1] Mount the rain view:
  - in `frontend/src/components/map/WeatherMap.tsx`, add `<RainLayer showRain={…} />` next to `<LightningLayer>`, with a `showRain` prop that follows the `showLightning` prop;
  - in `frontend/src/components/map/MapCard.tsx`, replace `<LightningControl className="right-14 top-2" />` with `<MapLayersControl className="right-14 top-2" />`, keeping the expand button as it is;
  - in `frontend/src/components/map/MapFullscreen.tsx`, place `<RainControl>` beside the existing `<LightningControl>`;
  - check in the browser that at 375 px the full-screen map opens at the card's current view (it receives `initialView` from `MapCard`), not zoomed out to the whole island. Change it only if it doesn't (Gate 2 change 3).
- [X] T022 [US1] Add the base symbol styles to `frontend/src/index.css`: `.rain-mark`, `.rain-dry` (small hollow ring) and `.rain-wet` (filled drop). They read `--rain-dry`, `--rain-light` and `--rain-outline`. Add a **temporary** default set of `--rain-*` values to the `:root` block only. US2 (T030) replaces them with per-theme values.
- [X] T023 [US1] Create `scripts/e2e/rain-view.sh` (source `scripts/e2e/lib.sh`), with mode `us1`.
  - Stub `POST /api/rain/refresh` and `GET /api/locations` with `agent-browser network route`.
  - Start on `about:blank`, clear the errors and console, navigate, and call `assert_clean` after every open and view switch.
  - Turn Rain on and assert:
    - one `.rain-mark` per stubbed station with coordinates;
    - `.rain-dry` and `.rain-wet` both present;
    - a click opens a popup with the station name and total;
    - location pins are still clickable.
  - Never call data.gov.sg.

**Checkpoint**: US1 works on its own: stations, wet vs dry, popups, pins unaffected.

---

## Phase 4: User Story 2 - Tell how heavy the rain is (Priority: P1)

**Goal**: each wet station shows light, moderate or heavy, with a key, and is readable on every theme without relying on colour alone.

**Independent Test**: with fixture stations at each level, each station shows the matching symbol and the key lists every level and its range (spec US2).

### Tests for User Story 2

- [X] T024 [P] [US2] Add failing tests to `frontend/src/components/map/rainHelpers.test.ts` for `rainLevel(total_mm)`, using the research R4 thresholds verbatim: `0` → `dry`; `> 0 and < 0.6` → `light`; `≥ 0.6 and < 2.5` → `moderate`; `≥ 2.5` → `heavy`. Include the boundary cases 0, 0.2, 0.4, 0.6, 2.4, 2.5, 2.6 and 12. Also test `RAIN_LEVELS`, the ordered key entries `{ level, label, rangeMm, rangePerHour }`: Light "under 0.6 mm" / "under 2.5 mm/h", Moderate "0.6–2.5 mm" / "2.5–10 mm/h", Heavy "2.5 mm or more" / "10 mm/h or more".

### Implementation for User Story 2

- [X] T025 [US2] Implement `rainLevel` and `RAIN_LEVELS` in `frontend/src/components/map/rainHelpers.ts` so that T024 passes. Make `rainPopup` (T017) return the level label.
- [X] T026 [US2] Extend `frontend/src/components/map/rainMarker.ts` to the kinds `dry | light | moderate | heavy`. They differ in **size and shape**, not only colour: dry is a small hollow ring, light a small filled drop, moderate a medium drop, and heavy a large drop with a thick outline. Update `RainLayer.tsx` to pick the kind with `rainLevel`. Extend the markup and size tests.
- [X] T027 [US2] Add the key to `frontend/src/components/map/RainControl.tsx` (full-screen map) and to the Layers menu in `MapLayersControl.tsx` (card map):
  - a "Key" button (`aria-expanded`, 44 px touch target) opens a small `rounded-card map-control` legend;
  - the legend lists each `RAIN_LEVELS` entry with its symbol, label, mm range and per-hour range, plus the dry and "no reading" symbols;
  - it ends with the line "Rainfall: NEA via data.gov.sg";
  - it closes on Escape and on a second press.
- [X] T028 [US2] Add `.rain-light`, `.rain-moderate` and `.rain-heavy` symbol styles to `frontend/src/index.css`, reading `--rain-light`, `--rain-moderate`, `--rain-heavy` and `--rain-outline`.
- [X] T029 [US2] Read `docs/theming.md`. Then add per-theme `--rain-dry`, `--rain-light`, `--rain-moderate`, `--rain-heavy`, `--rain-outline` and `--rain-missing` values to every theme block in `frontend/src/index.css`: `apple`, `glass`, `radar`, `sticker`, `memphis` and `singapore`, all six from `frontend/src/theme/themes.ts`.
  - Each symbol's outline must reach **at least 3:1** against that theme's basemap, the same rule as `--lightning-outline`.
  - Write the measured ratio as a comment beside each value.
  - Don't change any existing `apple` value (constitution V).
  - Gate 2 change 4: **heavy must stand out most in every theme**. On dark basemaps (`radar`, `singapore`) use a strong, saturated colour for `--rain-heavy`, never a pale or white fill, so that brighter never reads as "less rain".
- [X] T030 [US2] Remove the temporary `:root`-only defaults from T022 if they duplicate the per-theme values. Keep a single fallback set.
- [X] T031 [US2] Add mode `us2` to `scripts/e2e/rain-view.sh`. Using a stub with every level, assert each `.rain-light`, `.rain-moderate` and `.rain-heavy` symbol has a distinct rendered size, and that the key lists Light, Moderate and Heavy with their ranges plus the attribution line.

**Checkpoint**: US1 and US2 both work: levels are readable and explained.

---

## Phase 5: User Story 3 - Know how fresh the readings are, and when a station has none (Priority: P1)

**Goal**: missing never looks dry, partial coverage is labelled, the reading time is shown, and old data is flagged.

**Independent Test**: with a stub containing partial and missing stations, and one `window_end` 25 minutes old, check the missing and partial symbols, the "to HH:MM · N min ago" text and the out-of-date label (spec US3).

### Tests for User Story 3

- [X] T032 [P] [US3] Add failing tests to `frontend/src/components/map/rainHelpers.test.ts` for:
  - `rainCoverage(reading)`: `3` → `full`; `1` or `2` → `partial`, with label `"5 of 15 min"` or `"10 of 15 min"`; `0` → `none`, with label `"No reading"`;
  - `isRainOutOfDate(observation, now)`: true when `observation.stale`, or when `now − window_end > 20 min` (1 200 000 ms), and false at exactly 20 min (research R3);
  - `rainStatusMessage(status, observation, now)`:
    - `idle` → "Show latest rain";
    - `loading` → "Loading rain…";
    - `ok` → "Rain at N stations";
    - `empty` → "No rain in the last 15 minutes";
    - `unavailable` → "Rain data unavailable";
    - with an `updatedText` of "to 8:15 am · 10 min ago" and "out of date" appended when out of date.

### Implementation for User Story 3

- [X] T033 [US3] Implement `rainCoverage`, `isRainOutOfDate` and `rainStatusMessage` in `frontend/src/components/map/rainHelpers.ts` so that T032 passes. Make `rainPopup` return the coverage note, and never return a level when coverage is `none`.
- [X] T034 [US3] Extend `frontend/src/components/map/rainMarker.ts` with the kind `missing` (a dashed ring with "–" and an `sr-only` "No reading") and a `partial` modifier: the level symbol plus a `.rain-partial` notch badge. Gate 2 change 5: make the badge **at least 9 px**, solid `--rain-outline` with a 2 px ring in the strip background colour, so it stays visible on the smallest (light) drop. Add the CSS to `frontend/src/index.css` using `--rain-missing` and `--rain-outline`. Missing must not share size, shape or fill with dry. Extend the tests.
- [X] T035 [US3] Update `frontend/src/components/map/RainLayer.tsx` to draw `missing` for `periods_covered = 0`, and the `partial` modifier for 1–2.
- [X] T036 [US3] Add the rain status strip to `frontend/src/components/map/RainControl.tsx`, mirroring the lightning strip: `role="status"`, `map-control`, the text from `rainStatusMessage`, and a clock from `useNow(30_000, rain.observation)`. On the **full-screen map**, it stacks above the lightning strip when both are on, and sits at the lightning strip's position when lightning is off. On the **card map** (Gate 2 change 2), rain and lightning share **one single-line strip**, for example "Rain at 30 stations · Lightning: 1 strike". Build the combined text with a pure `combinedStatusText(rain, lightning, now)` in `rainHelpers.ts`, with tests, and truncate it to one line. Tapping it opens the Layers menu (T020). The card's strip replaces the strip that `LightningControl` used to render on the card. Show "out of date" in the strip when `isRainOutOfDate` is true.
- [X] T037 [US3] Add mode `us3` to `scripts/e2e/rain-view.sh`. Assert:
  - `.rain-missing` and `.rain-partial` symbols are present for the stubbed stations;
  - the popup for a missing station says "No reading" and shows no level;
  - the strip shows "to …" with an age;
  - a stub with `window_end` 25 minutes old, and a separate stub with `stale: true`, each show "out of date".

**Checkpoint**: all P1 stories (US1–US3) work: the feature is honest about gaps and age.

---

## Phase 6: User Story 4 - Turn the rain view on and off without slowing the app (Priority: P2)

**Goal**: off by default, nothing fetched on load, the choice remembered per device, and the same state on the card and full-screen maps.

**Independent Test**: a fresh browser makes no rain request and the switch is off. Turning it on loads; turning it off hides only rain. After a reload with it on, the "Show latest rain" prompt appears and no request is made. The full-screen map makes no extra request (spec US4).

### Tests for User Story 4

- [X] T038 [P] [US4] Add failing tests to `frontend/src/components/map/rainHelpers.test.ts` for `RAIN_STORAGE_KEY === 'weather-starter.rain.enabled'`, `parseRainEnabled(raw)` and `serialiseRainEnabled(enabled)`. `null`, `''` and any value other than `"true"` give **false**, which differs from lightning's default on (FR-007). The round trip must hold.

### Implementation for User Story 4

- [X] T039 [US4] Implement `RAIN_STORAGE_KEY`, `parseRainEnabled` and `serialiseRainEnabled` in `frontend/src/components/map/rainHelpers.ts` so that T038 passes.
- [X] T040 [US4] In `frontend/src/state/store.tsx`:
  - add `readRainEnabled()` and `writeRainEnabled()`, wrapping `localStorage` in try/catch like `readLightningEnabled()`;
  - initialise `rainEnabled` from `readRainEnabled`;
  - `setEnabled(enabled)` writes the preference, logs `rain_toggled`, and calls `refreshRainData('toggle')` only when turning **on**.
  - Status stays `'idle'` on load, even when the stored value is true. No effect may fetch.
- [X] T041 [US4] In `frontend/src/components/map/RainControl.tsx`, render the idle strip text as a button ("Show latest rain") that calls `rain.refresh('prompt')`, with the same enlarged tap area classes as the lightning prompt.
- [X] T042 [US4] In `frontend/src/components/map/MapCard.tsx`, hide the card map's rain layer while full screen is open: pass `showRain` the same way `showLightning` is passed (spec 009 FR-009 precedent). Both maps read the same store observation, so opening full screen makes no request.
- [X] T043 [US4] Add mode `us4` to `scripts/e2e/rain-view.sh`. Assert:
  - zero `/api/rain/refresh` requests after the first load (network log);
  - the switch is `aria-checked="false"` by default;
  - after turning it on, the stations appear;
  - turning it off removes every `.rain-mark` while pins and lightning remain;
  - the toggle with data loaded is reflected in under 1 s (SC-004);
  - after a reload the switch is still on, with "Show latest rain" and zero requests;
  - opening full screen shows the same stations with zero new requests.

**Checkpoint**: US4 is independently verifiable, and SC-004 and SC-009 hold.

---

## Phase 7: User Story 5 - Refresh the rain readings and cope with failure (Priority: P2)

**Goal**: the user can ask for fresh readings, failures show "unavailable" while keeping the earlier readings, and nothing else in the app breaks.

**Independent Test**:
- with readings loaded, refresh and see the loading state with the earlier readings kept;
- a 502 stub shows "Rain data unavailable" with the earlier readings marked out of date;
- saved locations and lightning still work (spec US5).

### Tests for User Story 5

- [X] T044 [P] [US5] Add failing stale-fallback tests to `backend/src/rain.test.ts`:
  - after one successful fetch, a provider failure on a later fetch (cache expired) returns the previous observation with `stale: true`, and timing outcome `stale`;
  - a failure with no previous observation throws `WeatherProviderError`;
  - a 429 from the fake requester is treated as a failure, so the result is stale or thrown.
- [X] T045 [P] [US5] Add a route test to `backend/src/routes/rain.test.ts`: a fake client returning `stale: true` produces **200** with `stale: true` in the body.

### Implementation for User Story 5

- [X] T046 [US5] Implement the stale fallback in `backend/src/rain.ts`, copying `SingaporeLightningClient`'s `if (this.cached) { … stale: true }` branch, so that T044 and T045 pass.
- [X] T047 [US5] In `frontend/src/components/map/RainControl.tsx`, add the refresh button, shown only when rain is enabled. Use `aria-label="Refresh rain"`, `aria-busy` while loading, and a spinning `RefreshIcon`, mirroring lightning's.
- [X] T048 [US5] In `frontend/src/components/map/RainLayer.tsx` and `RainControl.tsx`:
  - while `status === 'loading'`, keep drawing the previous observation's stations and show "Loading rain…" (FR-012);
  - when `status === 'unavailable'` and an observation exists, keep drawing it, marked out of date;
  - with no observation, show only "Rain data unavailable", which is distinct from "No rain in the last 15 minutes".
- [X] T049 [US5] Add mode `us5` to `scripts/e2e/rain-view.sh`. Assert:
  - with a slow stub, the earlier stations remain during loading;
  - a 502 stub after a success shows "Rain data unavailable" and "out of date" with the stations still drawn;
  - a 502 stub on the first load shows "Rain data unavailable" and no stations;
  - a saved-location refresh (stubbed) and the lightning toggle still work while rain is failing.

**Checkpoint**: all five stories work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T050 [P] Check the attribution wording against the data.gov.sg licence (Singapore Open Data Licence) (research R9). If the required wording differs from "Rainfall: NEA via data.gov.sg", update it in `frontend/src/components/map/RainControl.tsx` (key) and in `rainPopup` in `frontend/src/components/map/rainHelpers.ts`. Note the licence version checked in `specs/011-island-rain-view/research.md` R9.
- [X] T051 [P] Add mode `themes` to `scripts/e2e/rain-view.sh`. For all six themes at 375 px:
  - take a screenshot of the full-screen map with every symbol kind, the open key and the strip;
  - assert that each symbol's computed `--rain-outline` reaches at least 3:1 against the theme basemap sample, and that the key and strip text reach at least 4.5:1.
- [X] T052 [P] Update `docs/architecture.md`. Add a "Rain exception" paragraph beside "Lightning exception" covering:
  - `POST /api/rain/refresh` on user action only;
  - one `rainfall?date=` request, two after midnight;
  - the 80%-rows anchor rule and the three-period sum;
  - the 2-minute shared cache, in-flight sharing and `stale` fallback;
  - the shared `ProviderRequester`;
  - `RAIN_FIXTURE=demo`;
  - `rain refresh timing` and `Server-Timing`;
  - that nothing is stored in SQLite.
- [X] T053 [P] Update the docs site:
  - create `docs/src/content/docs/backend/rain.md`, modelled on `backend/lightning.md`;
  - add the route to `docs/src/content/docs/backend/api.md`;
  - describe the rain view, key and controls in `docs/src/content/docs/frontend/map.md`;
  - add `RAIN_FIXTURE` to `docs/src/content/docs/configuration.md`;
  - add the rain flow to `docs/src/content/docs/architecture/data-flow.md`.
- [X] T054 [P] Update `docs/theming.md` with the `--rain-*` variables, the size and shape rule for symbols, the 3:1 outline rule and the measured ratios. Update `docs/testing.md` with `scripts/e2e/rain-view.sh [us1|us2|us3|us4|us5|themes]` and the fact that it stubs the route.
- [X] T055 Run `npm run verify` (lint → typecheck → tests → build). Fix every failure until it passes. A failing gate means the work is not done.
- [X] T056 Run `scripts/e2e/rain-view.sh` for `us1`, `us2`, `us3`, `us4`, `us5` and `themes` against its own temporary server, not the owner's `npm run dev`. Also re-run `scripts/e2e/lightning-markers.sh` and `scripts/e2e/lightning-grouping.sh`, because the card's lightning switch moved into the Layers menu (T020). Update any selector in those scripts that targeted the card's lightning switch or strip. All must pass, with no process left holding a port.
- [X] T057 Run the rate-budget check from quickstart.md §5 on a server you start yourself with the Development key: 5 overlapping saved-location refreshes while toggling and refreshing rain. Record in `specs/011-island-rain-view/quickstart.md` (a "Results" note):
  - the number of 429s (must be 0);
  - each `refresh timing` (must be within 10–15 s);
  - the `rain refresh timing` `served` values (at most one `fetch` per 2 minutes) (SC-006, SC-008).
- [X] T058 On the first showery day after release, run quickstart.md §6 once by hand. Confirm that wet values parse and that the totals match a manual three-period sum. Record the result in `specs/011-island-rain-view/research.md` under Gate 1, finding 4.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (T001–T003)** blocks everything. **A Gate 2 rejection at T003 cancels T004 onward.**
- **Phase 2 (T004–T015)** depends on Phase 1 and blocks every user story.
  - T004 (amendment) must land before or with T010 and T011 (the route).
  - T006 → T007 → T008 (tests first).
  - T009 → T010 → T011 → T013.
  - T005 → T014 → T015.
- **US1 (Phase 3)** depends on Phase 2.
- **US2 (Phase 4)** depends on US1's `rainMarker.ts`, `RainLayer.tsx` and `RainControl.tsx` (T018–T021).
- **US3 (Phase 5)** depends on US1. It can run in parallel with US2 if `rainMarker.ts` edits are coordinated: T026 and T034 touch the same file, so do them one after the other.
- **US4 (Phase 6)** depends on Phase 2 and T020 (the switch). It is otherwise independent of US2 and US3.
- **US5 (Phase 7)**: the backend part (T044–T046) depends only on Phase 2. The frontend part depends on T036 (the strip).
- **Polish (Phase 8)** depends on all the stories it documents or verifies. T055 → T056 → T057.

### User story completion order

Phase 1 → Phase 2 → US1 (MVP) → US2 and US3 (P1, finish both before release) → US4 → US5 → Polish.

### Within each story

Tests are written first and must fail. Then come the pure helpers, then markup and CSS, then components, and finally the e2e mode for that story.

## Parallel Opportunities

- Phase 2: T005 (frontend types), T006 (backend tests) and T012 (fixture) touch different files and can start together. T014 can start once T005 is done.
- US1: T016 (helper tests) and T018 (marker markup) run in parallel.
- US2 and US3 test tasks (T024 and T032) can be written in parallel. Both edit `rainHelpers.test.ts`, so either use separate `describe` blocks and merge them, or do them one after the other.
- US5 backend (T044–T046) can run alongside US2, US3 or US4 frontend work.
- Polish: T050–T054 all touch different files.

### Parallel example: Phase 2

```text
Task: "T005 Add rain types to frontend/src/types.ts"
Task: "T006 Write failing parser/window tests in backend/src/rain.test.ts"
Task: "T012 Fixture tests + backend/src/rainFixture.ts"
```

### Parallel example: User Story 1

```text
Task: "T016 Failing helper tests in frontend/src/components/map/rainHelpers.test.ts"
Task: "T018 rainMarker.ts markup + tests"
```

## Implementation Strategy

### MVP first (US1 only)

1. T001–T003: branch decision and Gate 2. **Stop here if the mock-up is rejected.**
2. Phase 2: amendment, backend endpoint, data path.
3. US1: stations drawn, wet vs dry, popups, the switch.
4. **Stop and validate**: `RAIN_FIXTURE=demo npm run dev`, then `scripts/e2e/rain-view.sh us1`.

US1 alone is a demo, not a release. It doesn't yet show heaviness or label missing data honestly. **The release scope is US1, US2 and US3 (all P1).** US3 in particular is the safety requirement: missing must never look dry.

### Incremental delivery

US1 → US2 (heaviness) → US3 (honesty about gaps and age, **release candidate**) → US4 (remembered toggle, prompt on reload) → US5 (refresh and failure handling) → Polish (docs, themes, verify, rate budget).

### Notes

- Commit only when the owner asks. The pre-commit hook runs `npm run lint` and `npm test`, and must never be bypassed with `--no-verify`.
- Never point the e2e scripts or the rate-budget run at the owner's `npm run dev` server or database.
- Never commit `RealtimeWeatherReadingsacrossSingapore/` or the Gate 2 mock-up.
