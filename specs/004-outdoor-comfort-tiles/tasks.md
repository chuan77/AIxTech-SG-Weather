---

description: "Task list for Outdoor Comfort Tiles (step 1 of nea-data-new-features)"
---

# Tasks: Outdoor Comfort Tiles

**Input**: Design documents from `/specs/004-outdoor-comfort-tiles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/location-weather.md, quickstart.md

**Tests**: Included. Constitution Principle IV requires vitest tests for backend logic and for frontend logic extracted into pure `.ts` modules, and quickstart.md lists the expected coverage. Write each story's tests first and confirm they fail before implementing.

**Organization**: Tasks are grouped by user story so each can be built, tested and shown on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Web app in npm workspaces: `backend/src/`, `frontend/src/`. Run all commands from the repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a green baseline before any change.

- [X] T001 Run `npm test` and `npm run build -w frontend` from the repo root and record that both pass before changes (no files edited)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Give the tile grid access to the selected location, which US2 (coordinates) needs and US1/US3 will render into.

- [X] T002 Change `TileGrid` in `frontend/src/components/Tiles.tsx` to accept `{ location: Location }` (import `Location` from `../types`) and read `weather` from `location.weather`; keep every existing tile rendering exactly as today
- [X] T003 Update the call in `frontend/src/components/Hero.tsx` from `<TileGrid weather={selected.weather} />` to `<TileGrid location={selected} />`

**Checkpoint**: `npm run build -w frontend` passes and the dashboard looks unchanged.

---

## Phase 3: User Story 1 - See how hot it feels and what to wear (Priority: P1) 🎯 MVP

**Goal**: A "Feels like" tile with the Steadman value (one decimal), band label, clothing advice, an umbrella note, an "approx." marker, and a "No reading" state.

**Independent Test**: Select a refreshed location with known temperature, humidity and wind, and check the value, label and advice against the FR-003 table. `feelsLike.test.ts` passes.

### Tests for User Story 1

- [X] T004 [P] [US1] Write failing tests in `frontend/src/components/feelsLike.test.ts`. Cover:
  - `apparentTemperature(30, 70, 2)` against a hand-computed value from `AT = Ta + 0.33e − 0.70ws − 4.00`, `e = rh/100 × 6.105 × exp(17.27·Ta/(237.7+Ta))`, to 2 decimals.
  - `roundHalfUp1(26.95) === 27.0`, plus 26.94 → 26.9 and 31.95 → 32.0.
  - Banding at 23.9, 24.0, 26.9, 27.0, 31.9, 32.0, 36.9 and 37.0 (inclusive lower bounds: `< 24.0` chilly, `< 27.0` breezy-cool, `< 32.0` warm, `< 37.0` hot-muggy, else scorching).
  - `feelsLike()` returns `{ kind: 'no-reading', missing: ['temperature'] }`, `['humidity']` and `['temperature','humidity']` for null or non-finite inputs.
  - Null wind gives `approx: true` and is computed with 0 m/s.
  - Knots are converted with `× 0.514444`.
  - Umbrella is true for conditions "Light Rain", "Passing Showers", "Thundery Showers" and "Heavy Thundery Showers with Gusty Winds".
  - Umbrella is false for "Fair", "Partly Cloudy", "Cloudy", "Hazy" and "Not refreshed".
  - Umbrella is true when `rainfall_mm` is 0.2 and false when it is 0.1.
  - Umbrella is true when `rainfall_mm` is null and the condition is "Showers".
  - No band label or advice contains "Heat Stress" (case-insensitive).

### Implementation for User Story 1

- [X] T005 [US1] Create pure module `frontend/src/components/feelsLike.ts` exporting `apparentTemperature(tempC, humidityPct, windMs)`, `roundHalfUp1(x)` (implement as `Math.round(x * 10) / 10`, research R3 as corrected), `knotsToMs(k)` (`k × 0.514444`), `BANDS` (ids `chilly | breezy-cool | warm | hot-muggy | scorching`, labels and advice text copied verbatim from the spec FR-003 table), `bandFor(value)`, `needsUmbrella(condition, rainfallMm)` (`/rain|shower|thunder/i` on condition, or `rainfallMm > 0.1`; null rainfall is false), and `feelsLike(weather)`. `feelsLike(weather)` returns `{ kind: 'value', value, band, approx, umbrella } | { kind: 'no-reading', missing }` per data-model.md §2. Make T004 pass.
- [X] T006 [US1] Add `FeelsLikeTile` to `frontend/src/components/Tiles.tsx`, using `TileShell` with the thermometer icon, title "Feels like" and `className="col-span-2"`.
  - **Value state**: show the value as `NN.N°`, followed by " approx." when `approx`. Below it show the band label and the advice, with " Carry an umbrella." appended when `umbrella`.
  - **No-reading state**: show "No reading", with a `title` tooltip such as "Needs temperature and humidity" built from `missing`.
  - Use only theme classes (`text-white/…`), no literal colours (Principle V).
- [X] T007 [US1] Render `FeelsLikeTile` in `TileGrid` in `frontend/src/components/Tiles.tsx` as the last tile of the third row. The order is Condition, Air quality, Wind (span 2) / UV, Temperature, Rainfall, Humidity / Forecast high, then a placeholder slot for Sun (added in US2), then Feels like (span 2). Until US2 lands, Feels like follows Forecast high directly.

**Checkpoint**: `npx vitest run frontend/src/components/feelsLike.test.ts` passes; the tile shows correctly for refreshed and unrefreshed locations.

---

## Phase 4: User Story 2 - See today's sunrise and sunset (Priority: P2)

**Goal**: A Sun tile with today's sunrise and sunset in Singapore time, shown for every location, rolling over at midnight SGT.

**Independent Test**: Select any location (refreshed or not) and compare with a published Singapore sunrise/sunset table for today; `sunTimes.test.ts` passes.

### Tests for User Story 2

- [X] T008 [P] [US2] Write failing tests in `frontend/src/components/sunTimes.test.ts`:
  - For latitude 1.3521, longitude 103.8198, `sunTimes(lat, lon, 'YYYY-MM-DD')` returns sunrise and sunset within 2 minutes of the reference for at least three dates spread across the year (e.g. 2026-03-20, 2026-06-21, 2026-11-13). Take the references from a published Singapore sunrise/sunset table and record the source URL in a test comment.
  - `singaporeDate(new Date('2026-11-13T16:30:00Z'))` returns `'2026-11-14'`, i.e. the SGT date, not the UTC date.
  - `formatSgtTime` returns `HH:MM` in `Asia/Singapore`.

### Implementation for User Story 2

- [X] T009 [US2] Create pure module `frontend/src/components/sunTimes.ts` (research R5), exporting:
  - `singaporeDate(now: Date): string`, built with `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' })`.
  - `sunTimes(lat, lon, isoDate): { sunrise: Date, sunset: Date }`, using the NOAA approximation (day of year → fractional year → equation of time and solar declination → hour angle at zenith 90.833° → UTC minutes).
  - `formatSgtTime(d: Date): string`, giving `HH:MM` with `hour12: false` and `timeZone: 'Asia/Singapore'`.

  Make T008 pass. If any reference date misses by more than 2 minutes, replace the calculation with the `suncalc` package and record the change in `specs/004-outdoor-comfort-tiles/research.md` R5.
- [X] T010 [US2] Add `SunTile` to `frontend/src/components/Tiles.tsx`, taking `{ latitude, longitude }`. Inside it:
  - Call `useNow(60_000)` from `./map/useNow`.
  - Derive `singaporeDate(new Date(now))`.
  - Memoise `sunTimes` on (lat, lon, date).
  - Render "Sunrise HH:MM" and "Sunset HH:MM" with the sun icon and title "Sun".

  It needs no weather data, so it renders for unrefreshed locations (FR-009, FR-010).
- [X] T011 [US2] Render `SunTile` in `TileGrid` in `frontend/src/components/Tiles.tsx`, between Forecast high and Feels like, using `location.latitude` and `location.longitude`.

**Checkpoint**: `npx vitest run frontend/src/components/sunTimes.test.ts` passes; the Sun tile shows for every location.

---

## Phase 5: User Story 3 - See what is behind the air-quality number (Priority: P3)

**Goal**: The air-quality tile expands to show PM10, O3, NO2, SO2 and CO for the location's region, each with its unit and the reading time. The values come from the existing `psi` call.

**Independent Test**: Refresh a location and compare each pollutant with the official PSI reading for its region. The backend tests pass, and a refresh still makes 11 upstream calls.

### Tests for User Story 3

- [X] T012 [P] [US3] Add failing tests to `backend/src/weather.test.ts`:
  - The `psi` fixture's `readings` include `pm10_twenty_four_hourly`, `o3_eight_hour_max`, `no2_one_hour_max`, `so2_twenty_four_hourly` and `co_eight_hour_max`, with values for `central`, and at least one value given as a string (e.g. `"0.4"`).
  - The snapshot carries those five values coerced to numbers, and `air_quality_observed_at` equals the `psi` item's `updatedTimestamp`.
  - A missing key gives `null` for that pollutant only.
  - When `psi` fails, all six new fields are `null`, `pm25_one_hourly` still has its value, and the set of requested paths has the same length as before (11).
- [X] T013 [P] [US3] Add failing tests to `backend/src/routes/locations.test.ts`:
  - Extend the fake `weather` snapshot with the six new fields.
  - After create, `GET /api/locations` returns them.
  - A location whose first refresh fails returns all six as `null`.

### Implementation for User Story 3

- [X] T014 [US3] In `backend/src/schema.ts`, add the six fields to `WeatherSnapshot`. `pm10_twenty_four_hourly`, `o3_eight_hour_max`, `no2_one_hour_max`, `so2_twenty_four_hourly` and `co_eight_hour_max` are `number | null`, and `air_quality_observed_at` is `string | null`. Add matching nullable columns to `locations`: `real('pm10_twenty_four_hourly')`, `real('o3_eight_hour_max')`, `real('no2_one_hour_max')`, `real('so2_twenty_four_hourly')`, `real('co_eight_hour_max')` and `text('air_quality_observed_at')`. All are nullable, with no `.notNull()` and no default (data-model.md §1).
- [X] T015 [US3] Run `npm run db:generate` from the repo root. Check the new file `backend/drizzle/0001_*.sql` contains only six `ALTER TABLE \`locations\` ADD \`…\`` statements, and that `backend/drizzle/meta/` is updated.
- [X] T016 [US3] In `backend/src/db.ts`:
  - Add the six fields as `null` to `defaultWeather`.
  - Map them in `weatherToColumns` (`pm10TwentyFourHourly: weather.pm10_twenty_four_hourly`, …, `airQualityObservedAt: weather.air_quality_observed_at`).
  - Map them back in the row-to-`WeatherSnapshot` conversion used by `listLocations` and `getLocation`. Rows created before the migration must read as `null`.
- [X] T017 [US3] In `backend/src/weather.ts`:
  - Add the six fields to the backend `WeatherSnapshot` interface.
  - Extend `fetchAirQuality` to return `pollutants: { pm10, o3, no2, so2, co }` via `valueForRegion(psiItem?.readings?.<key>, region)` for the five keys in data-model.md §1, and `psiObservedAt: psiItem?.updatedTimestamp ?? psiItem?.timestamp ?? null`.
  - Extend its fallback object in `getCurrentWeather` with all-null pollutants and a null `psiObservedAt`.
  - Assign the six snapshot fields after `snapshot.air_quality_region`.
  - Set all six to `null` in every snapshot constructor, including `emptyForecastSnapshot` and the two other literal snapshots near lines 516 and 539.
  - Add no new fetch. Make T012 and T013 pass.
- [X] T018 [P] [US3] Add the six fields to `WeatherSnapshot` in `frontend/src/types.ts`: five `number | null` and `air_quality_observed_at: string | null`.
- [X] T019 [US3] In `AirQualityTile` in `frontend/src/components/Tiles.tsx`, add a disclosure button labelled "Details" (`aria-expanded`, keyboard operable, theme classes only). When it is open, show five rows:
  - PM10 µg/m³
  - O₃ µg/m³
  - NO₂ µg/m³
  - SO₂ µg/m³
  - CO mg/m³

  Below the rows, show "Reading at HH:MM" from `air_quality_observed_at`, formatted in SGT (reuse `formatSgtTime` from `./sunTimes` if US2 is done, otherwise use an inline `Intl.DateTimeFormat`). Any null value shows "No reading" for that row only (FR-013). Existing PSI, PM2.5 and label rendering stays unchanged.

**Checkpoint**: `npm test` passes; the expanded air-quality tile shows five rows for a refreshed location and "No reading" rows for a pre-existing one.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Update `docs/architecture.md`, in the Snapshot pattern paragraph, to say the snapshot now carries five PSI pollutant concentrations and `air_quality_observed_at` from the existing `psi` call. In the Frontend paragraph, say that "Feels like" (`feelsLike.ts`, Steadman) and sun times (`sunTimes.ts`, NOAA) are derived on the client from stored data and the clock, with no weather calls.
- [X] T021 [P] Confirm the pollutant display units, especially CO mg/m³, against NEA's "Computation of the Pollutant Standards Index (PSI)" document. Record the source in `specs/004-outdoor-comfort-tiles/research.md` R7, and correct the units in `frontend/src/components/Tiles.tsx` if they differ.
- [X] T022 Run `npm test` and `npm run build -w frontend`; both must pass (constitution, Development Workflow)
- [X] T023 Walk through the manual scenarios 1–6 in `specs/004-outdoor-comfort-tiles/quickstart.md`, covering refreshed, unrefreshed and pre-existing locations, every theme, about 375 px width and midnight rollover, using `agent-browser` for screenshots. Then do the call-count check in step 4.
- [ ] T024 After using the tiles, record the owner's step-2 (WBGT) go or no-go in `.specify/assessments/nea-data-new-features/decision.md` under a new "Step 1 review" heading (SC-006)

---

## Implementation Notes (2026-11-13)

- **Layout differs from plan.md**: Air Quality was already a 2-column tile, not 1. The final large-screen order is: Conditions + Feels like; Air quality + Wind; UV, Temperature, Rainfall, Humidity; Forecast high + Sun (each `lg:col-span-2`). On phones, Forecast high and Sun sit side by side.
- **Analysis U2 applied**: the open air-quality detail spans the full row on large screens, so neighbouring tiles are not stretched.
- **Analysis U1 applied**: `needsUmbrella(null, …)` is covered in `feelsLike.test.ts`.
- **Research R3 corrected**: plain `Math.round(x * 10) / 10` is used; the earlier float-error claim was wrong.
- **T018 done early**: the six frontend type fields were added during US1 so the frontend kept type-checking.
- **Pollutant display**: live NEA data reports whole numbers (CO came back as `0`), so values show the provider's own precision (up to 2 decimals), not a fixed `toFixed(2)`.
- **T023 results**:
  - Refreshed "City" showed 34.3° Hot & Muggy (expected 34.27 from 28.3 °C, 83.1 %, 1.5 kn), no umbrella (Cloudy, 0 mm), five pollutants and "Reading at 18:31 SGT".
  - Sun 06:47 / 18:51 matched the reference.
  - The pre-migration location (Sentosa) showed "No reading" for each pollutant.
  - Width 375 px gave no horizontal scroll, and the Apple and Midnight Radar themes were checked.
  - The midnight rollover was covered by unit tests only, with no clock faking.
  - The call count (11) was covered by unit tests, not counted live.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: none.
- **Foundational (T002–T003)**: after Setup; blocks every story's grid placement (T007, T011, T019 rely on the new `TileGrid` prop).
- **US1 (T004–T007)**: after Foundational. Frontend only.
- **US2 (T008–T011)**: after Foundational. Frontend only. Independent of US1, except that T011 places Sun before Feels like if US1 is done.
- **US3 (T012–T019)**: after Foundational. Backend plus frontend; independent of US1 and US2.
- **Polish (T020–T024)**: after the stories you intend to ship.

### Within Each Story

- Tests first, and they must fail (T004, T008, T012/T013).
- Pure module or backend change next (T005, T009, T014→T015→T016→T017).
- UI last (T006/T007, T010/T011, T018/T019).

### Shared-file Note

`frontend/src/components/Tiles.tsx` is edited by T002, T006, T007, T010, T011 and T019, so those tasks are never parallel with each other.

---

## Parallel Examples

```text
# Tests for all three stories can be written at once (different files):
T004 frontend/src/components/feelsLike.test.ts
T008 frontend/src/components/sunTimes.test.ts
T012 backend/src/weather.test.ts
T013 backend/src/routes/locations.test.ts

# Pure modules and backend work can proceed together:
T005 frontend/src/components/feelsLike.ts
T009 frontend/src/components/sunTimes.ts
T014→T017 backend (sequential among themselves)
T018 frontend/src/types.ts

# Polish:
T020 docs/architecture.md
T021 unit confirmation
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. T001–T003 (baseline + grid prop).
2. T004–T007 (Feels like).
3. Stop and validate: the owner looks at the tile for a few days. This alone answers "what to wear / umbrella?".

### Incremental Delivery

1. Feels like (US1) → demo.
2. Sun (US2) → demo; frontend only, no data change.
3. Air-quality detail (US3) → demo; the only story with a schema migration, so ship it on its own commit.
4. Polish, then the step-2 decision (T024).

Commit after each story with a conventional prefix (`feat:`), and say why in the message.
