# Data Model: Persist Saved Locations

No schema change. Source of truth: `backend/src/schema.ts` (table `locations`), migration `backend/drizzle/0000_dusty_gladiator.sql`.

## Saved Location (`locations` row)

| Field | Column | Type | Rules |
|-------|--------|------|-------|
| id | `id` | integer PK autoincrement | Monotonic; used as the ordering tiebreaker. |
| latitude | `latitude` | real, not null | 1.1 to 1.5 inclusive (FR-003). |
| longitude | `longitude` | real, not null | 103.6 to 104.1 inclusive (FR-003). |
| created_at | `created_at` | text, not null | UTC ISO string truncated to seconds. |

**Uniqueness**: unique index `locations_latitude_longitude_unique` on (latitude, longitude) (FR-002).

**Ordering**: `created_at DESC, id DESC` (FR-006).

No user-entered name; the display label is `weather.area` (clarification 1).

## Weather Snapshot (columns on the same row)

Belongs to exactly one Saved Location by being stored on its row, so deleting the location deletes the snapshot (FR-009). Replaced wholesale by `updateWeather` on refresh.

Scalar columns: `condition`, `observed_at`, `source`, `area`, `valid_period_text`, `temperature_c`, `humidity_percent`, `rainfall_mm`, `wind_speed_knots`, `wind_direction_degrees`, `forecast_low_c`, `forecast_high_c`, `uv_index`, `psi_twenty_four_hourly`, `pm25_one_hourly`, `air_quality_region`. JSON columns (not null): `forecast_periods`, `daily_forecast`.

## State transitions

```text
(none) --POST valid coords--> Saved, Not refreshed   (condition 'Not refreshed', source 'not-refreshed')
Saved, Not refreshed --first refresh ok--> Saved, Refreshed
Saved, Not refreshed --first refresh fails--> Saved, Not refreshed   (FR-011; retry via POST /:id/refresh)
Saved, Refreshed --POST /:id/refresh--> Saved, Refreshed (snapshot replaced)
Saved, * --DELETE--> (none)   (row and snapshot removed)
```

## Validation rules mapped to requirements

- Coordinates parse as numbers, else 422 (FR-003).
- Coordinates inside the Singapore box, else 422 (FR-003).
- Pair not already stored, else 409 (FR-002).
