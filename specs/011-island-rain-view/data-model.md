# Data Model: Island-wide Rain on the Map

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Nothing here is stored in SQLite (FR-010). No schema change or migration is needed.

## IslandRainObservation (server memory → `POST /api/rain/refresh` response)

One shared, short-lived set of readings for the whole island. The server caches one instance for 2 minutes.

| Field | Type | Rule |
|---|---|---|
| `stations` | `RainStationReading[]` | Every listed station with valid coordinates. Sorted by `id` so the order is stable. |
| `window_minutes` | `15` | Constant. |
| `window_end` | ISO string \| null | Anchor time `T`, the newest usable period's timestamp from the source (research R2). `null` only when no usable period exists. |
| `window_start` | ISO string \| null | `T − 15 min` (exclusive start). `null` together with `window_end`. |
| `periods_found` | 0–3 | How many of the three periods were present in the response. |
| `fetched_at` | ISO string | When the server fetched from the provider. |
| `stale` | boolean | `true` when this is a previous snapshot served after a provider failure. |

**Validation**
- If `window_end` is null, the observation is **unavailable**, not "no rain". The route returns 502 unless it has a stale snapshot to serve.
- If every station has `periods_covered = 0`, the observation is also unavailable (spec Edge Case "Every station missing").

## RainStationReading

| Field | Type | Rule |
|---|---|---|
| `id` | string | Station id from the source (for example `S111`). |
| `name` | string | Station name from the source. |
| `latitude`, `longitude` | number | From the source `location`. Stations with missing or non-finite coordinates are left out. |
| `total_mm` | number \| null | Sum of the station's numeric values over the covered periods, rounded to 0.1 mm. `null` when `periods_covered = 0`. |
| `periods_covered` | 0 \| 1 \| 2 \| 3 | How many of the three window periods have a numeric value for this station. |

Derived on the frontend only (pure `rainHelpers.ts`, not sent):
- **coverage**: `full` (3), `partial` (1–2, "N×5 of 15 min"), `none` (0, "no reading").
- **level**: see HeavinessLevel. Only computed when coverage is not `none`.

## HeavinessLevel (frontend constant, research R4)

| Level | 15-min total | Hourly-rate equivalent | Symbol |
|---|---|---|---|
| `dry` | 0 mm | 0 | small hollow ring |
| `light` | > 0 and < 0.6 mm | < 2.5 mm/h | small filled drop |
| `moderate` | ≥ 0.6 and < 2.5 mm | 2.5–10 mm/h | medium drop |
| `heavy` | ≥ 2.5 mm | ≥ 10 mm/h | large drop, thick outline |
| (missing) | no reading | — | dashed ring with "–" |

Partial coverage keeps the symbol for its level and adds a notch badge. The total is never scaled up from fewer periods.

## RainStatus (frontend, store)

`idle | loading | ok | empty | unavailable`, mirroring `LightningStatus`, plus a derived **out-of-date** flag.

| From | Event | To |
|---|---|---|
| any (page load) | — | `idle` (no fetch, even if the remembered choice is "on") |
| `idle` / `ok` / `empty` / `unavailable` | user turns rain on, taps prompt or refresh, and the client copy is older than 2 min or missing | `loading` (earlier readings kept on screen) |
| `loading` | 200, some station > 0 mm | `ok` |
| `loading` | 200, all covered stations 0 mm | `empty` ("No rain in the last 15 minutes") |
| `loading` | 200 with `stale: true`, or 502, or network error | `unavailable` (earlier readings kept, marked out of date) |
| any | user turns rain off | the layer is hidden and the status is kept; turning rain back on within 2 min reuses the data |

**Out of date** is true when `observation.stale`, or when `now − window_end > 20 min` (research R3).

## RainPreference (browser `localStorage`)

- Key `weather-starter.rain.enabled`, value `"true"` or `"false"`. When missing or unreadable it means **off** (FR-007). Reads and writes are wrapped in try/catch, as lightning's are.

## RainTiming (diagnostics only, not shown in the UI)

Same shape as `LightningTiming`, with `stations` in place of `strikes`:
- `served`: `cache`, `shared` or `fetch`;
- `totalMs`, `providerMs`, `pages`, `requests`;
- `pacingWaitMs`, `retries`, `retryWaitMs`;
- `stations`, `outcome` and a fixed `errorKind`.

It is logged once per call and sent as a `Server-Timing` header. It contains only numbers and enums, never URLs or keys.
