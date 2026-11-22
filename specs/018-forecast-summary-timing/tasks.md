---

description: "Tasks for spec 018: honest forecast timing and rain in the summary"
---

# Tasks: Honest Forecast Timing and Rain in the Summary

**Input**: Design documents from `specs/018-forecast-summary-timing/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/forecast-display.md](contracts/forecast-display.md), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution Principle IV requires a bug fix to have a test that fails without it. Write each test task first and watch it fail for the stated reason.

**Organization**: by user story. US1 (what "now" means) is the MVP. US2 (rain) builds on US1's summary. Docs change inside the story that changes the behaviour, as the constitution requires, following the plan's delivery order. T036–T037 were added after `/speckit-analyze` and sit where they run. Earlier IDs are unchanged.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different file, no dependency on an incomplete task in the same group)
- **[Story]**: US1 or US2 from spec.md

## Conventions for every task

- **Fixture clock**: times are Singapore time on 22 Nov 2026 unless a date is given. Pass `now` explicitly. Never rely on the real clock or the device's zone.
- **Fixture labels**: `A` = `6 am to Midday 22 Nov`, `B` = `Midday to 6 pm 22 Nov`, `C` = `6 pm 22 Nov to 6 am 23 Nov`.
- **Fixture 2-hour texts**: `W` = `11.30 am to 1.30 pm`, `M` = `8.30 am to 10.30 am`. The 2-hour condition is `Cloudy` unless stated.
- **Never touch** `backend/` (except the period mapping and its test in T036–T037), theme CSS or colours, `feelsLike.ts`, the condition displays outside the top line, or the freshness threshold (spec, Out of Scope).
- **Unrelated working-tree changes** (`.impeccable/config.json`, `docs/deployment.md`, `.specify/assessments/*`) stay unstaged. The one assessment this spec cites, `groq-llm-features`, is committed with it only if the owner agrees.
- **Commits, pushes and merges need the owner's go-ahead.** A merge to `main` deploys to production.

---

## Phase 1: Setup

**Purpose**: a known-good starting point.

- [x] T001 Create branch `018-forecast-summary-timing` from current `origin/main` for `specs/018-forecast-summary-timing/`. **Done 2026-11-22** at `cd04418`.
- [ ] T002 Record the baseline before editing `frontend/src/` or `backend/src/`: run `npm run verify`, then the seven scripts that stub a snapshot under the top line: `scripts/e2e/temp-wind.sh`, `scripts/e2e/rain-view.sh`, `scripts/e2e/lightning-markers.sh`, `scripts/e2e/lightning-grouping.sh`, `scripts/e2e/privacy-notice.sh`, `scripts/e2e/installable-app.sh` and `scripts/e2e/uv-trend.sh`. Note any failure under this task so that T032 can tell a regression from an existing fault.

---

## Phase 2: Foundational (windows, states and time words)

**Purpose**: the pure rules that both stories use. Nothing visible changes.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Tests first

- [ ] T003 [P] Write `frontend/src/components/forecastTiming.test.ts` for `forecastOutlook(weather, now)` and `stripLabels(outlook)`. It fails because the module doesn't exist.
  - **Boundaries**: "`start` Inclusive", "`end` Exclusive". At 12:00:00 `A` is `ended` and `B` is `active`. At 11:59:59.999 the reverse (`active`, `upcoming`).
  - **2-hour formats**: read at 23:36, `11.30 pm to 1.30 am` is 22 Nov 23:30 → 23 Nov 01:30. Also cover `10.00 pm to Midnight`, `Midday to 2.00 pm`, `Midnight to 2.00 am`, `12pm to 6pm` and `6:30 pm to 8:30 pm`.
  - **Next-day label**: read 22 Nov 00:20, the last of `Midnight to 6 am 22 Nov`, `A`, `B`, `6 pm to Midnight 23 Nov` is 22 Nov 18:00 → 23 Nov 00:00.
  - **Wrong month**: read 2026-10-31 18:01, `6 pm 30 Nov to 6 am 01 Dec`, `6 am to Midday 01 Dec` start 31 Oct 18:00 and 1 Nov 06:00.
  - **Wrong day**: read 2026-10-31 05:40, `6 am to Midday 01 Nov` starts 31 Oct 06:00.
  - **Wrong year**: read 2025-12-31 17:40, `6 pm 31 Dec 2025 to 6 am 01 Jan 2025` ends 2026-01-01 06:00.
  - **Issued early**: read 23:10, `Midnight to 6 am 23 Nov` starts 23 Nov 00:00 and is `upcoming`.
  - **Anchor stability**: the same labels read 0, 1, 3 and 6 hours after an 05:41 issue give the same windows.
  - **Unknown**: an unreadable label, or a start that differs from the previous end, makes "that period and those after it" unknown. A null, empty or invalid `observed_at` makes "every window" unknown. None of these throws.
  - **Sweep (SC-002)**: for each layout, put thunder in each period in turn and step `now` every minute from the issue time to the last window's end, inclusive. At each step set `observed_at` to the later of the issue time and `now` − 179 minutes, so the reading is always fresh and the windows don't move (19,360 checks). `thunderActive` and `stormSky` equal "`now` is inside that window", against windows written out in the test. All 14 placements must be seen both active and ending. At most one period is `active`. The layouts are `A B C` at 05:41; `B C` + next morning at 11:41; `C` + next morning and afternoon at 17:41; the four periods from midnight at 23:41; a lone `Midnight to 6 am` at 23:41.
  - **2-hour sweep (SC-002)**: for all 48 half-hour starts on 31 Dec 2026, in NEA's format, put thunder in the 2-hour forecast only, read 10 minutes after its start. Step `now` every minute from 30 minutes before the start to 30 minutes after the end, inclusive (8,688 checks). `thunderActive` and `stormSky` equal "`now` is inside that window". This crosses midday, midnight and the year end.
  - **Missing wording**: read 23:45, an empty midnight period followed by the other three leaves their starts at 23 Nov 06:00, 12:00 and 18:00. Only the empty one is `missing`.
  - **Strip labels**: case 1 → `6 am, Now, 6 pm`; case 3 → `Midday, 6 pm`; case 5 → `6 am`; case 9 → `Now, 6 am, Midday, 6 pm`; stale (read 11:50, viewed 15:00, `A B C`) → `6 am, Midday, 6 pm`; an unreadable label → its `shortenPeriodLabel` text; an empty label → `--`.
- [ ] T004 [P] Extend `frontend/src/components/periodLabel.test.ts` for `periodTimeLabel(instant, now)` and `periodTimePhrase(instant, now)`, with one assertion for every row and example in "Time words" of `specs/018-forecast-summary-timing/contracts/forecast-display.md`. Include `1.30 pm`, tonight's midnight seen at 19:00 and 23:45 (`Midnight`), the midnight that began today seen at 00:30 (`Midnight`), and a year boundary. Leave the old tests until T015. Move the `shortenPeriodLabel` tests here from `frontend/src/components/outdoorSummary.test.ts`. The new and moved ones fail because the exports don't exist.

### Implementation

- [ ] T005 Create `frontend/src/components/forecastTiming.ts` with the `ForecastWindow` type and the window resolver, following research R2.
  - Read only clock words. Allow and ignore a trailing date and year.
  - Place the first period, and separately the 2-hour window, at "the latest occurrence of its start that is no later than `observed_at` + 2 hours". The end is the next occurrence of the end clock time.
  - "In a resolved chain, each `start` equals the previous `end`." A window's end is "Always after `start`, and less than 24 hours after it."
  - Use fixed UTC+8 arithmetic. "A window depends only on the snapshot, never on `now`."
- [ ] T006 [P] Add `periodTimeLabel` and `periodTimePhrase` to `frontend/src/components/periodLabel.ts` to pass T004. Format from the instant in Singapore time. For midnight, "the day is the one that ends then". Keep the old exports until T015 so the build stays green. Move `shortenPeriodLabel` here unchanged and import it into `frontend/src/components/outdoorSummary.ts` until T010 stops using it, with no re-export.
- [ ] T007 In `frontend/src/components/forecastTiming.ts`, add `TimedForecast`, `ForecastOutlook`, `forecastOutlook` and `stripLabels` to pass T003 (depends on T005, T006).
  - `kind` comes "From `conditionToIcon`" (`map/mapHelpers.ts`): `thunder`, `rain` or `other`.
  - `at` is "`now`, or the reading time when stale". `fresh` is "`readingFreshness(...).kind === 'fresh'`".
  - `periods` has the "Same length and order as stored".
  - `missing` is "A period whose trimmed text is empty". It keeps its window.
  - `stormSky` is "`fresh && thunderActive`". A strip label is "Now" "only if `fresh` and that period is `active`".
  - No clock reads, network, storage or logging.
  - Import `shortenPeriodLabel` from `periodLabel.ts`. Never import `outdoorSummary.ts`, which imports this module.

**Checkpoint**: the test files of T003 and T004 pass, `npm test` is green and the app looks the same.

---

## Phase 3: User Story 1 - "Now" means now (Priority: P1) 🎯 MVP

**Goal**: thunder is called "now" exactly while a thunder forecast is in force, and the top line, strip and sky agree.

**Independent Test**: cases 1–5 and 9 at their fixed times give the required line, strip and sky, and case 3 changes by itself at midday. No rain wording is needed.

### Tests for User Story 1

- [ ] T008 [P] [US1] Rewrite the weather-line tests in `frontend/src/components/outdoorSummary.test.ts` for `outdoorSummaryParts(weather, now)` and `outdoorSummary(weather, now)`. They fail on today's code.

  | Case | Read → viewed | 2-hour | Periods | Weather part |
  |---|---|---|---|---|
  | 1 | 11:50 → 12:30 | Cloudy, `W` | `A` thunder, `B` `C` dry | `No storms forecast` |
  | 2 | 11:50 → 12:30 | Cloudy, `W` | `A` dry, `B` thunder, `C` dry | `Thundery showers now` |
  | 3 | 11:45 → 11:50 | Cloudy, `W` | `B` thunder, `C` dry | `Thundery showers from midday` |
  | 3 at boundary | 11:45 → 12:00 | as case 3 | as case 3 | `Thundery showers now` |
  | 4 before end | 11:50 → 13:00 | thunder, `W` | `B` `C` dry | `Thundery showers now` |
  | 4 | 11:50 → 14:00 | thunder, `W` | `B` `C` dry | none |
  | 5 | 11:50 → 12:30 | Cloudy, `10.00 am to Midday` | `A` dry | none |
  | 9 | 00:20 → 00:30 | Cloudy, `Midnight to 2.00 am` | four periods, last thunder | `Thundery showers from 6 pm` |
  | Stale | 11:50 → 15:00 | Cloudy, `W` | `A` thunder, `B` dry | `Thundery showers now` (Hero dates it) |
  | No reading time | none → 12:30 | thunder, `W` | none | `Thundery showers forecast` |
  | Device clock behind | 11:50 → 11:00 | thunder, `W` | `B` dry | `Thundery showers from 11.30 am` |
  | Dry 2-hour only | 12:10 → 12:30 | Cloudy, `W` | none | none |
  | 2-hour unavailable | 12:10 → 12:30 | Unavailable, null | `B` dry | `No storms forecast` |
  | Untimed 2-hour thunder first | 12:10 → 12:30 | thunder, null | `B` dry, `C` thunder | `Thundery showers forecast` |
  | Missing, then thunder | 23:45 → 23:45 | Cloudy, `11.30 pm to 1.30 am` | four from midnight: empty, thunder, dry, dry | `Thundery showers from tomorrow 6 am` |
  | Missing, rest dry | 23:45 → 23:45 | Cloudy, `11.30 pm to 1.30 am` | four from midnight: empty, dry, dry, dry | none |
  | Missing but ended | 11:50 → 12:30 | Cloudy, `W` | `A` empty, `B` `C` dry | `No storms forecast` |

  Also assert that heat, UV and PSI still follow in that order, including when the weather part is empty (FR-015, FR-017). Update the existing fixtures to carry a reading time, a window and `now`.
- [ ] T009 [P] [US1] Update `frontend/src/theme/sky.test.ts` for `skyState(weather, now)`: storm for cases 2, 3 at boundary and 4 before end; not storm for 1, 3, 4, 5, 9, stale and no reading time. Keep the haze, heat and precedence tests, with timed fixtures. A stale reading (11:50 → 15:00) with PSI 150, and one with High heat within 10 km, are `calm`. No reading time with PSI 150 is still `haze`. Over both of T003's sweeps, with their reading times, storm and `Thundery showers now` each occur exactly inside the thunder window (SC-004).
- [ ] T036 [P] [US1] In `backend/src/weather.test.ts`, test `fetchTwentyFourHourForecast` with a stubbed fetch (FR-020): texts `''`, `Fair` keep both periods in order with the first `forecast` empty, which fails today; all texts empty store `[]`; an empty label keeps its position.

### Implementation for User Story 1

T037 and T010–T015 are one change. The build is red between them, and they are committed together so the three surfaces never disagree.

- [ ] T037 [US1] In `fetchTwentyFourHourForecast` in `backend/src/weather.ts`, stop filtering single periods: keep every one in order, and store `[]` only when none has wording, to pass T036. No schema, API shape or request change. Describe the placeholder in the snapshot paragraph of `docs/architecture.md` and the `forecast_periods` lines of `docs/src/content/docs/backend/api.md` and `docs/src/content/docs/backend/weather-provider.md` (depends on T036).
- [ ] T010 [US1] In `frontend/src/components/outdoorSummary.ts`, change both summary functions to `(weather, now)` and build the weather part from `forecastOutlook`, to pass T008.
  - Contract step 1: thunder active → `Thundery showers now`, and stop.
  - Step 3, first match: untimed 2-hour thunder → `Thundery showers forecast`; earliest upcoming thunder from either source → `Thundery showers from <start>`; untimed period thunder → `Thundery showers forecast`.
  - Step 4, thunder half: `No storms forecast` only with "at least one period is active or upcoming", "no active, upcoming or unknown period is `missing`", no live or untimed thunder, and a 2-hour forecast that isn't thunder "in any state".
  - Remove `thunderNow`, the old pattern and the `shortenPeriodLabel` import. Leave heat, UV and PSI as they are.
- [ ] T011 [US1] In `frontend/src/theme/sky.ts`, change to `skyState(weather, now)` to pass T009 (depends on T010). Return `calm` first for no weather or a stale reading, then storm from `forecastOutlook(...).stormSky`. Haze, heat and calm keep their rules and order.
- [ ] T012 [P] [US1] In `frontend/src/components/HourlyStrip.tsx`, replace `stale` with a `labels` prop and remove `new Date()`, `singaporeDate` and `periodStartLabel`. It renders only. For empty wording show `Unavailable` and an empty space of the icon's size, hidden from screen readers. Otherwise markup, classes and the empty state don't change.
- [ ] T013 [US1] In `frontend/src/components/Hero.tsx`, take a `now: number` prop and remove its `useNow`. Pass `now` to the summary, and `stripLabels(forecastOutlook(weather, now))` to `HourlyStrip`. Keep the "As of" prefix, muted ink, separators, screen-reader commas and the separate lightning line (depends on T010, T012).
- [ ] T014 [US1] In `frontend/src/components/Layout.tsx`, keep the one `useNow(60_000, weather?.observed_at)` and pass it to `<Hero now={now} />`. Call `skyState(weather, now)` and remove `Layout`'s own stale check, which now lives in `skyState`. Add no timer (depends on T011, T013).
- [ ] T015 [US1] Remove `periodStartLabel`, `periodStartPhrase` and their date parsing from `frontend/src/components/periodLabel.ts`, and their tests from `frontend/src/components/periodLabel.test.ts`. `git grep -nE "thunderNow|periodStartLabel|periodStartPhrase" -- frontend/src` must print nothing (depends on T010–T014).

### Browser check and docs for User Story 1

- [ ] T016 [US1] Create `scripts/e2e/forecast-timing.sh` with the `us1` run, using `scripts/e2e/lib.sh` and the structure of `scripts/e2e/uv-trend.sh` (depends on T015).
  - Stub `GET /api/locations` with `network route`. Register an init script, written under `e2e-artifacts/forecast-timing/`, that shifts `Date` to a target read from an e2e-only `localStorage` key and leaves timers real. Tolerate blocked storage on `about:blank`.
  - Run cases 1–5, 9 and stale, checking `.hero-verdict` (it may be absent), the strip labels and `html[data-sky]`. Stale shows "As of 11:50:". Also run "Missing, rest dry": no weather claim, and the empty slot reads `Unavailable` with no icon.
  - Boundary: open case 3 at 11:59:55 and poll for up to 65 s without reloading. All three change in the same poll within 60 s of midday, with no new `/api/locations` or refresh request in the Resource Timing list.
  - Call `assert_clean` after every open, reload and switch. Leave teardown to the `lib.sh` trap.
- [ ] T017 [P] [US1] Update the Frontend section of `docs/architecture.md`: windows come from clock words plus the reading time, printed dates are ignored, `Layout`'s one clock feeds line, strip and sky, and untimed 2-hour thunder outranks later thunder.
- [ ] T018 [P] [US1] Correct the storm trigger to "a thunder forecast in force, on a fresh reading" in `THEMES.md` (it wrongly says "any 2-hour forecast period") and in the `data-sky` line of `docs/theming.md`. Both also say that a stale reading is calm (`THEMES.md:57`, the Calm rule).
- [ ] T019 [P] [US1] Correct the design docs. Change no token or colour (line numbers as of `cd04418`).
  - `frontend/DESIGN.md:204`: the storm trigger, as in T018, and calm also when stale.
  - `frontend/DESIGN.md:369`: name periods with `periodTimeLabel` from the resolved time, not `periodStartLabel`.
  - `frontend/.impeccable/design.json:785`, `:803` and `:972`: the storm trigger.
  - `frontend/.impeccable/design.json:785`, `:791`, `:972` and `:1000`: calm also when stale.
- [ ] T020 [P] [US1] Add `scripts/e2e/forecast-timing.sh us1` to the browser checks in `docs/testing.md`: what it stubs, how it shifts the clock and what it asserts.
- [ ] T021 [P] [US1] Update `docs/src/content/docs/frontend/overview.md`: the strip and verdict are timed by `Layout`'s clock.
- [ ] T022 [US1] Validate US1: run `npm run verify`, then `scripts/e2e/forecast-timing.sh us1`. `git grep -nE "thunderNow|periodStartLabel|periodStartPhrase|covering now|any 2-hour forecast period|thunder in the current condition" -- frontend/src docs THEMES.md README.md frontend/DESIGN.md frontend/.impeccable/design.json` must print nothing. Record all three results under this task in `specs/018-forecast-summary-timing/tasks.md` (depends on T016–T021).

**Checkpoint**: the MVP. The missed-storm case is fixed and can ship alone. "No storms forecast" can still hide plain rain until US2.

---

## Phase 4: User Story 2 - Forecast rain is named (Priority: P2)

**Goal**: forecast rain is named with its timing, and "No storms forecast" never stands in for it.

**Independent Test**: cases 6–8, where the first period is current, give the required wording and order, and the reassurance matrix has no false all-clear.

### Tests for User Story 2

- [ ] T023 [US2] Add the rain tests to `frontend/src/components/outdoorSummary.test.ts`. They fail on the US1 code, except the dry control and the rows that expect only a thunder part.

  | Case | Read → viewed | 2-hour | Periods | Weather parts |
  |---|---|---|---|---|
  | 6 | 12:10 → 12:30 | Showers, `W` | `B` `C` Showers | `Showers forecast now` (once) |
  | Period rain | 13:50 → 14:00 | Cloudy, `1.30 pm to 3.30 pm` | `B` Light Rain, `C` dry | `Light rain forecast until 6 pm` |
  | 7 | 08:50 → 09:00 | Cloudy, `M` | `A` dry, `B` Showers | `Showers forecast from midday` |
  | 8 | 08:50 → 09:00 | Cloudy, `M` | `A` dry, `B` Showers, `C` thunder | `Showers forecast from midday`, `Thundery showers from 6 pm` |
  | Rain now, thunder later | 12:10 → 12:30 | Showers, `W` | `B` dry, `C` thunder | `Showers forecast now`, `Thundery showers from 6 pm` |
  | Thunder now | 12:10 → 12:30 | Showers, `W` | `B` thunder, `C` Showers | `Thundery showers now` only |
  | Rain after thunder | 08:50 → 09:00 | Cloudy, `M` | `A` dry, `B` thunder, `C` Showers | `Thundery showers from midday` only |
  | Untimed both | none → 12:30 | thunder, `W` | `B` Showers | `Showers forecast`, `Thundery showers forecast` |
  | Ended wet 2-hour | 11:50 → 14:00 | Showers, `W` | `B` `C` dry | none |
  | Until midnight | 18:50 → 19:00 | Cloudy, `6.30 pm to 8.30 pm` | `6 pm to Midnight 23 Nov` Showers | `Showers forecast until midnight` |
  | Until tomorrow | 18:50 → 19:00 | Cloudy, `6.30 pm to 8.30 pm` | `C` Showers | `Showers forecast until tomorrow 6 am` |
  | Drizzle | 12:10 → 12:30 | Drizzle, `W` | `B` dry | `Drizzle forecast now` |
  | Dry control | 12:10 → 12:30 | Cloudy, `W` | `B` `C` dry | `No storms forecast` |
  | Rain run | 13:50 → 14:00 | Cloudy, `1.30 pm to 3.30 pm` | `B` `C` Light Rain | `Light rain forecast until tomorrow 6 am` |
  | Mixed run | 13:50 → 14:00 | Cloudy, `1.30 pm to 3.30 pm` | `B` Light Rain, `C` Showers | `Rain forecast until tomorrow 6 am` |
  | Run meets missing | 13:50 → 14:00 | Cloudy, `1.30 pm to 3.30 pm` | `B` Light Rain, `C` empty | `Light rain forecast` |
  | Run meets untimed | 13:50 → 14:00 | Cloudy, `1.30 pm to 3.30 pm` | `B` Light Rain, unreadable Showers | `Light rain forecast` |
  | Run meets thunder | 13:50 → 14:00 | Cloudy, `1.30 pm to 3.30 pm` | `B` Light Rain, `C` thunder | `Light rain forecast until 6 pm`, `Thundery showers from 6 pm` |
  | Untimed 2-hour rain first | 12:10 → 12:30 | Showers, null | `B` dry, `C` Showers | `Showers forecast` |
  | Untimed 2-hour rain over period | 12:10 → 12:30 | Showers, null | `B` Light Rain, `C` dry | `Showers forecast` |
  | Untimed thunder before later rain | 12:10 → 12:30 | thunder, null | `B` dry, `C` Showers | `Thundery showers forecast` only |
  | Thunder now, untimed rain | 12:10 → 12:30 | Showers, null | `B` thunder, `C` dry | `Thundery showers now` only |
  | Untimed rain, later thunder | 08:50 → 08:55 | Cloudy, `M` | `A` dry, `B` thunder, unreadable Showers | `Showers forecast`, `Thundery showers from midday` |

- [ ] T024 [US2] Add the SC-003 matrix to `frontend/src/components/outdoorSummary.test.ts` (after T023, same file; it fails on the US1 code). Use dry, Showers, thunder and missing for each of the 2-hour forecast (`P`, window `M`), `A` and `B`, read at 09:10 and viewed at 09:20, 11:00 and 12:00, all fresh (192 checks). Missing is `Unavailable` with a null window for `P`, and empty text with the label kept for a period. Compare every weather line with this oracle, written as literals without calling the timing module:

  | Part | 09:20 | 11:00 | 12:00 |
  |---|---|---|---|
  | `Thundery showers now`, alone | `P` or `A` thunder | `A` thunder | `B` thunder |
  | Otherwise rain, first match | 1, 2, 3 | 2, 3 | 4 |
  | Then `Thundery showers from midday` | `B` thunder | `B` thunder | never |
  | If neither, `No storms forecast` | `A` and `B` dry, `P` not wet | `A` and `B` dry, `P` not wet | `B` dry, `P` not wet |
  | Otherwise | none | none | none |

  1. `P` rain → `Showers forecast now`
  2. `A` rain → `Showers forecast until 6 pm` if `B` is rain, `Showers forecast` if `B` is missing, otherwise `Showers forecast until midday`
  3. `B` rain → `Showers forecast from midday`
  4. `B` rain → `Showers forecast until 6 pm`

  Also assert that no part contains "safe", "dry" or "all clear".

### Implementation for User Story 2

- [ ] T025 [US2] Add contract step 2 to `frontend/src/components/outdoorSummary.ts`, to pass T023. Take the first match:
  - a. 2-hour rain active → `<Wording> forecast now`
  - b. 2-hour rain with an unknown time → `<Wording> forecast`
  - c. period rain active, and the period after its run is missing or untimed → `<Wording> forecast`
  - d. period rain active, otherwise → `<Wording> forecast until <end of run>`
  - e. "Earliest upcoming rain, if there is no untimed 2-hour thunder and it starts before any upcoming thunder" → `<Wording> forecast from <start>`
  - f. "Period rain with an unknown time" → `<Wording> forecast`

  A run is "the active rain period and the unbroken timed rain periods after it". `<Wording>` is "NEA's text in sentence case", or `Rain` for a run whose wordings differ. Thunder active still returns alone. Otherwise output the rain part, then the thunder part, with at most one of each.
- [ ] T026 [US2] Complete contract step 4 in `frontend/src/components/outdoorSummary.ts`, to pass T024: no live or untimed rain, and "the 2-hour forecast, in any state, is neither rain nor thunder" (after T025, same file).

### Browser check and docs for User Story 2

- [ ] T027 [US2] Add the `us2` run to `scripts/e2e/forecast-timing.sh`: cases 6–8, the rain run, and rain now with thunder later. Check the text, that rain comes first, and the screen-reader comma between parts (depends on T026).
- [ ] T028 [P] [US2] Add forecast rain to both descriptions of the verdict in `frontend/DESIGN.md` (lines 207 and 284 as of `cd04418`) and state that it is worded as a forecast, never as falling rain.
- [ ] T029 [P] [US2] Add forecast rain to the verdict node in `docs/src/content/docs/frontend/overview.md`, the rain (including runs) and all-clear rules to `docs/architecture.md`, and the `us2` run to `docs/testing.md`.
- [ ] T030 [US2] Validate US2: run `npm run verify`, then `scripts/e2e/forecast-timing.sh us1` and `us2`. Record the results under this task in `specs/018-forecast-summary-timing/tasks.md` (depends on T027–T029).

**Checkpoint**: both reported bugs are fixed.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T031 Add the `themes` run to `scripts/e2e/forecast-timing.sh` and list it in `docs/testing.md`. Run `npm run verify` before running it. At 360 px in all six themes, show both lines, each with heat, UV and PSI:
  - Fresh (read and viewed 22 Nov 18:50; `C` and the next morning Passing Showers, the next afternoon thunder): `Passing showers forecast until tomorrow midday · Thundery showers from tomorrow midday`.
  - Stale (read 22 Nov 05:50, viewed 23 Nov 05:50; `A` Passing Showers, `B` thunder, `C` dry): `As of yesterday 05:50: Passing showers forecast from yesterday 6 am · Thundery showers from yesterday midday`, under the stale notice.

  Check no clipping, no horizontal scroll, the same screen-reader order and a screenshot per theme. Read the screenshots. If it fails, report it before changing any class (FR-019, SC-008).
- [ ] T032 Run `npm run verify`, the whole of `scripts/e2e/forecast-timing.sh`, and the seven scripts from T002. Compare with the baseline. `scripts/e2e/temp-wind.sh` and `scripts/e2e/rain-view.sh` now have a taller line ("Showers forecast"), so check that their map and pin assertions still hold. Both lightning scripts stub thunder with no window, so their line becomes "Thundery showers forecast" and their sky changes from storm to calm. Check that their mark, theme and timing assertions still hold. No process may still hold a port afterwards.
- [ ] T033 Run sections 1–2 of `specs/018-forecast-summary-timing/quickstart.md`, including the Los Angeles run. Confirm that `git diff --name-only --merge-base origin/main -- backend` lists only `backend/src/weather.ts` and `backend/src/weather.test.ts`, that `git ls-files --others --exclude-standard -- backend` prints nothing, that `git diff --stat --merge-base origin/main -- frontend/src/index.css` is empty and that the 12-calls-per-refresh test passes (FR-018, SC-007). Record the results under this task.
- [ ] T034 Ask the owner to run `/weather-code-review` on the diff of `backend/src/`, `frontend/src/` and `scripts/e2e/forecast-timing.sh`. Fix verified findings and repeat T032.
- [ ] T035 After the owner approves the merge and it deploys, go through section 5 of `specs/018-forecast-summary-timing/quickstart.md` with them, including a place saved before the deploy (FR-008). Record the result under this task.

---

## Requirement Coverage

| Requirement | Built by | Checked by |
|---|---|---|
| FR-001 | T005, T007 | T003 |
| FR-002, FR-003 | T010 | T008, T016, T024 |
| FR-004 | T007, T012, T013 | T003, T016 |
| FR-005 | T011, T014 | T009, T016 |
| FR-006 | T013, T014 | T016 |
| FR-007 | T005, T006, T015 | T003, T004 |
| FR-008 | T005 | T003, T035 |
| FR-009, FR-010, FR-011 | T025 | T023, T027 |
| FR-012 | T025, T028 | T023 |
| FR-013 | T010, T026, T037 | T008, T024, T036 |
| FR-014 | T007, T010, T025 | T003, T008, T023 |
| FR-015 | T010, T026 | T008, T024 |
| FR-016 | T007, T011, T013, T014 | T003, T008, T009, T016 |
| FR-017 | T010, T013 | T008, T032 |
| FR-018 | T014 | T016, T033 |
| FR-019 | T013 | T027, T031 |
| FR-020 | T037, T012 | T036, T016 |
| SC-001 | T010, T025 | T008, T016, T023, T027 |
| SC-002 | T007 | T003 |
| SC-003 | T026 | T024 |
| SC-004 | T011, T014 | T009, T016 |
| SC-005 | T014 | T016 |
| SC-006 | T005 | T003 |
| SC-007 | T014 | T033 |
| SC-008 | T013 | T031 |

---

## Dependencies & Execution Order

```text
Setup        T001 ─> T002
                      │
Foundational          ├─> T003, T004 ─> T005, T006 ─> T007
                                                       │
US1 (MVP)    T008, T009, T036 ─> T037 ─> T010 + T012 ─> T011, T013 ─> T014 ─> T015
                                                                               │
                                          T016, T017–T021 <────────────────────┘
                                                 │
                                               T022
                                                 │
US2          T023 ─> T024 ─> T025 ─> T026 ─> T027, T028, T029 ─> T030
                                                                   │
Polish       T031 ─> T032 ─> T033 ─> T034 ─> T035 <────────────────┘ (starts at T031)
```

- **US1** depends only on the foundation.
- **US2** can be tested on its own but not built first: it edits `outdoorSummary.ts`, its tests and the browser script after US1 has changed them.
- **Within a story**: failing tests, then code, then the browser check and docs, then validation.
- `T005` and `T006` can overlap. `T007` needs both.

## Parallel Examples

### Foundational

```text
T003  frontend/src/components/forecastTiming.test.ts
T004  periodLabel.test.ts, outdoorSummary.test.ts (moved tests)
then
T005  frontend/src/components/forecastTiming.ts
T006  periodLabel.ts, outdoorSummary.ts (import only)
```

### User Story 1

```text
T008  frontend/src/components/outdoorSummary.test.ts
T009  frontend/src/theme/sky.test.ts
T036  backend/src/weather.test.ts
then T037 (weather.ts and its docs)
then, alongside T010 (outdoorSummary.ts)
T012  frontend/src/components/HourlyStrip.tsx
then
T011  frontend/src/theme/sky.ts
then, after T015, alongside T016 (forecast-timing.sh)
T017  docs/architecture.md
T018  THEMES.md, docs/theming.md
T019  frontend/DESIGN.md, frontend/.impeccable/design.json
T020  docs/testing.md
T021  docs/src/content/docs/frontend/overview.md
```

### User Story 2

```text
after T026, alongside T027 (forecast-timing.sh)
T028  frontend/DESIGN.md
T029  overview.md, docs/architecture.md, docs/testing.md
```

## Implementation Strategy

### MVP first

1. T001–T007: the foundation, with no visible change.
2. T008–T022, with T036–T037: US1. **Stop and validate.** It fixes the only case that hides a storm already started, so it is worth shipping by itself if US2 is delayed.

### Incremental delivery

1. T023–T030: US2, as a second commit on the same branch, or its own PR if US1 has shipped.
2. T031–T033: width, themes and regressions. If US1 ships alone, run T032 and T033 before that merge too.
3. T034–T035: the owner's review, then the check in production.

### Suggested commits (each green, only when the owner asks)

1. `docs: spec, plan and tasks for forecast timing (spec 018)`
2. `feat: resolve forecast windows from stored labels (spec 018)`: T003–T007
3. `fix: show "now" only while a forecast is in force (spec 018)`: T008–T022, T036–T037
4. `fix: name forecast rain in the summary (spec 018)`: T023–T030
5. `test: forecast summary at phone width in every theme (spec 018)`: T031–T033
