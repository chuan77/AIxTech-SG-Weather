# Data Model: Honest Forecast Timing and Rain in the Summary

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

No column, migration or API field changes. A stored period may now have an empty `forecast` (FR-020). Everything below the first table is derived in the browser on each render and never saved.

## Inputs (existing `WeatherSnapshot`)

| Field | Use | When absent or bad |
|---|---|---|
| `observed_at` | Anchor for both window types, and freshness | Every window is unknown |
| `condition` | 2-hour forecast wording | Not rain, not thunder |
| `valid_period_text` | 2-hour window clock words | That window is unknown |
| `forecast_periods[].label` | Period clock words, in order | That period and those after it are unknown |
| `forecast_periods[].forecast` | Period wording | Keeps its window. Not rain, not thunder and not evidence of dry weather. |

The other input is `now`, in milliseconds, from the one clock in `Layout`.

## ForecastWindow

| Field | Type | Rule |
|---|---|---|
| `start` | instant (ms) | Inclusive. Resolved by research R2. |
| `end` | instant (ms) | Exclusive. Always after `start`, and less than 24 hours after it. |

A window depends only on the snapshot, never on `now`. In a resolved chain, each `start` equals the previous `end`.

## TimedForecast

| Field | Type | Rule |
|---|---|---|
| `source` | `two-hour` or `period` | Decides "now" or "until" for rain in force |
| `label` | string | Raw text, for the fallback strip label |
| `text` | string | NEA's wording |
| `kind` | `thunder`, `rain` or `other` | From `conditionToIcon` |
| `missing` | boolean | A period whose trimmed text is empty |
| `window` | ForecastWindow or null | Null means the time is unknown |
| `state` | see below | Judged at `at` |

### State

| State | Condition | May say |
|---|---|---|
| `unknown` | no window | "<wording> forecast" only |
| `upcoming` | `at < start` | "from <start>" |
| `active` | `start <= at < end` | "now". Period rain: "until" the end of its run, or no time if that end is unknown. |
| `ended` | `at >= end` | Nothing. A wet 2-hour forecast still blocks "No storms forecast". |

With a moving clock the only transitions are `upcoming → active → ended`. `unknown` changes only after a refresh.

## ForecastOutlook

| Field | Type | Rule |
|---|---|---|
| `now` | instant | Time of viewing, for day words |
| `at` | instant | `now`, or the reading time when stale |
| `fresh` | boolean | `readingFreshness(...).kind === 'fresh'` |
| `nearTerm` | TimedForecast | The 2-hour forecast |
| `periods` | TimedForecast[] | Same length and order as stored |
| `thunderActive` | boolean | Any thunder is `active`. Drives "Thundery showers now". |
| `stormSky` | boolean | `fresh && thunderActive` |

## Invariants

1. At most one period is `active`.
2. `stormSky` is true exactly when a fresh reading's line says "Thundery showers now".
3. No reading time means nothing is `active`.
4. A strip label is "Now" only if `fresh` and that period is `active`.
5. The same inputs give the same outlook in every device time zone.
6. A `missing` period never moves another period's window.
