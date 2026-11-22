# Research: Honest Forecast Timing and Rain in the Summary

**Feature**: [spec.md](spec.md) | **Date**: 2026-11-22

Evidence comes from this repo, read-only keyless requests to data.gov.sg, and a throwaway reference version of the rules, which is not committed.

- **24-hour sample**: 199 distinct records from 26 requested dates (2024-07 to 2026-11), including month and year ends.
- **2-hour sample**: 220 records.

## R1. Recover times in the browser from what is already stored

**Decision**: Derive every window from `observed_at`, `valid_period_text` and `forecast_periods[].label`. No schema or API change. The backend stops dropping periods without wording, because the rule depends on their positions.

**Rationale**: It covers snapshots already saved (FR-008), and it is at least as reliable as the provider's timestamps (R3).

**Alternatives considered**:
- *Store `timePeriod.start` and `end`*: needs a migration, doesn't help saved snapshots, and those fields are wrong in some records.
- *Trust the printed dates*: they are wrong often enough to cause case 9.
- *Drop periods on the server at read time*: an open page would not follow the clock (FR-006).
- *Detect a dropped first period in the browser*: it looks the same as a late forecast, so any threshold is wrong for one of them.

## R2. The resolution rule

**Decision**:
1. Read only the clock words of a label. A trailing date is allowed and ignored.
2. Place the first period, and separately the 2-hour window, at the **latest occurrence of its start that is no later than `observed_at` + 2 hours**. Its end is the next occurrence of the end clock time after that start.
3. Each later period starts at the previous end. If its start clock time doesn't equal that end, it and all periods after it have unknown times.
4. An unreadable label or a missing reading time gives an unknown time. A window is never guessed. A period without wording still resolves from its label. The first stored period must be the first issued, which FR-020 guarantees for new snapshots.
5. All arithmetic uses fixed UTC+8, independent of the device's zone. Singapore has no daylight saving.

**Rationale**: The first period starts at most 49 minutes after issue in the sample, and the 2-hour window 6–37 minutes before it. The 2-hour allowance covers both. Results were identical with the reading time 0, 1, 3 and 6 hours after issue, which matters because `observed_at` is the newest timestamp of all sources, not the forecast's own.

**Alternatives considered**: *nearest occurrence* is ambiguous in the 12-hour gap of the night period. *Anchor on the time of viewing* moves windows as time passes.

## R3. How well the rule works on real data

The 2-hour rule matched the provider's start and end in **220 of 220** records. For the 24-hour forecast, compared on month, day and time (some provider years are wrong):

| Result | Records | Reading |
|---|---|---|
| Same as the provider's timestamps | 176 | Correct |
| Provider's periods jump a month or a day | 13 | The rule keeps them consecutive |
| Provider's periods are a whole day ahead of issue | 4 | The rule puts the first in force at issue |
| Archive record updated days later | 5 | Matches when anchored on the record's own timestamp. Can't occur in a live snapshot. |
| Provider's clock words contradict its timestamps (2026-09-30 23:41) | 1 | **Truth unknown.** The rule follows the words. |
| Label unreadable | 0 | |

A live snapshot on 2026-11-22 had `observed_at` 3 minutes before the request and labels in the expected formats. Production rows were not read.

## R4. Formats and vocabulary

- **24-hour clock words**: `Midnight`, `6 am`, `Midday`, `6 pm`, in five layouts. Four are the daily ones in SC-002. The fifth, seen once in an archive record, is a lone `Midnight to 6 am`, which the test sweep also covers.
- **2-hour**: 48 texts on half-hours, such as `11.30 pm to 1.30 am`, `10.00 pm to Midnight` and `Midday to 2.00 pm`.
- The parser also accepts `12pm`, `6:30 pm` and a year after the date, as found in repo fixtures.

**Decision**: Classify wording with the existing `conditionToIcon` (`thunder`, `rain`, other). It already matches FR-009, checks thunder first and is what the icons use.

**Alternatives considered**: a list of exact NEA strings silently misses new wording. `feelsLike.ts`'s pattern misses drizzle.

## R5. One outlook and one clock for all three surfaces

**Decision**: A pure `forecastOutlook(weather, now)` feeds the top line, strip and sky. `Layout` owns the minute tick and passes `now` to `Hero`, which drops its own timer.

**Rationale**: Today `Layout` and `Hero` have separate timers and `HourlyStrip` reads `new Date()` itself. With boundaries that matter, they could disagree (SC-004). One call costs about 0.07 ms, so no memoisation is needed.

**Alternatives considered**: a clock in the store adds shared state that only this screen needs. A timer aimed at the next boundary adds code when a minute already meets SC-005.

## R6. Naming days and midnight

**Decision**: Format from the resolved instant, relative to the day of viewing. Midnight belongs to the day it ends, so tonight's is "midnight", not "tomorrow midnight". See [the contract](contracts/forecast-display.md#time-words).

**Alternatives considered**: keep `periodStartLabel(label, today)`, which reads the faulty printed date.

## R7. Precedence where forecasts overlap

The spec now states each of these.

| Point | Reading used | Why |
|---|---|---|
| Thunder is in force and untimed rain exists (FR-010, FR-014) | Only "Thundery showers now" | Story 2 scenario 6. The stronger warning stands alone. |
| Untimed rain with a thunder part | Rain part first | One order for every two-part line (FR-011) |
| Untimed 2-hour thunder and later timed thunder | "Thundery showers forecast" | It may apply now (FR-003) |
| Untimed 2-hour rain and timed period rain | "<wording> forecast" | It may apply now and may outlast the period (FR-010) |
| Untimed 2-hour thunder and rain still to come | No timed rain part | The thunder may come first (FR-010) |
| Rain in consecutive periods | "until" the end of the run, as "Rain" if the wordings differ | An earlier end reassures falsely, and "Light rain" can't describe a run with heavier rain (FR-009, FR-010) |
| The run meets a missing or untimed period | No end | The end isn't known (FR-010) |
| A later timed rain is left out because thunder is earlier, and untimed rain also exists | Show "<wording> forecast" | FR-010 item 5 |
| 2-hour window still to come (device clock behind the reading) | Can be named with "from" | FR-003 and FR-010 cover both sources. Omitting it would hide a warning. |
| Stale reading | States are judged at the reading time, words relative to the viewing day, never "Now" or storm sky | FR-016 |
| Period with an unknown time in the strip | Its raw start text without the year | FR-004, without inventing a day |

## R8. Effect on what people will see

The rules were run on 995 real record-and-region pairs at issue time, assuming a dry 2-hour forecast.

| Top line | Pairs |
|---|---|
| Thunder only | 465 |
| No storms forecast | 338 |
| Rain only (says "No storms forecast" today) | 110 |
| Rain then thunder (shows only thunder today) | 77 |
| No weather part | 5 |

About **1 in 4** of today's "No storms forecast" lines in this sample (110 of 448) hide forecast rain. The sample is not weighted by season or time of viewing. The counts are the same under the revised precedence. Once a period has started, 24 of 213 sampled "until" lines that had a following period (11%) were followed by more rain.

The longest line seen at issue time was "Moderate rain forecast until tomorrow 6 am · Thundery showers from tomorrow midday". Combining the sampled rain wordings over the five layouts gives longer ones, which are the SC-008 fixtures:

- Fresh (86 characters): "Passing showers forecast until tomorrow midday · Thundery showers from tomorrow midday"
- Stale (108): "As of yesterday 05:50: Passing showers forecast from yesterday 6 am · Thundery showers from yesterday midday"

## R9. Testing the clock in a browser

**Decision**: A new `scripts/e2e/forecast-timing.sh` stubs `GET /api/locations` and registers an init script that shifts `Date` by an offset, leaving timers real.

**Rationale**: Tried with agent-browser 0.42.0: a page started at 11:59:56 read 12:00:02 six seconds later, with no page or console errors.

**Alternatives considered**: a DOM test environment is outside constitution Principle IV. Fixtures relative to the real time can't pin the named cases.

## R10. Effect on existing tests and checks

- `outdoorSummary.test.ts`, `sky.test.ts` and `periodLabel.test.ts` encode the old behaviour (first period is now, printed date is true) and need fixtures with a reading time and clock.
- Seven browser scripts stub a snapshot under the top line and are re-run. `temp-wind.sh` and `rain-view.sh` stub "Showers" with no window, so their line gains "Showers forecast" and grows taller. `lightning-markers.sh` and `lightning-grouping.sh` stub thunder with no window, so their line becomes "Thundery showers forecast" and their sky changes from storm to calm. `town-search.sh` and `use-my-location.sh` stub no snapshot and don't check the line.
- `THEMES.md` already misdescribes the storm trigger ("any 2-hour forecast period") and gets corrected.
- `backend/src/weather.test.ts` gains the placeholder tests. The existing suite passed with the mapping changed on a scratch copy.
