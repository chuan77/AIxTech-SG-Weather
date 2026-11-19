---

description: "Task list for Temperature and Wind Across Singapore on the Map (spec 015)"
---

# Tasks: Temperature and Wind Across Singapore on the Map

**Input**: Design documents from `specs/015-temperature-wind-layer/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/temp-wind-refresh.md](contracts/temp-wind-refresh.md), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution IV and VI require vitest coverage of the backend logic and routes and of the pure frontend modules, and plan.md orders the backend work test-first. Write each test task first and confirm it fails before you write the code it covers.

**Organization**: tasks are grouped by user story. Both gates (the Gate 1 mock-up and the Gate 2 afternoon sample) passed on 2026-11-19, so no task here is gated.

**Scope reminder**: the view appears on the **full-screen map only** (Gate 1). The card map, its Layers menu and its combined status strip must not change (FR-001, FR-009).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (a different file, and no dependency on an unfinished task)
- **[Story]**: US1–US5 from spec.md
- Paths are from the repo root (web app: `backend/src/`, `frontend/src/`)

## Reference patterns (read before starting)

Temperature & wind mirrors rain (spec 011) file for file. Before writing each new file, read its rain counterpart:

| New file | Rain counterpart |
|---|---|
| `backend/src/tempWind.ts` | `backend/src/rain.ts` (`SingaporeRainClient`: `FRESH_MS`, in-flight sharing, `lastFailure`, `stale` fallback, timing) |
| `backend/src/routes/tempWind.ts` | `backend/src/routes/rain.ts` (`createRainRouter`) |
| `backend/src/tempWindFixture.ts` | `backend/src/rainFixture.ts` (`createFixtureRainClient`) |
| `frontend/src/components/map/tempWindHelpers.ts` | `frontend/src/components/map/rainHelpers.ts` (levels, out-of-date, status text, storage keys, licence constants, `shouldAutoOpenLegend`) |
| `frontend/src/components/map/tempWindMarker.ts` | `frontend/src/components/map/rainMarker.ts`, plus `escapeHtml` from `pinMarkup.ts` |
| `frontend/src/components/map/TempWindLayer.tsx` | `frontend/src/components/map/RainLayer.tsx` (pane, `divIcon`, popups, `accessibleName`) |
| `frontend/src/components/map/TempWindControl.tsx` | `frontend/src/components/map/RainControl.tsx` (`RainSwitch`, `RainRefreshButton`, `RainStatusStrip`, `RainLegend`) |
| `scripts/e2e/temp-wind.sh` | `scripts/e2e/rain-view.sh` and `scripts/e2e/lib.sh` |

Also read `docs/architecture.md`, `docs/theming.md` and `docs/testing.md` first (constitution, Development Workflow). Rain and lightning code is **not** refactored or shared (research R12).

---

## Phase 1: Setup

**Purpose**: a working branch.

- [X] T001 Ask the owner whether to create and switch to branch `015-temperature-wind-layer` from `main` (the work is currently on `main`). Do it only if the owner says yes. Don't commit, push or stash the owner's uncommitted files, including `.impeccable/config.json` and the untracked assessment folders `ci-pr-review/`, `flood-alerts/` and `narrow-audit-scope/` in `.specify/assessments/`.

---

## Phase 2: Foundational (blocking prerequisites for all stories)

**Purpose**: the constitution amendment, the backend endpoint end to end, and the frontend data path. Every story depends on these.

**⚠️ CRITICAL**: no user-story work starts until this phase is complete. T002 must land before or with T009 (the route).

- [X] T002 Amend Principle I in `.specify/memory/constitution.md` (research R10, FR-019).
  - Add **air temperature and wind station readings** (`POST /api/temp-wind/refresh`) as a third named island-wide exception, on exactly the lightning and rain terms:
    - explicit user action only, never during a page load;
    - not stored in SQLite or any location's `WeatherSnapshot`;
    - cached server-side for at least 2 minutes;
    - degrades to "unavailable" without affecting the rest of the app.
  - Keep "Any further exception requires its own amendment."
  - Bump **Version 1.5.0 → 1.6.0** (MINOR) and set Last Amended to the current date.
  - Replace the Sync Impact Report comment with this change. List `docs/architecture.md` and the docs-site pages from T041 as synced.
  - In the same task, add a temperature and wind paragraph next to rain's exception paragraph in `docs/architecture.md`, saying it is full-screen only.
- [X] T003 [P] Add the types to `frontend/src/types.ts`, following data-model.md exactly:
  - `TempWindStation`: `{ id: string; name: string | null; latitude: number; longitude: number; temperature_c: number | null; wind_speed_knots: number | null; wind_direction_deg: number | null }`.
  - `IslandConditionsObservation`: `{ stations: TempWindStation[]; measures: { temperature: 'ok' | 'unavailable'; wind: 'ok' | 'unavailable' }; temperature_at: string | null; wind_at: string | null; fetched_at: string; stale: boolean }`.
  - `TempWindStatus = 'idle' | 'loading' | 'ready' | 'unavailable'`.
  - `TempWindState`: `{ enabled: boolean; status: TempWindStatus; observation: IslandConditionsObservation | null; setEnabled(enabled: boolean): void; refresh(trigger?: 'toggle' | 'refresh' | 'prompt'): void }`.
  - Add `tempWind: TempWindState` to the store value type.
- [X] T004 [P] Write the failing parser and join tests in `backend/src/tempWind.test.ts`. Build hand-made payloads in the 2026-11-19 shape, one per endpoint: `data.stations[] {id, deviceId, name, location:{latitude, longitude}}`, `data.readings[] {timestamp, data:[{stationId, value}]}`, `data.readingType`, `data.readingUnit`. Never copy from `RealtimeWeatherReadingsacrossSingapore/`. Cover:
  - (a) **Join by `id`** across the three responses. A station appears when it "has valid coordinates and is listed by at least one measure that loaded". Coordinates come from whichever list it appears in. Output is "Sorted by `id` for stable rendering".
  - (b) **Station sets differ**: a temperature-only station (S24) has `wind_speed_knots: null` and `wind_direction_deg: null`. A wind-only station (S108) has `temperature_c: null`.
  - (c) **Names**: `name` is "`null` when empty or equal to `id` (S199)".
  - (d) **Coordinates**: latitude "A finite number of at most 90 in absolute value", longitude "at most 180 in absolute value". Invalid coordinates drop the station.
  - (e) **Ranges** (research R5): `temperature_c` "From 10 to 45 °C, rounded to 0.1"; `wind_speed_knots` "From 0 to 150"; `wind_direction_deg` "From 0 to under 360 … (360 becomes 0)". Values outside become `null`. Numeric strings are coerced with `Number()` (`"27.4"` → 27.4), and non-finite values become `null`.
  - (f) **Speed and direction are kept independently**: a station with a speed but no direction keeps `wind_speed_knots` and has `wind_direction_deg: null`, and the reverse case works the same way. The frontend decides what to draw (T020): an arrow needs both, and a speed alone shows in the popup with no arrow (spec edge case).
  - (g) **Station listed with no values** still appears, "with every value `null`".
  - (h) **Timestamps**: `temperature_at` is the temperature reading's provider timestamp. `wind_at` is "The older of the speed and direction timestamps".
  - (i) **Request URLs**: exactly `…/v2/real-time/api/air-temperature`, `…/wind-speed` and `…/wind-direction`, with no query string, each made with `priority: 'high'` (research R1, R6).
  - Use a fake `ProviderRequester` or an injected fetch, as `rain.test.ts` does, with `requestIntervalMs: 0` and `rateLimitRetryDelayMs: 0`. Never touch the network.
- [X] T005 Implement `SingaporeTempWindClient` and the pure helpers (for example `buildTempWindObservation(...)`) in `backend/src/tempWind.ts` so that T004 passes.
  - Export the backend types `TempWindStation` and `IslandConditionsObservation`, mirroring T003.
  - Export `TempWindTiming` (the same fields as `RainTiming`, with `requests` counting the upstream calls).
  - Export `interface TempWindClient { getIslandConditions(now?: Date, timing?: Partial<TempWindTiming>): Promise<IslandConditionsObservation> }`.
  - Export `class SingaporeTempWindClient implements TempWindClient`. Start the three requests together through the injected shared `ProviderRequester`, so they queue back to back.
- [X] T006 Add the partial-failure, cache and stale tests to `backend/src/tempWind.test.ts`, then make them pass in `backend/src/tempWind.ts` (research R2, FR-010, FR-012):
  - **temperature fails, wind loads**: `measures: { temperature: 'unavailable', wind: 'ok' }`, `temperature_at: null`, `temperature_c: null` at every station. It is cached as normal.
  - **either wind request fails, temperature loads**: `measures.wind: 'unavailable'` ("`'unavailable'` when either the `wind-speed` or the `wind-direction` request failed"), `wind_at: null`, and both wind fields `null` at every station.
  - **no mixing ages**: a measure that failed is never filled in from an earlier cached observation.
  - **all three fail with an earlier observation**: return it with `stale: true`.
  - **all three fail with no earlier observation**, or every station has no value at all: throw `WeatherProviderError` (the invariant "at least one measure is `'ok'`"; spec edge case "Every station missing").
  - **cache**: a second call within 120 000 ms makes zero requests; a call at 120 001 ms fetches again; two concurrent calls share one load; a failure is also remembered for 2 minutes; `timing.served` is `cache`, `shared` or `fetch` as appropriate. Match `SingaporeRainClient` exactly.
- [X] T007 [P] Write the failing tests in `backend/src/tempWindFixture.test.ts`, then create `backend/src/tempWindFixture.ts` with `createFixtureTempWindClient()` (research R11). It returns a deterministic `IslandConditionsObservation` of about 17 hand-made stations spread across Singapore, including at least:
  - every wind level, for example 0.5 kn (calm), 5 kn (light), 15 kn (moderate) and 25 kn (strong), and a spread of temperatures such as 25.8–31.2 °C;
  - one wind-only station, one temperature-only station and one with no values;
  - one station with `name: null` (id `S199`);
  - one station whose value is out of range, already reduced to `null`, as the real client would;
  - `measures` both `'ok'`, `temperature_at` and `wind_at` set to the current time minus 6 minutes, and `stale: false`.
- [X] T008 Write the failing route tests in `backend/src/routes/tempWind.test.ts`, following `backend/src/routes/rain.test.ts`: `createApp({ weatherClient: fake, tempWindClient: fake })`, a temporary SQLite database and Supertest. Cover everything listed under "Tests (Principle VI)" in contracts/temp-wind-refresh.md:
  - a 200 response with the contract's shape;
  - a 200 where one measure is unavailable;
  - a 200 with `stale: true`;
  - a `WeatherProviderError` producing **502 `{ "detail": "Temperature and wind data is currently unavailable" }`** with no provider text, URL or key in the body;
  - a `Server-Timing` header on both the 200 and the 502;
  - that `GET /api/temp-wind/refresh` is not routed;
  - no rows written to the locations table;
  - that saved-place routes still work while the fake client throws (FR-014).
- [X] T009 Create `backend/src/routes/tempWind.ts` with `createTempWindRouter({ tempWindClient?, requester? })`, mirroring `createRainRouter`, so that T008 passes.
  - The default client is `new SingaporeTempWindClient({ apiKey: process.env.WEATHER_API_KEY, requester })`.
  - The route is `router.post('/temp-wind/refresh', …)`, with the comment "POST (not GET) because this is an explicit user action, never a page-load read."
  - Send `Server-Timing` through `formatServerTiming` on both 200 and 502.
  - On a provider error, log `logger.warn({ err }, 'temp-wind refresh failed')`. Log the timing once as `temp-wind refresh timing`.
- [X] T010 Wire temperature and wind into `backend/src/server.ts`:
  - add `tempWindClient?: TempWindClient` to `AppOptions`;
  - add `TEMP_WIND_FIXTURE=demo`, copying the `RAIN_FIXTURE` block: use the fixture only when no `tempWindClient` was injected and `NODE_ENV !== 'production'`, and log the warning `TEMP_WIND_FIXTURE=demo: serving fake temperature and wind readings (development only)`;
  - add `!tempWindClient` to the condition that builds the shared `ProviderRequester`, so every client shares one paced stream (research R6);
  - mount `app.use('/api', createTempWindRouter({ tempWindClient, requester }))` beside the rain router;
  - add no per-device limiter, and write a comment saying the 2-minute shared cache already limits provider calls to one per 2 minutes.
- [X] T011 [P] Add `refreshTempWind()` to `frontend/src/api.ts`, mirroring `refreshRain()`: `POST /temp-wind/refresh` through `send()`, returning `{ observation: IslandConditionsObservation, serverTiming: string | null }` and throwing on a non-2xx response.
- [X] T012 Add the temperature and wind state core to `frontend/src/state/store.tsx`, mirroring the rain block (research R12, data-model "TempWindState"):
  - state `tempWindEnabled`, `tempWindStatus` (initially `'idle'`) and `tempWindObservation` (initially `null`). Leave reading the remembered choice to T033 and default to `false` until then;
  - `refreshTempWindData(trigger)`:
    - do nothing while a load is in flight, or while the current observation's `fetched_at` is under 120 000 ms old;
    - otherwise set `'loading'`, call `refreshTempWind()`, store the observation on success and set `'ready'` (including when `stale: true`);
    - on an error set `'unavailable'` and **keep the previous observation** ("Kept on failure (FR-012, FR-013)");
  - `setEnabled(on)`: turning the view on asks for data "unless there is a copy under 2 minutes old";
  - call `logInteraction('temp_wind_refreshed')` and `logInteraction('temp_wind_toggled', { enabled })`;
  - expose `tempWind: { enabled, status, observation, setEnabled, refresh }` in the memoised store value, and add the new values to its dependency array;
  - never call `refreshTempWindData` from a mount effect (constitution I, FR-007).

**Checkpoint**: `npx vitest run backend/src/tempWind.test.ts backend/src/routes/tempWind.test.ts backend/src/tempWindFixture.test.ts` passes. With `TEMP_WIND_FIXTURE=demo`, `curl -X POST <server>/api/temp-wind/refresh` returns the fixture.

---

## Phase 3: User Story 1 - Compare temperatures across the island (Priority: P1) 🎯 MVP

**Goal**: with the view on in full screen, every station with a temperature appears at its position with its value, and selecting a station shows its details.

**Independent Test**: with `TEMP_WIND_FIXTURE=demo` (or a stub), go to full screen and turn the view on. Every fixture station with coordinates appears at its position, its temperature shows to one decimal place, and a popup shows its name, temperature and reading time. Pins, rain and lightning still work (spec US1).

### Tests for User Story 1

- [X] T013 [P] [US1] Write the failing tests in `frontend/src/components/map/tempWindHelpers.test.ts` for:
  - `formatTemperature(c)`: `27.4` gives `"27.4°"`, `27` gives `"27.0°"`, and `null` gives `"–°"`;
  - `stationLabel(station)`: the name, or `"Station S199"` when `name` is `null`;
  - `formatReadingTime(iso)`: SGT `"1:33 pm"`, reusing the SGT approach of `formatRainPeriod`;
  - `tempWindPopup(station, observation)`: plain strings `{ title, temperature, wind, time, source }`. Leave `wind` as a placeholder until T020, with the `source` line `"NEA via data.gov.sg"` (research R9).

### Implementation for User Story 1

- [X] T014 [US1] Implement `formatTemperature`, `stationLabel`, `formatReadingTime` and `tempWindPopup` in `frontend/src/components/map/tempWindHelpers.ts` so that T013 passes.
- [X] T015 [P] [US1] Create `frontend/src/components/map/tempWindMarker.ts` with `tempWindMarkup(kind, temperatureText, rotationDeg)`, starting with the temperature part. The markup carries class names only (`.tw-mark`, `.tw-temp`, `.tw-temp-missing`) and **no colour** (plan structure). Pass any text through `escapeHtml` from `pinMarkup.ts`. Add tests in `frontend/src/components/map/tempWindMarker.test.ts` for the classes and the escaping.
- [X] T016 [US1] Create `frontend/src/components/map/TempWindLayer.tsx`, mirroring `RainLayer.tsx`:
  - Use a react-leaflet `<Pane name="temp-wind">` with **z-index 445**, between rain (440) and lightning (450) and below the markers (600), so pins stay clickable (research R7, FR-016).
  - Draw one `L.marker` per station, with an `L.divIcon` from `tempWindMarkup`.
  - Give each marker a popup from `tempWindPopup`, built with DOM text nodes or escaped. Never inject raw API strings (plan post-design re-check).
  - Take a `showTempWind` prop that **defaults to `false`**. Draw nothing when it is false, when `tempWind.enabled` is false, or when `observation` is null.
  - Rebuild the markers only when the `observation` object changes.
- [X] T017 [US1] Create `frontend/src/components/map/TempWindControl.tsx` with `TempWindSwitch`, mirroring `RainSwitch`: a `role="switch"` button with `aria-label="Temperature & wind"`, `aria-checked={tempWind.enabled}`, an icon (reuse a thermometer or wind icon from `frontend/src/components/icons.tsx`, or add one there) and an On/Off label, using the `map-control` class and the 44 px touch size. Leave the refresh button, status strip and legend to US3–US5.
- [X] T018 [US1] Mount the view on full screen only (research R8):
  - in `frontend/src/components/map/WeatherMap.tsx`, add `<TempWindLayer showTempWind={showTempWind} />` next to `<RainLayer>`, with a new `showTempWind` prop that defaults to `false`;
  - in `frontend/src/components/map/MapFullscreen.tsx`, pass `showTempWind` to `WeatherMap`, and place `<TempWindSwitch />` in the top bar **after the rain controls and before `<LightningButtons/>`**;
  - leave `MapCard.tsx` and `MapLayersControl.tsx` unchanged (FR-001, FR-009, US4 scenario 6).
- [X] T019 [US1] Add the base label styles to `frontend/src/index.css`: `.tw-mark` (a small rounded label with a background, text and border), `.tw-temp` and `.tw-temp-missing` (the muted colour). They read `--tw-label-bg`, `--tw-label-text`, `--tw-label-border` and `--tw-missing`. Put a **temporary** default set of these values in the `:root` block only; T026 replaces them with per-theme values.

**Checkpoint**: US1 works on its own: temperatures at each station on full screen, popups, pins unaffected, card map unchanged.

---

## Phase 4: User Story 2 - Know which way and how hard the wind is blowing (Priority: P1)

**Goal**: each station with wind shows an arrow pointing the way the wind blows, sized by strength level, with "calm" below the threshold and a key explaining the levels.

**Independent Test**: with fixture stations at each level, each arrow points the right way, stronger wind looks stronger, calm shows "calm", and a popup gives "N km/h, light, from SW (228°)" (spec US2, quickstart §2).

### Tests for User Story 2

- [X] T020 [P] [US2] Add failing tests to `frontend/src/components/map/tempWindHelpers.test.ts` for:
  - `windKmh(knots)`: `wind_speed_knots × 1.852`, "Rounded to a whole number for display";
  - `windLevel(kmh)`: "`calm` under 2; `light` from 2 to under 20; `moderate` from 20 to under 39; `strong` from 39 up". Test the boundaries 1.9, 2, 19.9, 20, 38.9 and 39;
  - `arrowRotation(deg)`: "`(deg + 180) mod 360`". A wind from 45° gives 225, and from 270° gives 90;
  - `compassPoint(deg)`: "One of 16 points". 0 gives N, 45 gives NE, 228 gives SW and 359 gives N;
  - `markKind(station)`: `{ wind: 'arrow' | 'calm' | 'missing', temp: 'value' | 'missing' }`, where a speed with no direction gives `wind: 'missing'` for the arrow while the popup still shows the speed (spec edge case);
  - the popup `wind` line: `"15 km/h, light, from SW (228°)"`, `"calm"`, or `"no reading"`;
  - `TEMP_WIND_LEVELS`: the key rows, in order calm, light, moderate and strong, with their ranges.

### Implementation for User Story 2

- [X] T021 [US2] Implement `windKmh`, `windLevel`, `arrowRotation`, `compassPoint`, `markKind`, `TEMP_WIND_LEVELS` and the popup `wind` line in `frontend/src/components/map/tempWindHelpers.ts` so that T020 passes. Reuse the `knotsToKmh` factor the Wind tile uses rather than a new constant, if it is exported.
- [X] T022 [US2] Extend `frontend/src/components/map/tempWindMarker.ts` and its tests with the wind part (research R7):
  - an arrow SVG rotated by `arrowRotation`, with classes `.tw-arrow-light`, `.tw-arrow-moderate` and `.tw-arrow-strong`. The size goes up a step at each level and `strong` also gets a heavier stroke, so the level never relies on colour (FR-017);
  - the text `calm`, with class `.tw-calm`;
  - a **solid crossed-out wind glyph** with class `.tw-wind-missing`, the same size as a light arrow (Gate 1 finding: the dashed ring was hard to spot);
  - `tempWindSizePx(kind)` for the icon anchor;
  - tests for each kind's classes and rotation, and that the markup contains no colour value.
- [X] T023 [US2] In `frontend/src/components/map/TempWindLayer.tsx`, pass the station's `markKind`, temperature text and rotation to `tempWindMarkup`. Give each marker an accessible name such as "Clementi Road, 26.3 degrees, wind light from south-west" (research R7), built in a pure helper `tempWindAccessibleName(station)` in `tempWindHelpers.ts` with a test.
- [X] T024 [US2] Add `TempWindLegend` to `frontend/src/components/map/TempWindControl.tsx`, mirroring `RainLegend`, in a `rounded-card` panel. It shows:
  - one row per level from `TEMP_WIND_LEVELS`, drawn with the real marker markup;
  - a row for "no reading", showing both the crossed-out wind glyph and "–°";
  - the line "Arrows point the way the wind is blowing";
  - the licence notice (T025).
- [X] T025 [US2] Add the licence constants to `frontend/src/components/map/tempWindHelpers.ts`, following rain's pattern (research R9): `TEMP_WIND_LICENCE_NOTICE` = "Contains information from Air Temperature across Singapore, Wind Speed across Singapore and Wind Direction across Singapore (NEA), accessed from data.gov.sg, made available under the Singapore Open Data Licence version 1.0", with the licence name linked through the existing `RAIN_LICENCE_URL` value. Add a test that the notice names all three datasets.
- [X] T026 [US2] Add the per-theme variables `--tw-label-bg`, `--tw-label-text`, `--tw-label-border`, `--tw-arrow` and `--tw-missing` to **all six** `[data-theme]` blocks in `frontend/src/index.css`, remove the temporary `:root` set from T019, and style `.tw-arrow-*`, `.tw-calm` and `.tw-wind-missing`.
  - Measure the contrast of the label text and of the arrow against the label background on each theme, aiming for WCAG AA: 4.5:1 for text and 3:1 for the arrow and glyphs (Principle V). Record the ratios in a comment next to the variables.
  - Don't change how the `apple` theme looks anywhere else.

**Checkpoint**: US1 and US2 work together: temperatures, arrows by level, calm, a key, and legible on all six themes.

---

## Phase 5: User Story 3 - Know how fresh the readings are, and when a station has none (Priority: P1)

**Goal**: missing measures read as "no reading", never as a value or as calm, and a status strip shows when the readings were taken and flags them after 15 minutes.

**Independent Test**: with fixture stations lacking temperature, lacking wind, and lacking both, each is marked correctly, and the strip shows "Temp & wind at 1:33 pm · 7 min ago" (spec US3).

### Tests for User Story 3

- [X] T027 [P] [US3] Add failing tests to `frontend/src/components/map/tempWindHelpers.test.ts` for:
  - `readingTime(observation)`: "The older of the two that aren't null" of `temperature_at` and `wind_at`, or `null` when both are;
  - `isTempWindOutOfDate(observation, now)`: "`true` when `stale`, or when `readingTime` is more than **15 minutes** before now". Test 14:59 (false), 15:01 (true) and `stale: true` at 1 minute (true). Export `TEMP_WIND_OUT_OF_DATE_MS = 15 * 60_000`;
  - `tempWindStatusMessage(state, now)`: `"Temp & wind at 1:33 pm · 7 min ago"`, an out-of-date form, `"Calm across the island"` when every station with wind is calm (spec edge case), and a note when one measure is `'unavailable'`, for example `"Wind unavailable"` (US5 scenario 5);
  - the popup and marker for a station with no values: both measures say "no reading".

### Implementation for User Story 3

- [X] T028 [US3] Implement `readingTime`, `isTempWindOutOfDate`, `TEMP_WIND_OUT_OF_DATE_MS` and `tempWindStatusMessage` in `frontend/src/components/map/tempWindHelpers.ts` so that T027 passes.
- [X] T029 [US3] Add `TempWindStatusStrip` to `frontend/src/components/map/TempWindControl.tsx`, mirroring `RainStatusStrip`. It uses `useNow` so the age keeps ticking, and adds a visible "out of date" label (text, not only colour) when `isTempWindOutOfDate` is true.
- [X] T030 [US3] In `frontend/src/components/map/MapFullscreen.tsx`, stack `{tempWind.enabled && <TempWindStatusStrip />}` **between** the rain strip and the lightning strip (research R8). Update the existing comment to say so.

**Checkpoint**: US1–US3 complete the P1 view: values, arrows, missing states and freshness.

---

## Phase 6: User Story 4 - Turn the view on and off without slowing the app (Priority: P2)

**Goal**: the view is off by default, remembered per device, never fetched on page load, opens its legend once on first use, and fits the full-screen top bar at 375 px.

**Independent Test**: open the app fresh; there is no `/api/temp-wind/refresh` request and the view is off. Turn it on and the stations load. Turn it off and they disappear with nothing else changed. Reload; the view shows as on with the "Show latest temperature & wind" prompt and no request (spec US4, SC-009).

### Tests for User Story 4

- [X] T031 [P] [US4] Add failing tests to `frontend/src/components/map/tempWindHelpers.test.ts` for:
  - `TEMP_WIND_STORAGE_KEY = 'weather-starter.tempWind.enabled'` and `TEMP_WIND_LEGEND_SEEN_KEY = 'weather-starter.tempWind.legendSeen'`;
  - `parseTempWindEnabled(raw)`: `null`, `''` and anything other than `'true'` give `false` (the default is off, FR-007);
  - `serialiseTempWindEnabled(on)`;
  - `parseTempWindLegendSeen(raw)` and `shouldAutoOpenTempWindLegend(legendSeen, status)`, mirroring rain's: the legend opens by itself only the first time readings are `'ready'`;
  - the prompt text `"Show latest temperature & wind"`, distinct from the unavailable message (US4 scenario 4).

### Implementation for User Story 4

- [X] T032 [US4] Implement the storage keys, parsers and `shouldAutoOpenTempWindLegend` in `frontend/src/components/map/tempWindHelpers.ts` so that T031 passes.
- [X] T033 [US4] Wire the remembered choice into `frontend/src/state/store.tsx`. Read `TEMP_WIND_STORAGE_KEY` for the initial `tempWindEnabled`, and write it in `setEnabled`, wrapping both in try/catch as rain does. A remembered "on" must leave the status `'idle'` and make **no request** (FR-007, FR-008).
- [X] T034 [US4] In `frontend/src/components/map/TempWindControl.tsx`:
  - when the view is on and the status is `'idle'`, the strip shows a "Show latest temperature & wind" button that calls `refresh('prompt')`;
  - open `TempWindLegend` by itself once, on the first `'ready'`, and save `TEMP_WIND_LEGEND_SEEN_KEY`. Afterwards it opens from a legend button;
  - turning the view off hides the stations and the legend at once (US4 scenario 3).
- [X] T035 [US4] Make the full-screen top bar in `frontend/src/components/map/MapFullscreen.tsx` **wrap to a second row** at narrow widths, right-aligned under the close button (research R8). Every control keeps its 44 px target, and nothing covers the close button. Rain's and lightning's behaviour doesn't change; only their positions may move at 375 px.

**Checkpoint**: the view is safe to leave on: no fetch on load, the remembered state works, and the top bar fits at 375 px.

---

## Phase 7: User Story 5 - Refresh the readings and cope with failure (Priority: P2)

**Goal**: the user can ask for fresh readings. Failure shows "unavailable", keeps earlier readings with their age, and never affects saved places, rain or lightning.

**Independent Test**: with readings loaded, refresh. The previous readings stay on screen while loading, and the time advances. Stub a 502: the "unavailable" notice appears, the earlier readings stay marked out of date, and saved places, rain and lightning still work (spec US5).

### Tests for User Story 5

- [X] T036 [P] [US5] Add failing tests to `frontend/src/components/map/tempWindHelpers.test.ts` for `tempWindStatusMessage` covering:
  - `'loading'` with an earlier observation ("Updating…", while the earlier time stays visible);
  - `'unavailable'` with an earlier observation (an unavailable notice plus the earlier time, out of date);
  - `'unavailable'` with none: "Temperature and wind data is unavailable";
  - a `stale: true` observation, shown as out of date.

### Implementation for User Story 5

- [X] T037 [US5] Implement the loading and failure branches of `tempWindStatusMessage` in `frontend/src/components/map/tempWindHelpers.ts` so that T036 passes.
- [X] T038 [US5] Add `TempWindRefreshButton` to `frontend/src/components/map/TempWindControl.tsx`, mirroring `RainRefreshButton`. It calls `tempWind.refresh('refresh')` and is disabled while loading, with an accessible busy state. Place it before `<TempWindSwitch />` in the top bar of `frontend/src/components/map/MapFullscreen.tsx`, as rain's is. Show it only when the view is on.
- [X] T039 [US5] Confirm in `frontend/src/state/store.tsx` that a temperature and wind failure touches only the `tempWind` slice: no shared error banner, and no change to the location, rain or lightning state (FR-014). Add a short comment saying so.

**Checkpoint**: all five stories work.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T040 Create `scripts/e2e/temp-wind.sh` (source `scripts/e2e/lib.sh`), mirroring `scripts/e2e/rain-view.sh`:
  - start its own server on a free port with a throwaway database, and tear everything down from an `EXIT` trap, including every browser session (CLAUDE.md browser checks);
  - stub `POST /api/temp-wind/refresh` (fixture-shaped body, plus a 502 case) and `GET /api/locations` with `agent-browser network route`. Never call data.gov.sg;
  - start on `about:blank`, clear errors and console, navigate, and call `assert_clean` after every open, reload and view switch;
  - **US1–US3**: on full screen, assert one `.tw-mark` per stubbed station, the right arrow, calm and missing classes, a popup with the name and the "from SW (228°)" text, and the strip's time;
  - **US4**: assert no `/api/temp-wind/refresh` request before acting (SC-009), the prompt after a reload, and that the card map has **no** `.tw-mark` and no Temperature & wind switch in its Layers menu;
  - **US5**: assert the unavailable notice with the earlier marks kept;
  - **375 px and 1280 px on every theme, with all three layers on**: the top bar wraps, no control overlaps the close button (measure the bounding boxes), and the pins are still clickable (SC-007, SC-010).
- [X] T041 [P] Update the docs (plan "Documentation to update"):
  - `docs/theming.md`: the `--tw-*` variables, the mark rules and the contrast ratios;
  - `docs/testing.md`: `scripts/e2e/temp-wind.sh`;
  - `docs/src/content/docs/backend/api.md`: `POST /api/temp-wind/refresh`;
  - a new `docs/src/content/docs/backend/temp-wind.md` (how the client fetches, joins, caches and fails), modelled on the rain page;
  - `docs/src/content/docs/frontend/map.md`: the full-screen-only view, the pane order and the top-bar wrap;
  - `docs/src/content/docs/configuration.md`: `TEMP_WIND_FIXTURE`.
- [X] T042 Run `npm run verify` and fix anything it reports. It stops at the first failure: ESLint, `tsc --noEmit`, vitest, then the build.
- [X] T043 Run `scripts/e2e/temp-wind.sh` after T042 passes, and also re-run `scripts/e2e/rain-view.sh` and `scripts/e2e/lightning-markers.sh` to confirm rain and lightning didn't regress. Afterwards, check that no process from the checks still holds a port.
- [X] T044 Run the live check once with the owner's key (quickstart §4): `requests 3` in `Server-Timing`, data in under 5 s (SC-005), `served cache` within 2 minutes (SC-008), and the strip age under 15 minutes. Unset `TURSO_*` first so the run doesn't touch the production database. Ask the owner before spending live calls.
- [X] T045 Run the 5 overlapping shared-budget runs (quickstart §5) and write the results under a "Results" heading in `specs/015-temperature-wind-layer/quickstart.md`: saved-place refresh 10–15 s, temperature and wind under 5 s, and 0 responses with status 429 (SC-006).
- [X] T046 Run `/weather-code-review` on the change before committing (project memory: reviews stay manual). Commit only when the owner asks.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Phase 1. It **blocks every story**. Inside it:
  - T002 lands before or with T009;
  - T004 → T005 → T006;
  - T008 → T009 → T010;
  - T007 before T010;
  - T003 before T011 and T012.
- **US1 (Phase 3)**: depends on Phase 2.
- **US2 (Phase 4)**: depends on US1's T015 and T016, because it extends the same marker and layer.
- **US3 (Phase 5)**: depends on US1. It can run alongside US2 except that both edit `tempWindHelpers.ts`, so do them one after the other.
- **US4 (Phase 6)**: depends on US1's T017 and T018 and on Phase 2's T012.
- **US5 (Phase 7)**: depends on US3's T029.
- **Polish (Phase 8)**: depends on every story. T042 must pass before T043–T046.

### User story completion order

US1 → US2 → US3 (the P1 view), then US4 → US5. The MVP worth shipping is US1–US3 together, because temperatures without honest missing and freshness states would break FR-005 and FR-006.

### Within each story

The test task comes first and must fail. Then the pure helpers, then the markup, then the components, then the wiring.

## Parallel Opportunities

- **Phase 2**: T003, T004 and T007 touch different files and can start together. T011 can run alongside the backend chain once T003 is done.
- **US1**: T013 (helper tests) and T015 (marker) are separate files.
- **US2**: T020 runs alongside T022's marker tests.
- **Every story**: the `[P]` test task can be written while the previous story's components are finished.
- **Polish**: T041 (docs) runs alongside T040 (e2e).

### Parallel example: Phase 2

```bash
Task: "T003 Add TempWindStation, IslandConditionsObservation, TempWindStatus, TempWindState to frontend/src/types.ts"
Task: "T004 Write failing parser/join tests in backend/src/tempWind.test.ts"
Task: "T007 Write tempWindFixture tests, then backend/src/tempWindFixture.ts"
```

### Parallel example: User Story 1

```bash
Task: "T013 Failing tests for formatTemperature, stationLabel, formatReadingTime, tempWindPopup in tempWindHelpers.test.ts"
Task: "T015 tempWindMarker.ts temperature markup + tempWindMarker.test.ts"
```

## Implementation Strategy

### MVP first (US1–US3)

1. Phase 1, then Phase 2 (including the constitution amendment).
2. US1: temperatures on full screen.
3. US2: arrows, calm, the key and the themes.
4. US3: missing states and freshness.
5. **Stop and check**: run `npm run verify`, then the US1–US3 parts of `scripts/e2e/temp-wind.sh`.

### Incremental delivery

6. US4: the remembered state, no fetch on load, and the top-bar wrap at 375 px.
7. US5: refresh and failure handling.
8. Polish: the full e2e run, docs, the live check, the shared-budget runs and the review.

### Notes

- `[P]` means a different file and no dependency on an unfinished task.
- Never bypass the pre-commit hook with `--no-verify`.
- Don't commit `RealtimeWeatherReadingsacrossSingapore/` or `e2e-artifacts/`.
- `.env` holds the production Turso credentials. Unset `TURSO_*` for any local run that touches the database.
