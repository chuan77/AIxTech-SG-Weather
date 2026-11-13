---
title: Storage
description: SQLite through Drizzle, the locations table, and migrations.
sidebar:
  order: 3
---

`backend/src/db.ts` uses Node's built-in `node:sqlite` (`DatabaseSync`) behind Drizzle's `sqlite-proxy` driver. There is no native SQLite package to compile.

```mermaid
flowchart LR
  Routes["routes/locations.ts"] --> Helpers["db.ts helpers<br/>listLocations, createLocation,<br/>getLocation, updateWeather,<br/>deleteLocation"]
  Helpers --> Drizzle["Drizzle ORM<br/>sqlite-proxy driver"]
  Drizzle --> Callback["sqliteCallback(sql, params, method)"]
  Callback --> Node["node:sqlite DatabaseSync"]
  Node --> File[("backend/weather.db<br/>WAL mode")]
  Migrations["backend/drizzle/*.sql"] -. "migrate() at import" .-> Node
```

## Database file

- Path: `DATABASE_PATH`, or `backend/weather.db` relative to the working directory. The parent folder is created if missing.
- `PRAGMA journal_mode = WAL`, so you will also see `weather.db-wal` and `weather.db-shm`.
- `npm run reset` deletes all three files.

## Startup and migrations

`db.ts` opens the database and runs migrations from `backend/drizzle/` with top-level `await` when it is first imported. Any failure is logged as `could not open or migrate the database` and rethrown, so the server exits non-zero. The file is never deleted or recreated, so saved locations survive a bad migration.

To change the schema:

```bash
# 1. edit backend/src/schema.ts
npm run db:generate   # writes backend/drizzle/NNNN_*.sql and meta/
# 2. restart npm run dev; the migration applies on startup
```

## The `locations` table

One row per saved location. The latest snapshot is stored in the same row, one column per reading. The two list fields are JSON text.

```mermaid
erDiagram
  LOCATIONS {
    integer id PK "autoincrement"
    real latitude "not null"
    real longitude "not null"
    text created_at "not null"
    text condition
    text observed_at
    text source
    text area
    text valid_period_text
    real temperature_c
    real humidity_percent
    real rainfall_mm
    real wind_speed_knots
    real wind_direction_degrees
    real forecast_low_c
    real forecast_high_c
    real uv_index
    real psi_twenty_four_hourly
    real pm25_one_hourly
    text air_quality_region
    real pm10_twenty_four_hourly
    real o3_eight_hour_max
    real no2_one_hour_max
    real so2_twenty_four_hourly
    real co_eight_hour_max
    text air_quality_observed_at
    text forecast_periods "JSON, not null"
    text daily_forecast "JSON, not null"
  }
```

A unique index `locations_latitude_longitude_unique` on `(latitude, longitude)` stops duplicates.

## Data access helpers

| Function | Behaviour |
| --- | --- |
| `listLocations()` | All rows, `created_at DESC, id DESC` |
| `createLocation(lat, lon)` | Checks for a duplicate, then inserts with the default snapshot. A duplicate, including one that slips past the check under concurrency and hits the unique index, throws an error named `DuplicateLocationError` (mapped to `409`). |
| `getLocation(id)` | One row or `null` |
| `updateWeather(id, snapshot)` | Overwrites every snapshot column, returns the updated record |
| `deleteLocation(id)` | `true` if a row was removed |
| `resetStore()` | Test helper: deletes all rows and resets the autoincrement |
| `closeDatabase()` | Test helper: closes the handle |

Rows are converted to API records by `rowToRecord`, which nests the snapshot columns under `weather` with snake_case keys.
