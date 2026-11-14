---

description: "Task list for the WBGT Heat-Stress Tile"
---

# Tasks: WBGT Heat-Stress Tile

**Input**: Design documents from `/specs/005-wbgt-heat-stress-tile/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/ui.md, quickstart.md

**Tests**: Included. Constitution Principles IV and VI require backend tests that use a fake provider, and frontend tests for pure modules. quickstart.md §1 lists the test files.

**Organization**: tasks are grouped by user story. Both stories are P1 and are built separately, but they ship together, because US1 adds a provider call that US2 makes safe under the rate limit.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 = heat-stress tile, US2 = shared request pacing

---

## Phase 1: Setup

- [X] T001 Run `npm run lint`, `npm test` and `npm run build -w frontend` from the repo root. Record that all three pass before any change. No files are edited.

---

## Phase 2: Foundational

No blocking prerequisites beyond the existing code: both stories extend existing modules. Proceed to Phase 3.

---

## Phase 3: User Story 1 - See the official heat-stress level for my location (Priority: P1) 🎯 MVP

**Goal**: each refreshed location stores the nearest WBGT station's reading, and a "Heat Stress" tile shows the value, level, station, distance, time and guidance. The tile shows "No nearby station" beyond 10 km and "No reading" when data is missing.

**Independent Test**: refresh a location at Bishan (1.3548, 103.8522). The tile should show "Bishan Street", about 0.0 km, and the value, level and time that `weather?api=wbgt` reports (quickstart §3). A location saved before the change should show "No reading" (quickstart §2).

### Tests for User Story 1 (write first, confirm they fail)

- [X] T002 [P] [US1] Create `frontend/src/components/heatStress.test.ts` covering `heatStressView(weather)`, following the style of `feelsLike.test.ts`:
  - It returns `{ kind: 'no-reading' }` when `wbgt_c` is null, NaN or non-finite, or when `wbgt_station_distance_km` is null. This check comes before the distance check.
  - It returns `no-nearby-station`, with a tooltip of exactly `Nearest station: {name}, {distance} km away` (distance to 1 dp), when the distance is 10.1. A distance of exactly 10.0 returns `reading`.
  - `reading` exposes `value` (1 dp string), `level`, `tone`, `guidance`, `stationName`, `distanceKm` (1 dp string) and `observedAt` (SGT `HH:mm`).
  - Levels `Low`, `moderate ` (mixed case and spaces) and `HIGH` map to tone `low`, `moderate` and `high`. `Extreme` maps to tone `unknown`, keeps the level text `Extreme`, and has guidance `null`.
  - Guidance is `null` for Low. For Moderate and High it equals `HEAT_STRESS_GUIDANCE.moderate` and `HEAT_STRESS_GUIDANCE.high`.
  - `WBGT_MAX_STATION_KM === 10`.
- [X] T003 [P] [US1] Extend `backend/src/weather.test.ts`:
  - In `payloadFor`, add a branch for path `/v2/real-time/api/weather` that returns `{ code: 0, data: { records: [{ datetime: '2026-11-01T10:05:00+08:00', updatedTimestamp: '2026-11-01T10:10:00+08:00', item: { type: 'observation', isStationData: true, readings: [...] } }] } }`. The readings are:
    - a near station: `{ station: { id: 'S128', name: 'Bishan Street', townCenter: 'Bishan Stadium' }, location: { latitude: '1.354825', longitude: '103.852219' }, wbgt: '29.3', heatStress: 'Low' }`
    - a far station: `{ station: { id: 'S139', name: 'Tuas Terminal Gateway', townCenter: 'Tuas Terminal Gateway' }, location: { latitude: '1.263757', longitude: '103.616417' }, wbgt: '31.5', heatStress: 'Moderate' }`
    - a nearer station with `wbgt: 'n/a'`, which must be ignored.
  - Add tests asserting:
    - (a) A refresh near Bishan sets `wbgt_c: 29.3`, `heat_stress_level: 'Low'`, `wbgt_station_name: 'Bishan Street'`, `wbgt_observed_at: '2026-11-01T10:05:00+08:00'`, and a `wbgt_station_distance_km` below 1.
    - (b) A location at (1.30, 103.62) picks Tuas, with the distance in km matching haversine within 0.1. This shows km distance is used, not squared degrees.
    - (c) When the readings array is empty, all five WBGT fields are null.
    - (d) When `failedPath` is `/v2/real-time/api/weather`, the other readings are still present and the five WBGT fields are null.
  - Construct `new SingaporeWeatherClient({ requestIntervalMs: 0, rateLimitRetryDelayMs: 0 })` in this file once T015 lands. Until then the default constructor is fine.
- [X] T004 [P] [US1] In `backend/src/routes/locations.test.ts`, extend the fake `weatherClient` snapshot with `wbgt_c: 28.1`, `heat_stress_level: 'Moderate'`, `wbgt_station_name: 'Bishan Street'`, `wbgt_station_distance_km: 0.4` and `wbgt_observed_at: '2026-11-01T10:05:00+08:00'`. Assert two things:
  - `POST /api/locations/:id/refresh` and then `GET /api/locations` return these five fields unchanged.
  - A newly created location whose refresh fails returns all five as `null`.

### Implementation for User Story 1

- [X] T005 [US1] In `backend/src/schema.ts`:
  - Add five nullable fields to `WeatherSnapshot`: `wbgt_c: number | null`, `heat_stress_level: string | null`, `wbgt_station_name: string | null`, `wbgt_station_distance_km: number | null`, `wbgt_observed_at: string | null`.
  - Add five nullable columns to `locations`, after `airQualityObservedAt`: `wbgtC: real('wbgt_c')`, `heatStressLevel: text('heat_stress_level')`, `wbgtStationName: text('wbgt_station_name')`, `wbgtStationDistanceKm: real('wbgt_station_distance_km')`, `wbgtObservedAt: text('wbgt_observed_at')`. Do not add `.notNull()` or a default.
- [X] T006 [US1] Run `npm run db:generate` from the repo root. Check that the new `backend/drizzle/0002_*.sql` contains only five `ALTER TABLE \`locations\` ADD \`…\`` statements for the columns in T005, and that `backend/drizzle/meta/` was updated. Commit the generated files unedited.
- [X] T007 [US1] In `backend/src/db.ts`:
  - Add the five fields as `null` to `defaultWeather`.
  - Map them in `weatherToColumns`: `wbgtC: weather.wbgt_c`, `heatStressLevel: weather.heat_stress_level`, `wbgtStationName: weather.wbgt_station_name`, `wbgtStationDistanceKm: weather.wbgt_station_distance_km`, `wbgtObservedAt: weather.wbgt_observed_at`.
  - Map them back in the row → `WeatherSnapshot` conversion, keeping null for rows saved before this feature (FR-015).
- [X] T008 [US1] In `backend/src/weather.ts`, add `wbgt_c`, `heat_stress_level`, `wbgt_station_name`, `wbgt_station_distance_km` and `wbgt_observed_at` to the backend `WeatherSnapshot` interface. Set all five to `null` in both literals returned by `snapshotFromPayload()` and in `emptyForecastSnapshot()`.
- [X] T009 [US1] In `backend/src/weather.ts`:
  - Add a module-level `distanceKm(lat1, lon1, lat2, lon2)` haversine helper, using Earth radius 6371 km.
  - Add a `WbgtPayload` interface matching research R1.
  - Add `const EMPTY_WBGT = { value: null, level: null, stationName: null, distanceKm: null, timestamp: null }`.
  - Add `async fetchWbgt(latitude, longitude)`. It GETs `${this.apiBaseUrl()}/v2/real-time/api/weather?api=wbgt` through `this.fetchJson` and throws `WeatherProviderError` when `code` is defined and not 0, like `fetchUvIndex`. It takes `data.records[0].item.readings` and keeps readings whose `Number(wbgt)` is finite and whose latitude and longitude coerce to numbers. It picks the minimum `distanceKm`, and returns `{ value, level: heatStress?.trim() || null, stationName: station?.name ?? null, distanceKm, timestamp: record.datetime ?? record.updatedTimestamp ?? null }`, or `EMPTY_WBGT` when no reading qualifies.
  - Do not change the existing `nearestStation()`.
- [X] T010 [US1] In `getCurrentWeather` in `backend/src/weather.ts`:
  - Add `this.fetchOptional('wbgt', () => this.fetchWbgt(latitude, longitude), EMPTY_WBGT)` as the last entry in the `Promise.all` array, and destructure it as `wbgt`.
  - Add `wbgt.timestamp` to the `latestTimestamp([...])` list.
  - Assign `snapshot.wbgt_c = wbgt.value`, `snapshot.heat_stress_level = wbgt.level`, `snapshot.wbgt_station_name = wbgt.stationName`, `snapshot.wbgt_station_distance_km = wbgt.distanceKm` and `snapshot.wbgt_observed_at = wbgt.timestamp`.
  - T003 should now pass.
- [X] T011 [P] [US1] In `frontend/src/types.ts`, add the same five nullable fields to `WeatherSnapshot`, after `air_quality_observed_at`.
- [X] T012 [US1] Create `frontend/src/components/heatStress.ts`, a pure module with no React import:
  - Export `WBGT_MAX_STATION_KM = 10`.
  - Export `HEAT_STRESS_GUIDANCE = { moderate: 'Reduce prolonged or strenuous outdoor activity. Take regular breaks in the shade and drink water often.', high: 'Minimise outdoor activity and stay in the shade where possible. Drink water often and watch for signs of heat illness.' }`.
  - Export a `HeatStressView` union with kinds `'no-reading' | 'no-nearby-station' | 'reading'`, as in data-model.md.
  - Export `heatStressView(weather: WeatherSnapshot): HeatStressView`, with the check order: no-reading first, then `distance > WBGT_MAX_STATION_KM` gives no-nearby-station.
  - Format `observedAt` as SGT `HH:mm`, reusing `formatSgtTime` from `./sunTimes` if its signature fits, or `Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false })`.
  - T002 should now pass.
- [X] T013 [US1] In `frontend/src/components/Tiles.tsx`, add `export function HeatStressTile({ weather }: WeatherProps)` following contracts/ui.md:
  - Wrap it in `<TileShell icon={<ThermometerIcon />} title="Heat Stress">`.
  - `reading`:
    - The large value `{value}°`.
    - The level label: `tone` low gives plain `text-white/80`. Moderate gives `rounded-full bg-white/10 px-2 font-semibold`. High gives `rounded-full bg-white/20 px-2 font-bold ring-1 ring-white/40`. Unknown gives plain.
    - `<ScaleBar value={wbgt_c - 25} max={10} gradientClass="bg-gradient-to-r from-emerald-400 via-yellow-300 via-orange-400 to-red-500" />`, so the bar spans 25 to 35 °C.
    - The guidance in `text-xs text-white/70`, only when it is not null.
    - The footer `{stationName} · {distanceKm} km · {observedAt}` in `text-[11px] text-white/50` with `flex-wrap`.
  - `no-nearby-station`: "No nearby station" with `title={tooltip}`.
  - `no-reading`: "No reading", styled like the Feels Like tile's no-reading state.
  - Use only `white/*` classes and no literal colours (Principle V).
  - Render `<HeatStressTile weather={weather} />` in `TileGrid` directly after the Feels Like tile.
- [X] T014 [US1] Run `npx vitest run frontend/src/components/heatStress.test.ts backend/src/weather.test.ts backend/src/routes/locations.test.ts` and `npm run build -w frontend`, and make sure all pass.

**Checkpoint**: the Heat Stress tile works end to end. Don't ship it without Phase 4, because the extra call raises the chance of hitting the rate limit.

---

## Phase 4: User Story 2 - Refreshes stay reliable with the extra call (Priority: P1)

**Goal**: all provider calls from the weather and lightning clients go through one queue, spaced to fit the key's limit. A rate-limited call is retried once after 10 s, and a refresh finishes within 15 s.

**Independent Test**: start a refresh, then immediately turn the lightning layer on. Repeat 5 times. The log should show no `rate limit reached (HTTP 429)`, and a refresh should take about 10 to 11 s and never more than 15 s (quickstart §4 and §5).

### Tests for User Story 2 (write first, confirm they fail)

- [X] T015 [P] [US2] Create `backend/src/providerHttp.test.ts`. Use `vi.useFakeTimers()` and a `fetchImpl` stub that records `Date.now()` at each call, and test the following:
  - (a) `new ProviderRequester({ apiKey: 'k' })` spaces three `getJson` calls at least 884 ms apart.
  - (b) `new ProviderRequester({})` with no key spaces them at least 1717 ms apart.
  - (c) With `WEATHER_API_RATE_LIMIT='30'` set through `vi.stubEnv`, a keyed requester spaces at `ceil(10000/30)+50 = 384` ms.
  - (d) `requestIntervalMs: 0` sends calls back to back.
  - (e) A 429 followed by a 200 calls fetch twice, and the second call starts at least 10000 ms after the first.
  - (f) Two 429s throw a `WeatherProviderError` whose message is `'Weather provider rate limit reached (HTTP 429)'`.
  - (g) One requester shared by a `SingaporeWeatherClient` and a `SingaporeLightningClient`, both constructed with `{ requester }`, keeps every pair of consecutive request starts at least `requestIntervalMs` apart when both clients run at once.
  - Restore real timers and env in `afterEach`.
- [X] T016 [P] [US2] Extend `backend/src/routes/lightning.test.ts` (route tests live in `backend/src/routes/`), following the `locations.test.ts` pattern. Add a test that `createApp()` with no injected clients constructs `ProviderRequester` exactly once:
  - Use `vi.mock('../providerHttp.js', …)` to wrap the real class and count constructions.
  - Stub `fetch` so no network call is made.

### Implementation for User Story 2

- [X] T017 [US2] In `backend/src/providerHttp.ts`:
  - Add the optional fields `requestIntervalMs?: number` and `rateLimitRetryDelayMs?: number` to `ProviderRequesterOptions`.
  - Replace the constants with:
    - `export function defaultRequestIntervalMs(apiKey?: string): number`. It reads `limit` as `Number(process.env.WEATHER_API_RATE_LIMIT)` when that is a finite number above 0, otherwise `apiKey ? 12 : 6`, and returns `Math.ceil(10000 / limit) + 50`.
    - `RATE_LIMIT_RETRY_DELAY_MS = 10000`.
  - Resolve the interval once in the constructor: `this.intervalMs = options.requestIntervalMs ?? defaultRequestIntervalMs(options.apiKey)`. Use it in `waitForRequestSlot`.
  - Use `options.rateLimitRetryDelayMs ?? RATE_LIMIT_RETRY_DELAY_MS` for the wait after a 429.
  - Update the class doc comment, which currently says 250 ms.
- [X] T018 [US2] In `backend/src/weather.ts`, add `requester?: ProviderRequester`, `requestIntervalMs?: number` and `rateLimitRetryDelayMs?: number` to the `SingaporeWeatherClient` constructor options. Set `this.requester = options.requester ?? new ProviderRequester(options)`.
- [X] T019 [US2] In `backend/src/lightning.ts`, add `requester?: ProviderRequester`, `requestIntervalMs?: number` and `rateLimitRetryDelayMs?: number` to `SingaporeLightningClientOptions`. Set `this.requester = options.requester ?? new ProviderRequester(options)`.
- [X] T020 [US2] In `backend/src/routes/locations.ts`, add `requester?: ProviderRequester` to `LocationsRouterOptions`, and construct the default client as `new SingaporeWeatherClient({ apiKey: process.env.WEATHER_API_KEY, requester: options.requester })`. Do the same in `backend/src/routes/lightning.ts` for `LightningRouterOptions` and `SingaporeLightningClient`.
- [X] T021 [US2] In `backend/src/server.ts`:
  - Import `ProviderRequester`.
  - In `createApp`, when `!options.weatherClient || !lightningClient`, create one `new ProviderRequester({ apiKey: process.env.WEATHER_API_KEY })`. Pass it as `requester` to both `createLocationsRouter` and `createLightningRouter`.
  - Keep the `LIGHTNING_FIXTURE` branch unchanged.
- [X] T022 [US2] Update the existing client tests to stay fast under the new defaults:
  - In `backend/src/weather.test.ts`, construct every `new SingaporeWeatherClient(...)` with `{ requestIntervalMs: 0, rateLimitRetryDelayMs: 0 }`. This includes the existing 429 test, which uses `rateLimitedPath`.
  - In `backend/src/lightning.test.ts`, add the same two options to every `new SingaporeLightningClient({ fetchImpl, ... })`.
  - Run `npm test` and check that the total run time has not grown noticeably compared with T001.
- [X] T023 [US2] Check that `frontend/src/components/Hero.tsx` already shows a refreshing indicator while `isRefreshing` is true, and that the store keeps the old `weather` until the refresh response arrives (FR-013, research R7). If the indicator is only a subtle spinner, add visible text "Refreshing…" next to it using `text-white/60`. Change nothing else.

**Checkpoint**: both stories are complete, and the feature can be released.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T024 [P] Update `docs/architecture.md`:
  - In the snapshot paragraph, mention the WBGT reading (nearest station by km, five fields) and change "11 calls per refresh" to 12.
  - In the lightning paragraph, replace "250 ms spacing, 429 retry" with: one `ProviderRequester` shared by both clients, spacing of `ceil(10000/limit)+50` ms (884 ms with a key, 1717 ms keyless, overridable with `WEATHER_API_RATE_LIMIT`), and a 10 s wait before the single 429 retry.
  - In the frontend paragraph, add the Heat Stress tile (`components/heatStress.ts`, with the 10 km cut-off applied in the frontend).
- [X] T025 [P] Add `WEATHER_API_RATE_LIMIT` to `README.md` as an optional setting (requests per 10 s; set it to 30 for a Production key), next to `WEATHER_API_KEY`, if README documents environment variables. Otherwise skip this task.
- [X] T026 Run `npm run lint`, `npm test` and `npm run build -w frontend`. All must pass (Principle VI).
- [ ] T027 (partly done 2026-11-14: §3 Bishan matched live feed, 28.0 °C Low; §4 refresh 9.8–10.9 s; §5 5 overlapping runs, zero 429s. Still open: §2 on a pre-005 DB (no local weather.db existed), §6 NEA wording check, §7 themes at 375 px.) Run quickstart.md §2–§7 against `npm run dev`. That covers the migration on an existing DB, the live Bishan reading, refresh timing, the lightning overlap with 5 repeats, the NEA guidance wording check, and all themes at 375 px. Record any wording change from §6 in `frontend/src/components/heatStress.ts` and in `specs/005-wbgt-heat-stress-tile/research.md` R3.

---

## Dependencies & Execution Order

- **Setup (T001)** comes first.
- **US1 (T002–T014)** and **US2 (T015–T023)** are independent and can be built in either order or in parallel. Within US1 there are file conflicts:
  - `weather.ts` is touched by T008, T009 and T010 (US1) and by T018 (US2).
  - `weather.test.ts` is touched by T003 and T022.
  - Serialise these per file.
- Within US1: T005 → T006 → T007; T008 → T009 → T010; T011 → T012 → T013. Tests T002, T003 and T004 come before their implementation.
- Within US2: T017 → T018 and T019 → T020 → T021 → T022; T015 and T016 come before T017.
- **Polish (T024–T027)** comes after both stories.

## Parallel Opportunities

- US1 tests: T002 (frontend), T003 and T004 (backend). These are different files.
- T011 (frontend types) can run alongside T005–T010 (backend).
- US2 tests: T015 and T016 run alongside the US1 implementation.
- T024 and T025 (docs).

```text
# Example: two developers
Dev A: T002 → T011 → T012 → T013            (frontend US1)
Dev B: T003, T004 → T005–T010               (backend US1)
then:  T015, T016 → T017–T022 → T023        (US2)
```

## Implementation Strategy

- **MVP** is US1, the Heat Stress tile, and is demoable locally. Do not ship it without US2: the 12th call at the old 250 ms spacing makes HTTP 429 more likely (decision.md success metric).
- **Release** is US1 plus US2, then Polish. Validate with quickstart.md before merging.
- **Next feature** after this: the hourly UV trend (006), through `/speckit-specify`.
