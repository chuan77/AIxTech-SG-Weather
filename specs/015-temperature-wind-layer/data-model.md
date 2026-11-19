# Data Model: Temperature and Wind on the Full-Screen Map

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Nothing in this feature is stored. There is no SQLite table, no `WeatherSnapshot` field and no migration (FR-011). One observation is held in server memory for 2 minutes. The browser keeps its last copy in the store for as long as the page is open.

## TempWindStation (backend → frontend)

A station's current conditions. It is not tied to any saved place.

| Field | Type | Rules |
|---|---|---|
| `id` | string | The provider's station ID, for example `S109`. Unique within an observation; the three measures are joined on it. |
| `name` | string \| null | The provider's name. `null` when empty or equal to `id` (S199); the UI shows "Station S199". |
| `latitude` | number | A finite number of at most 90 in absolute value. A station with invalid coordinates is dropped. |
| `longitude` | number | A finite number of at most 180 in absolute value. |
| `temperature_c` | number \| null | From 10 to 45 °C, rounded to 0.1. `null` when missing, out of range, or when the temperature measure failed. |
| `wind_speed_knots` | number \| null | From 0 to 150. `null` when missing or out of range, or when wind failed. |
| `wind_direction_deg` | number \| null | From 0 to under 360, the direction the wind comes **from** (360 becomes 0). `null` when missing or out of range, or when wind failed. |

A station appears when it has valid coordinates and is listed by at least one measure that loaded. A station listed with no values at all still appears, with every value `null`, so it is shown as "no reading".

## IslandConditionsObservation (backend → frontend)

One shared, short-lived set for the whole island. It is the 200 body of [`POST /api/temp-wind/refresh`](contracts/temp-wind-refresh.md).

| Field | Type | Rules |
|---|---|---|
| `stations` | TempWindStation[] | Sorted by `id` for stable rendering. |
| `measures.temperature` | `'ok'` \| `'unavailable'` | `'unavailable'` when the `air-temperature` request failed. |
| `measures.wind` | `'ok'` \| `'unavailable'` | `'unavailable'` when either the `wind-speed` or the `wind-direction` request failed. |
| `temperature_at` | string \| null | The provider timestamp (SGT ISO) of the temperature reading. `null` when it is unavailable. |
| `wind_at` | string \| null | The older of the speed and direction timestamps. `null` when wind is unavailable. |
| `fetched_at` | string | The server time of the provider fetch (UTC ISO). |
| `stale` | boolean | `true` when a previous observation is being served because the latest fetch failed completely. |

Invariant: at least one measure is `'ok'`. If none is, the client throws, which becomes a stale copy or a 502 (research R2).

## Frontend-only derived values (pure, in `tempWindHelpers.ts`)

| Value | Derived from | Rules |
|---|---|---|
| `windKmh` | `wind_speed_knots × 1.852` | Rounded to a whole number for display. |
| `windLevel` | `windKmh` | `calm` under 2; `light` from 2 to under 20; `moderate` from 20 to under 39; `strong` from 39 up (research R4). |
| `arrowRotation` | `wind_direction_deg` | `(deg + 180) mod 360`, so the arrow points the way the wind is blowing toward. |
| `compassPoint` | `wind_direction_deg` | One of 16 points, for example "SW". Used in "From SW (228°)". |
| `readingTime` | `temperature_at`, `wind_at` | The older of the two that aren't null. |
| `isOutOfDate` | `readingTime`, `stale`, now | `true` when `stale`, or when `readingTime` is more than **15 minutes** before now (research R3). |
| `markKind` | the station's values | `{ wind: 'arrow' \| 'calm' \| 'missing', temp: 'value' \| 'missing' }`. |

## TempWindState (store slice, mirrors `rain`)

| Field | Type | Notes |
|---|---|---|
| `enabled` | boolean | Saved in `localStorage` under `weather-starter.tempWind.enabled`; defaults to `false` (FR-007, FR-008). |
| `status` | `'idle'` \| `'loading'` \| `'ready'` \| `'unavailable'` | `idle` until the user acts. A remembered "on" shows the "Show latest temperature & wind" prompt. |
| `observation` | IslandConditionsObservation \| null | Kept on failure (FR-012, FR-013). |
| `setEnabled(on)` | action | Turning the view on asks for data, unless there is a copy under 2 minutes old. |
| `refresh()` | action | It has an in-flight guard and reuses a copy under 2 minutes old. |
| `legendSeen` | boolean | Saved in `localStorage` under `weather-starter.tempWind.legendSeen`. The legend opens by itself once. |

## State transitions (frontend status)

```text
idle ──(turn on / prompt / refresh)──▶ loading
loading ──200──▶ ready            (stale:true → ready, shown as out of date)
loading ──502 / network──▶ unavailable   (earlier observation kept on screen if any)
ready | unavailable ──(refresh, copy ≥ 2 min old)──▶ loading
any ──(turn off)──▶ status kept, layer hidden; no request
```
