---

description: "Task list for Today's UV Trend in the UV Tile"
---

# Tasks: Today's UV Trend in the UV Tile

**Input**: Design documents from `/specs/008-uv-hourly-trend/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/ui.md, quickstart.md

**Tests**: Included. Constitution Principles IV and VI require backend tests that use a fake provider, and frontend tests for pure modules. quickstart.md §1 lists what they cover. Write each story's tests first and confirm they fail.

**Organization**: tasks are grouped by user story.
- US1 (P1) and US2 (P1) ship together in the same tile.
- US3 (P2) makes old and empty snapshots read correctly.
- All three edit `uvTrend.ts` and `Tiles.tsx`, so the stories run in order, not in parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 = today's hourly view and direction, US2 = UV 3+ count, markers and guidance, US3 = old, empty and unavailable states

---

## Phase 1: Setup

- [X] T001 Create and switch to branch `008-uv-hourly-trend`: from `main` if `007-lightning-bolt-markers` is merged, otherwise from `007-lightning-bolt-markers` (ask the owner which). Leave the unrelated uncommitted `CLAUDE.md` change untouched and don't stage it.
- [X] T002 Run `npm run verify` from the repo root. Record that lint, typecheck, tests and build all pass before any change. No files are edited.

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: add the stored `uv_hourly` snapshot field end to end, so every story can read it. No user-visible change yet.

- [X] T003 In `backend/src/schema.ts`, export `interface UvReading { hour: string; value: number | null }` and `interface UvDay { date: string; as_of: string | null; readings: UvReading[] }`. Add `uv_hourly: UvDay | null;` to `WeatherSnapshot` after `uv_index`. Add column `uvHourly: text('uv_hourly', { mode: 'json' }).$type<UvDay>()` to `locations`. It is **nullable**: no `.notNull()`, unlike `forecastPeriods`. Data-model: "`date` 'YYYY-MM-DD', Singapore calendar day, from the provider record's `date`"; "`readings` oldest first; may be empty"; "`value` UV index; null when the provider value isn't numeric".
- [X] T004 Run `npm run db:generate` from the repo root and commit the generated `backend/drizzle/0003_*.sql` and updated `backend/drizzle/meta/`. Check that the SQL is a single `ALTER TABLE \`locations\` ADD \`uv_hourly\` text;` with no default and no NOT NULL.
- [X] T005 In `backend/src/db.ts`, add `uv_hourly: null` to `defaultWeather`, `uvHourly: weather.uv_hourly` to `weatherToColumns`, and `uv_hourly: row.uvHourly ?? null` to `rowToRecord`, each placed next to the existing UV field.
- [X] T006 In `backend/src/weather.ts`, add `uv_hourly: null` next to every `uv_index: null` in the snapshot literals (the `emptyForecastSnapshot()` method and the other two literals near the end of the file), so the code type-checks. Don't change any fetch yet.
- [X] T007 [P] In `frontend/src/types.ts`, export `UvReading` and `UvDay` with the same shape as T003. Add `uv_hourly: UvDay | null;` to `WeatherSnapshot` after `uv_index`.
- [X] T008 In `backend/src/routes/locations.test.ts`:
  - Add `uv_hourly` to the fake `weather` snapshot, e.g. `{ date: '2026-11-15', as_of: '2026-11-15T15:11:20+08:00', readings: [{ hour: '2026-11-15T07:00:00+08:00', value: 0 }, { hour: '2026-11-15T08:00:00+08:00', value: 1 }] }`.
  - Assert that create and refresh responses carry it, and that `GET /api/locations` returns it unchanged after the SQLite round trip.
  - Add a test that a row written without the column (insert through the existing helper with `uv_hourly: null`) reads back `uv_hourly: null`.
- [X] T009 Run `npm run typecheck` and `npx vitest run backend/src/routes/locations.test.ts`. Both pass.

**Checkpoint**: the field round-trips through the API as `null` or a value. The UI is unchanged.

---

## Phase 3: User Story 1 - See how UV has moved today (Priority: P1) 🎯 MVP

**Goal**: the UV tile shows 13 hourly slots from 07:00 to 19:00, with reported values coloured by band, empty slots for hours not yet reported, and Rising, Steady or Falling.

**Independent test**: refresh a location in the afternoon. Each filled slot matches NEA's `index[]` for that hour, later slots are empty, and the direction matches the last two readings (quickstart §2).

### Tests for User Story 1 (write first, confirm they fail)

- [X] T010 [P] [US1] In `backend/src/weather.test.ts`, give the `uv` fixture a record with `date: '2026-11-15'`, `updatedTimestamp: '2026-11-15T15:11:20+08:00'` and a **newest-first** `index` (15:00 → 07:00). Assert:
  - `snapshot.uv_hourly.readings` is oldest first.
  - `date` is `'2026-11-15'` and `as_of` equals `updatedTimestamp`.
  - `snapshot.uv_index` is still `index[0].value`.
  - A value of `'x'` becomes `null`, not 0.
  - An entry with no parseable `hour` is dropped.
  - Duplicate hours keep the first (newest) occurrence.
  - An empty `index` gives `readings: []`.
  - A missing `date` falls back to the Singapore date of the oldest kept reading's `hour` (for example `'2026-11-15T07:00:00+08:00'` → `'2026-11-15'`), even when `record.timestamp` is missing.
  - A missing `date` with an empty `index` falls back to the Singapore date of `record.timestamp`, giving `readings: []`.
  - Missing `date`, empty `index` and no parseable `timestamp` give `uv_hourly: null` while `uv_index` is still set from the record (the only case where `uv_hourly` is `null` after a successful fetch).
  - A failing `uv` fetch gives `uv_index: null` and `uv_hourly: null` while the other fields are intact.
  - The number of provider requests per `getCurrentWeather` is unchanged. Before T012, run `getCurrentWeather` once against the fake fetch and record its call count. Pin that literal number in the assertion (e.g. `expect(calls).toHaveLength(N)`), and write N in place of "12" in plan.md, contracts/api.md and T024 if it differs.
- [X] T011 [P] [US1] Create `frontend/src/components/uvTrend.test.ts` covering:
  - `uvBandName()` at 0, 2, 3, 5, 6, 7, 8, 10, 11 and 14 (Low ≤2, Moderate ≤5, High ≤7, Very High ≤10, else Extreme), and `null`/NaN → `null`.
  - `uvTrendView()` for a today list 07 → 15 with `now` = 15:30 SGT 2026-11-15:
    - exactly 13 slots with hours 7…19
    - slots 16–19 have `value: null` and `band: null`
    - reported slots carry value and band
  - A reading at 06:00 or 20:00 isn't placed in a slot.
  - Direction: 4 → 5 gives `'Rising'`, 5 → 4 `'Falling'`, 4 → 4 `'Steady'`, and 3, (11:00 null), 5 gives `'Rising'` (skips the missing hour). One reading gives `null`.

### Implementation for User Story 1

- [X] T012 [US1] In `backend/src/weather.ts`:
  - Add `date?: string` to the `UvPayload` record type.
  - Change `fetchUvIndex()` to return `{ value, timestamp, hourly }`. `hourly` is built from `records[0]` per data-model "Validation and normalisation":
    - `date` = `record.date`; else the Singapore date (via `Intl.DateTimeFormat` with `timeZone: 'Asia/Singapore'`) of the oldest kept reading's `hour`; else the Singapore date of `record.timestamp`; else `hourly = null`. Build the readings first, since the fallback needs them.
    - `as_of` = `record.updatedTimestamp ?? null`.
    - readings come from `index`, dropping entries without a parseable `hour`, `value` via `numberOrNull`, keeping the first of duplicate hours, then sorted oldest first.
  - Change the `fetchOptional('uv', …)` fallback to `{ value: null, timestamp: null, hourly: null }`.
  - Set `snapshot.uv_hourly = uv.hourly`.
  - `uv.timestamp` stays in the `observed_at` list. Run T010; it passes.
- [X] T013 [US1] Create `frontend/src/components/uvTrend.ts` (pure, no React):
  - `export type UvBand = 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme'`.
  - `export function uvBandName(v: number | null | undefined): UvBand | null`, with the boundaries in T011.
  - `export const UV_SLOT_HOURS` = 7…19.
  - `export function uvTrendView(uvIndex: number | null | undefined, uvHourly: UvDay | null | undefined, now: Date): UvTrendView`, returning the `readings` variant from data-model.md: `isToday`, `slots`, `direction`.
  - `isToday` is `uvHourly.date === singaporeDate(now)`, using `singaporeDate` from `./sunTimes`.
  - A slot's hour is the SGT hour of the reading's `hour`.
  - Direction is from the last two numeric readings in time order and is `null` unless `isToday` and there are ≥ 2 numeric readings.

  Leave `hoursAtModerateOrAbove`, `inPeakWindow`, `dayLabel`, `asOf` and the non-readings states as simple placeholders filled in by T019 and T022. Run T011; it passes.
- [X] T014 [US1] In `frontend/src/components/Tiles.tsx`, make `uvLabel()` use `uvBandName()` from `./uvTrend` (`Very High` keeps its capitalisation; a missing value still returns `'Unavailable'`). Don't touch `outdoorSummary.ts` `uvBand` (FR-014).
- [X] T015 [P] [US1] In `frontend/src/index.css`, after `.scale-bar--uv`, add `.uv-bar { background-image: var(--scale-uv); background-size: 2200% 100%; background-repeat: no-repeat; }` (implemented at 2200%, see plan Design Note 4) with a comment saying the bar samples the UV gauge at its value via an inline `background-position-x` (research R4). Add no new colour tokens.
- [X] T016 [US1] In `frontend/src/components/Tiles.tsx` `UVTile`:
  - Keep the value, `uvLabel` and `ScaleBar` unchanged.
  - Compute `uvTrendView(weather?.uv_index, weather?.uv_hourly, now)` with the existing `useNow` hook.
  - Render the status line with the direction.
  - Render the hourly view per contracts/ui.md item 4:
    - an `<ol aria-label="Hourly UV, {d MMM}">` with 13 equal-width `<li>`
    - a reported slot shows its number (`text-[11px] tabular-nums text-white/85`) above an `aria-hidden` `.uv-bar` whose height is `min(value, 11) / 11` of the view height (value 0 → a 2 px bar) and whose inline `backgroundPositionX` is `clamp(value / 11, 0, 1) × 100%`
    - an empty slot shows no number and a dotted `border-white/20` baseline
    - each `<li>` has `sr-only` text: `"11:00, UV 4, Moderate"` or `"16:00, no reading"`
    - the hour axis labels only 7, 10, 13, 16 and 19 (`text-[10px] text-ink-muted`)
  - No literal colours.
- [X] T017 [US1] In `frontend/src/components/Tiles.tsx` `OutdoorGrid`, reorder the tiles to `PrecipitationTile`, `UVTile`, `AirQualityTile`. Give the Rainfall and UV `TileShell`s `className="col-span-2"` (add a `className` prop to `PrecipitationTile` and `UVTile`, or set it inside them). In `AirQualityTile`, change the closed class from `'col-span-2'` to `'col-span-2 lg:col-span-4'` so open and closed match, and update its comment. Check the layout per contracts/ui.md Placement: on a phone, all three full width; at `lg`, Rainfall (2) | UV (2), then Air Quality (4), with the detail open and closed, and no empty grid cells.

**Checkpoint**: US1 works on its own. In `npm run dev`, a refreshed location shows today's slots and direction, and the existing value, band and gauge are unchanged.

---

## Phase 4: User Story 2 - Know how much of today has been at Moderate UV or above (Priority: P1)

**Goal**: the count of hours at UV 3+, the UV 3 (Moderate) marker, NEA's 11 am – 3 pm usual-peak band, and the guidance and source lines with published wording only.

**Independent test**: for a refreshed day, the count equals NEA's readings ≥ 3 up to the snapshot time. The UV 3 marker and the peak band are visible and labelled. The guidance quotes only NEA and HealthHub (quickstart §1–2).

### Tests for User Story 2 (write first, confirm they fail)

- [X] T018 [P] [US2] In `frontend/src/components/uvTrend.test.ts`, add:
  - readings 0, 0, 1, 3, 5, 7, 6 give `hoursAtModerateOrAbove === 4`
  - all readings below 3 give 0
  - null values aren't counted
  - a reading of 3 at 20:00 (outside the slots) is still counted
  - `inPeakWindow` is true for hours 11, 12, 13 and 14 only
  - `UV_GUIDANCE` equals `'UV usually peaks 11 am – 3 pm (NEA). Use SPF 30+ sunscreen, applied 20–30 min before going into the sun (HealthHub).'`
  - `UV_GUIDANCE` doesn't contain `'advised'` (spec FR-008)

### Implementation for User Story 2

- [X] T019 [US2] In `frontend/src/components/uvTrend.ts`, implement:
  - `hoursAtModerateOrAbove`: numeric readings in the list with value ≥ 3.
  - `inPeakWindow`: `11 <= hour && hour < 15`.
  - Export `UV_MODERATE_FROM = 3`.
  - Export `UV_GUIDANCE` (exact text in T018).
  - Export `uvStatusText(view)`: e.g. `'Falling · 2 h at UV 3+ (Moderate or higher) so far'`, or `'No hours at UV 3+ so far'` when 0, with the direction omitted when `null`. On a previous day there is no "so far": `'14 Nov · 3 h at UV 3+ (Moderate or higher)'`, or `'14 Nov · No hours at UV 3+'` when 0 (T022 fills these in).
  - Export `uvSourceText(asOf: string | null, dayLabel: string | null = null)`: `'Nationwide reading, measured at Changi · as of 15:11'`, or `'Nationwide reading, measured at Changi'` when `asOf` is null (T022 adds the `dayLabel` variant).

  Run T018; it passes.
- [X] T020 [US2] In `frontend/src/components/Tiles.tsx` `UVTile`, per contracts/ui.md items 3–6:
  - Replace the status line text with `uvStatusText(view)`.
  - Inside the hourly view, add an `aria-hidden` dashed `border-white/40` line at `3/11` of the bar height with a `UV 3` label (`text-[10px] text-ink-muted`) at the right edge.
  - Behind the slots where `inPeakWindow`, add a `bg-white/[0.06]` band captioned `NEA: usual peak 11 am – 3 pm` (`text-[10px] text-ink-muted`).
  - Add the guidance paragraph `UV_GUIDANCE` (`text-xs leading-snug text-ink-muted`).
  - Replace the existing footer text (`Nationwide UVI reading from …`) with `uvSourceText(view.asOf, view.dayLabel)` for the `readings` state, per contracts/ui.md item 6.

**Checkpoint**: US1 and US2 together meet spec Stories 1–2. This is the shippable MVP.

---

## Phase 5: User Story 3 - Read old or empty snapshots correctly (Priority: P2)

**Goal**: previous-day, overnight, empty, unavailable and pre-feature snapshots each show their explicit state. There's never a blank or zero-filled view.

**Independent test**: with stubbed `GET /api/locations` (quickstart §3), each of the five states shows its message, and `assert_clean` passes after each switch.

### Tests for User Story 3 (write first, confirm they fail)

- [X] T021 [P] [US3] In `frontend/src/components/uvTrend.test.ts`, add the four states from the data-model table:
  - `uv_index: null` and `uv_hourly: null` → `{ kind: 'unavailable' }`
  - `uv_index: 5` and `uv_hourly: null` → `{ kind: 'pre-feature' }`
  - `readings: []` → `{ kind: 'empty' }`
  - otherwise `'readings'`

  Add a previous-day case: list `date: '2026-11-14'` with 13 readings and `now` = 2026-11-15T08:00+08:00 gives `isToday: false`, `dayLabel: '14 Nov'`, `direction: null`, `asOf: null`, and the count still computed. Add an overnight case: `now` = 2026-11-15T00:30+08:00 with the 14 Nov list gives `'14 Nov'`. Add status texts:
  - previous day: `uvStatusText` gives `'14 Nov · 3 h at UV 3+ (Moderate or higher)'` (no "so far")
  - previous day with no reading ≥ 3: `uvStatusText` gives `'14 Nov · No hours at UV 3+'`
  - source text for the previous day: `uvSourceText(null, '14 Nov')` gives `'Readings for 14 Nov, measured at Changi'`
  - `uvSourceText(null)` gives `'Nationwide reading, measured at Changi'`

### Implementation for User Story 3

- [X] T022 [US3] In `frontend/src/components/uvTrend.ts`:
  - Implement the `kind` checks in the data-model order (unavailable → pre-feature → empty → readings).
  - `dayLabel` is `null` when `isToday`; otherwise `'d MMM'` via `Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short' })`, parsing `date` as a Singapore calendar day.
  - `asOf` is `'HH:MM'` SGT from `as_of` via `formatSgtTime` from `./sunTimes` when `isToday`, else `null`.
  - Make `uvStatusText` and `uvSourceText` produce the previous-day variants from T021. Run T021; it passes.
- [X] T023 [US3] In `frontend/src/components/Tiles.tsx` `UVTile`:
  - Render the states per contracts/ui.md "Other states":
    - pre-feature: `Hourly view appears after the next refresh.`
    - empty: `No UV readings yet.`
    - unavailable: only the existing value `--`, the label `Unavailable` and `uvSourceText(null)`
  - Source line for pre-feature and empty: `uvSourceText(asOf)` using the tile's existing `asOf` prop (contracts/ui.md item 6).
  - The guidance line shows in every state except unavailable.
  - The `<ol>` label uses `dayLabel` when set (`Hourly UV, 14 Nov`).
  - Wrap the hourly view in `hidden min-[340px]:block` so viewports narrower than 340 px keep only the text lines (FR-015). (Implemented as a hand-written `.uv-hourly` rule in `index.css`: Tailwind 3 doesn't generate `min-[…]` variants when a screen is `raw`, as `md` is here. Caught by T027.)

**Checkpoint**: all three stories work on their own and together.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T024 [P] Update `docs/architecture.md`:
  - In the Snapshot pattern paragraph, add that `uv_hourly` (the day's hourly readings, the record's own `date` and `as_of`) comes from the same `uv` response, adding no call (the per-refresh count pinned in T010), and that overnight it holds the previous day.
  - In the Frontend paragraph, add `components/uvTrend.ts` (pure: bands, 13 slots, direction, UV 3+ count, states) and the two-column UV tile.
- [X] T025 [P] Update `docs/theming.md`: in the gauge-fills bullet, add that the UV tile's hourly bars (`.uv-bar`) sample `--scale-uv` at each value, so a theme's UV gradient colours both the gauge and the bars.
- [X] T026 Run `npm run verify` from the repo root. Fix any failure in the file it names, and rerun until lint, typecheck, tests and build all pass.
- [X] T027 Browser check per quickstart §3–4 and CLAUDE.md "Browser checks":
  - Use `scripts/e2e/lib.sh` (temporary server, throwaway DB, `EXIT` trap) and agent-browser, starting on `about:blank` with errors and console cleared.
  - Stub `GET /api/locations` with five locations, one per state.
  - For each state, and for each of the six themes at 360 px and at desktop width: check the message or slots, no horizontal scroll, numbers on every reported slot, and readable markers. Call `assert_clean` after each switch.
  - Save screenshots to `e2e-artifacts/`.
  - Confirm afterwards that no process from the check still holds a port.
- [X] T028 Live check per quickstart §2: with `npm run dev` started by you (not the owner's server), refresh one location in daylight. Compare the slots, count and direction with `curl -s https://api-open.data.gov.sg/v2/real-time/api/uv`. Confirm in `backend/logs/app.log` that the provider request count per refresh is unchanged. Stop the server afterwards.
- [X] T029 (optional, done) Turn T027 into a reusable `scripts/e2e/uv-trend.sh [us1|us2|us3|themes]` following `scripts/e2e/lightning-markers.sh`, and add one line for it to the Browser checks list in `docs/testing.md`.

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T009)** → **US1 (T010–T017)** → **US2 (T018–T020)** → **US3 (T021–T023)** → **Polish (T024–T029)**.
- Within Foundational: T003 → T004 → T005/T006; T007 is independent; T008 after T005; T009 last.
- Within each story: tests first (they must fail), then implementation. T012 needs T010; T013 needs T011; T016 needs T013–T015; T017 after T016.
- Stories are sequential because they share `uvTrend.ts`, `uvTrend.test.ts` and `Tiles.tsx`. Each still ends at a testable checkpoint.
- T026 (verify) must pass before T027–T028.

## Parallel Opportunities

- Foundational: T007 (frontend types) alongside T003–T006 (backend).
- US1: T010 (backend test) ∥ T011 (frontend test). Later, T015 (CSS) ∥ T012/T013.
- US2: T018 can be written while T017 is being checked.
- US3: T021 can be written while T020 is being checked.
- Polish: T024 ∥ T025.

```text
# US1 kick-off, two agents:
Agent A: T010 then T012   (backend/src/weather.test.ts, backend/src/weather.ts)
Agent B: T011 then T013   (frontend/src/components/uvTrend.test.ts, uvTrend.ts)
then:    T014 → T015 → T016 → T017 (Tiles.tsx, index.css)
```

## Implementation Strategy

1. **MVP = Phases 1–4 (US1 + US2)**. They form one coherent tile: the hourly view, direction, UV 3+ count, peak band and guidance. Stop there, run T026, and check the tile in the browser before going on.
2. **Then US3**. Until it lands, an overnight or previous-day snapshot shows its slots without the date label. That is acceptable only on the working branch, not for merge.
3. **Polish last**: docs, verify gate, browser and live checks. T029 is optional.
4. Commit after each checkpoint with conventional prefixes (`feat:`, `test:`, `docs:`), only when `npm run lint` and `npm test` pass. Never use `--no-verify`.
