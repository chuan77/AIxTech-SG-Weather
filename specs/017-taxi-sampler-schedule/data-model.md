# Data Model: Taxi-rain study samples on time

## Slot

- **Key**: `run_at_utc` rounded down to the quarter hour in UTC, as ISO text, for example `2026-11-20T09:15:00Z`.
- **Range**: from `2026-11-18T13:45:00Z` (the slot of the first row) up to but not including `STUDY_END` (`2026-12-02T16:00:00Z`). That is about 1,393 slots.
- **Rule**: each slot has at most one row across both files. A live row wins over a backfilled one, and the backfill skips any slot that already has a live row.

## Sample row (unchanged)

The header and columns in `scripts/research/taxi-rain-sample.mjs` `HEADER` stay exactly the same (FR-003):

`run_at_utc, taxi_timestamp, taxi_total, rain_timestamp, rain_stations_reporting, rain_stations_wet, {spot}_taxis_1km, {spot}_rain_mm, {spot}_rain_station_km` for each of `raffles, orchard, tampines, jurongwest, woodlands`, then `errors`.

| File (on `research/taxi-rain-data`) | Written by | `run_at_utc` means |
|---|---|---|
| `taxi-rain.csv` | live sampler (workflow) | the actual run time |
| `taxi-rain-backfill.csv` (new) | backfill script, run once locally, then pushed | the slot start, used as the past time requested |

- In both files, `taxi_timestamp` and `rain_timestamp` are the sources' own times. Analysis should prefer these over `run_at_utc`.
- If a source has no value for a slot, its columns are left empty and `errors` gets a note. No values are interpolated.

## Trigger

| Field | Value |
|---|---|
| Host | cron-job.org (owner account) |
| Pace | every 15 min, timezone Asia/Singapore |
| Target | the GitHub dispatch endpoint ([contracts/dispatch-request.md](contracts/dispatch-request.md)) |
| Credential | fine-grained PAT: this repository only, Actions read and write, expires 2026-12-04 |
| Backup | GitHub `schedule: */15`, kept, with the slot check |
| End of life | job disabled and token revoked by 2026-12-04 (SC-006) |

## Health summary (derived, not stored)

`last_sample_utc`, `minutes_since_last`, `samples_last_24h`, `largest_gap_last_24h_min`, and `slot_coverage_pct` from study start to now, counting live and backfilled rows separately.
