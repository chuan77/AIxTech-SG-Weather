# Data Model: Outdoor Comfort Tiles

Phase 1 output for [plan.md](plan.md). One stored change (pollutant breakdown); two derived, unstored values.

## 1. Pollutant breakdown (stored, part of `WeatherSnapshot`)

New fields on the weather snapshot and matching nullable columns on `locations` (`backend/src/schema.ts`). All default to `null`.

| Snapshot field | Column | Type | Source key in `psi` response (location's region) | Display unit |
|---|---|---|---|---|
| `pm10_twenty_four_hourly` | `pm10_twenty_four_hourly` | real, nullable | `pm10_twenty_four_hourly` | µg/m³ |
| `o3_eight_hour_max` | `o3_eight_hour_max` | real, nullable | `o3_eight_hour_max` | µg/m³ |
| `no2_one_hour_max` | `no2_one_hour_max` | real, nullable | `no2_one_hour_max` | µg/m³ |
| `so2_twenty_four_hourly` | `so2_twenty_four_hourly` | real, nullable | `so2_twenty_four_hourly` | µg/m³ |
| `co_eight_hour_max` | `co_eight_hour_max` | real, nullable | `co_eight_hour_max` | mg/m³ |
| `air_quality_observed_at` | `air_quality_observed_at` | text (ISO 8601), nullable | `items[0].updatedTimestamp` ?? `items[0].timestamp` | shown as SGT time |

Rules:
- Values are coerced with the existing `numberOrNull`; strings and NaN become `null` or numbers, as for other readings.
- The region is the same one already chosen for PSI (`air_quality_region`).
- If the `psi` call fails, all six are `null`; PSI and PM2.5 behave as today (FR-013, FR-015).
- Default (unrefreshed) snapshot and rows created before the migration: all six `null`.
- Units are display-only constants in the frontend; they are not stored. CO's unit is to be confirmed (research R7).

## 2. Feels-like reading (derived, not stored)

Computed on the frontend from `temperature_c`, `humidity_percent`, `wind_speed_knots`, `rainfall_mm` and `condition`.

```text
FeelsLike =
  | { kind: 'value', value: number /* °C, 1 dp */, band: Band, approx: boolean, umbrella: boolean }
  | { kind: 'no-reading', missing: Array<'temperature' | 'humidity'> }

Band = { id: 'chilly' | 'breezy-cool' | 'warm' | 'hot-muggy' | 'scorching', label: string, advice: string }
```

Rules:
- `no-reading` when `temperature_c` or `humidity_percent` is null or not finite; `missing` lists which (FR-005).
- Wind null → computed with 0 m/s and `approx: true` (FR-006). Otherwise `ws = knots × 0.514444`.
- `value = roundHalfUp1(AT)` (research R3); band by inclusive lower bound: `< 24.0` chilly, `< 27.0` breezy-cool, `< 32.0` warm, `< 37.0` hot-muggy, else scorching (FR-003).
- `umbrella = /rain|shower|thunder/i.test(condition) || rainfall_mm > 0.1`; null rainfall counts as false and never blocks the forecast rule (FR-004).
- Labels and advice text are exactly as in the spec's FR-003 table. No label or advice contains "Heat Stress" (FR-007).

## 3. Daylight times (derived, not stored)

Computed on the frontend from `latitude`, `longitude` and the current Singapore calendar date.

```text
DaylightTimes = { date: 'YYYY-MM-DD' /* SGT */, sunrise: Date, sunset: Date }
```

Rules:
- Date is today's date in `Asia/Singapore`, not the browser's time zone.
- Displayed as `HH:MM` in `Asia/Singapore` (FR-008).
- Available for every location, refreshed or not (FR-009).
- Recomputed when the SGT date changes, driven by a 60-second clock tick (FR-010).

## State transitions

None. Stored pollutant fields change only when a location is created or refreshed, exactly like existing snapshot fields.
