# Data Model: WBGT Heat-Stress Tile

## WeatherSnapshot additions (backend `weather.ts`, `schema.ts`; frontend `types.ts`)

| Snapshot field | Column | Type | Meaning |
|---|---|---|---|
| `wbgt_c` | `wbgt_c` | real, nullable | WBGT at the nearest station with a numeric reading (°C) |
| `heat_stress_level` | `heat_stress_level` | text, nullable | NEA label as published (`Low`, `Moderate`, `High`, or other text) |
| `wbgt_station_name` | `wbgt_station_name` | text, nullable | Station `name` (e.g. "Bishan Street") |
| `wbgt_station_distance_km` | `wbgt_station_distance_km` | real, nullable | Great-circle distance from location to station, km |
| `wbgt_observed_at` | `wbgt_observed_at` | text, nullable | Record `datetime` (ISO, +08:00), else `updatedTimestamp` |

Rules:
- All five are null in the default (unrefreshed) snapshot, in both `emptyForecastSnapshot()` / `snapshotFromPayload()` literals, and when the WBGT fetch fails (`fetchOptional` fallback).
- The station is chosen only among readings whose `wbgt` coerces to a finite number; if none, all five are null.
- The backend stores the nearest station regardless of distance; the 10 km rule is applied when displaying (below).
- Migration `0002_*` adds the five nullable columns; no data backfill. `weatherToColumns` and the row → snapshot mapping in `db.ts` gain the five fields.

## HeatStressView (frontend pure module `components/heatStress.ts`, derived, never stored)

`heatStressView(weather) →` one of:

| `kind` | When | Fields shown |
|---|---|---|
| `no-reading` | `wbgt_c` null or non-finite, or station distance null | "No reading" |
| `no-nearby-station` | `wbgt_station_distance_km > 10` | "No nearby station"; tooltip: `Nearest station: {name}, {distance} km away` |
| `reading` | otherwise | `value` (1 dp), `level`, `tone`, `guidance` (string or null), `stationName`, `distanceKm` (1 dp), `observedAt` (SGT `HH:mm`) |

- Order: `no-reading` is checked first, then the distance check (`> 10`; exactly 10.0 counts as near).
- `tone`: `low` | `moderate` | `high` | `unknown`. Level matching is case-insensitive after trimming. Unknown levels show their text as given, with tone `unknown` and no guidance.
- `guidance`: Moderate and High text from [research.md R3](./research.md); null for Low and unknown.
- Constants exported: `WBGT_MAX_STATION_KM = 10`, `HEAT_STRESS_GUIDANCE`.

## ProviderRequester options (backend `providerHttp.ts`)

| Option | Default | Notes |
|---|---|---|
| `requestIntervalMs` | `ceil(10000 / limit) + 50`, where `limit` = `WEATHER_API_RATE_LIMIT` env var if set, else 12 with `apiKey`, 6 without | 884 ms with the Development key, 1717 ms keyless |
| `rateLimitRetryDelayMs` | 10000 | Wait before the single retry after a 429 |

A single instance is created in `createApp` and shared by the weather and lightning clients (`requester` option on both constructors).
