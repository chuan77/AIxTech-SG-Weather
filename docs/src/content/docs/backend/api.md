---
title: HTTP API
description: Every route served by the Express app, with request and response shapes.
sidebar:
  order: 1
---

All API routes are under `/api` except `/health`. Errors return JSON `{ "detail": string }`. Unhandled errors return `500 { "detail": "Internal server error" }` and are logged.

| Method | Path | Calls data.gov.sg | Success |
| --- | --- | --- | --- |
| `GET` | `/health` | no | `200 { "status": "healthy" }` |
| `GET` | `/api/locations` | no | `200 { "locations": Location[] }` |
| `POST` | `/api/locations` | yes | `201 Location` |
| `GET` | `/api/locations/:id` | no | `200 Location` |
| `DELETE` | `/api/locations/:id` | no | `204` |
| `POST` | `/api/locations/:id/refresh` | yes | `200 Location` |
| `POST` | `/api/lightning/refresh` | yes, at most every 2 minutes | `200 LightningObservation` |
| `POST` | `/api/logs` | no | `204` |

## Locations

### `GET /api/locations`

Lists saved locations, newest first (`created_at DESC, id DESC`). Reads SQLite only. The frontend treats the first entry as the "Home" location.

### `POST /api/locations`

```json
{ "latitude": 1.35, "longitude": 103.85 }
```

| Status | When |
| --- | --- |
| `201` | Saved. Body is the location with its first snapshot, or with the default snapshot if the weather fetch threw. |
| `409` | A location with exactly these coordinates already exists. |
| `422` | `latitude`/`longitude` missing or not numeric, or outside Singapore (lat 1.1 to 1.5, lon 103.6 to 104.1). |

### `GET /api/locations/:id`

`200` with the location, or `404 Location not found`.

### `DELETE /api/locations/:id`

`204` on success. `404` if the id is not a positive safe integer or no row matched.

### `POST /api/locations/:id/refresh`

Fetches a new snapshot and overwrites the stored one.

| Status | When |
| --- | --- |
| `200` | Updated location. Individual readings may be `null` if their upstream call failed. |
| `404` | Unknown id. |
| `502` | The weather client threw `WeatherProviderError` (see [Data flow](/architecture/data-flow/#refreshing-a-location)). |

## Lightning

### `POST /api/lightning/refresh`

`POST` rather than `GET` because it is an explicit user action, never a page-load read.

| Status | When |
| --- | --- |
| `200` | Observation. `stale: true` means the latest fetch failed and this is the previous cached window. |
| `502` | `Lightning data is currently unavailable`: the fetch failed and nothing was cached. |

## Logs

### `POST /api/logs`

```json
{ "event": "location_created", "metadata": { "locationId": 3 }, "page": "/" }
```

`event` must match `^[a-z][a-z0-9_.:-]{1,63}$`, otherwise `422 event is required`. `metadata` is kept only if it is an object, `page` only if it is a string.

## Types

```ts
interface Location {
  id: number;
  latitude: number;
  longitude: number;
  created_at: string; // ISO, seconds precision, UTC without "Z"
  weather: WeatherSnapshot;
}

interface WeatherSnapshot {
  condition: string | null;          // 2-hour forecast text for the nearest area
  observed_at: string | null;        // latest timestamp across all sources
  source: string | null;             // "api-open.data.gov.sg" or "not-refreshed"
  area: string | null;               // nearest 2-hour forecast area name
  valid_period_text: string | null;
  temperature_c: number | null;      // nearest station
  humidity_percent: number | null;
  rainfall_mm: number | null;
  wind_speed_knots: number | null;
  wind_direction_degrees: number | null;
  forecast_low_c: number | null;     // 24-hour forecast, island-wide
  forecast_high_c: number | null;
  uv_index: number | null;           // island-wide
  psi_twenty_four_hourly: number | null; // nearest region
  pm25_one_hourly: number | null;
  air_quality_region: string | null;
  pm10_twenty_four_hourly: number | null;
  o3_eight_hour_max: number | null;
  no2_one_hour_max: number | null;
  so2_twenty_four_hourly: number | null;
  co_eight_hour_max: number | null;
  air_quality_observed_at: string | null;
  wbgt_c: number | null;                  // NEA WBGT, nearest station (°C)
  heat_stress_level: string | null;       // NEA label: Low | Moderate | High
  wbgt_station_name: string | null;
  wbgt_station_distance_km: number | null; // great-circle km, kept even when far
  wbgt_observed_at: string | null;
  forecast_periods: { label: string; forecast: string }[];   // 24-hour periods, nearest region
  daily_forecast: {
    date: string;
    forecast: string;
    temperature_low_c: number | null;
    temperature_high_c: number | null;
  }[];                                                        // 4-day outlook
}

interface LightningObservation {
  strikes: LightningStrike[]; // newest first, last 60 minutes
  window_minutes: 60;
  fetched_at: string;
  provider_updated_at: string | null;
  stale: boolean;
}

interface LightningStrike {
  id: string;
  latitude: number;
  longitude: number;
  occurred_at: string;
  type: string;
  label: string;
}
```

The frontend mirrors these in `frontend/src/types.ts`. Keep both in sync when changing a field.
