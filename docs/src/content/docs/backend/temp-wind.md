---
title: Temperature and wind
description: The on-demand island-wide temperature and wind client, how it joins three datasets, its cache and fixture.
sidebar:
  order: 6
---

Island-wide air temperature and wind (spec 015) is the third weather call outside a location create or refresh, under the same constitution exception as lightning and rain (Principle I, 1.6.0). It is never stored in SQLite or in any location's snapshot, and the frontend shows it on the full-screen map only.

`backend/src/tempWind.ts` exports `SingaporeTempWindClient`, which implements:

```ts
interface TempWindClient {
  getIslandConditions(
    now?: Date,
    timing?: Partial<TempWindTiming>,
  ): Promise<IslandConditionsObservation>;
}
```

`routes/tempWind.ts` exposes it as `POST /api/temp-wind/refresh`. Inject a different client with `createApp({ tempWindClient })`.

## Three requests, one join

- **Latest readings.** `GET /v2/real-time/api/air-temperature`, `…/wind-speed` and `…/wind-direction`, with no `date`, each return the newest complete minute (about 2.6 KB each; 17 stations per measure in November 2026). The three start together at `priority: 'high'`, so they queue back to back in the shared requester (about 1.8 s of pacing on the Development key) instead of waiting behind a location refresh.
- **Join by station id.** A station appears when it has valid coordinates and is listed by at least one measure that loaded. The station sets overlap but differ (temperature only, wind only), so each station keeps what it has and the rest is `null`. A name that is empty or just the id (S199) becomes `null`; the UI shows "Station S199".
- **Plausible values.** Temperature 10–45 °C (rounded to 0.1), speed 0–150 knots, direction 0–360° (360 becomes 0). Anything else, or a non-number, is `null`. Speed and direction are kept independently; the UI draws an arrow only when it has both.
- **Each measure on its own.** `measures.temperature` is `'unavailable'` when its request failed or held no reading; `measures.wind` when either wind request did. A failed measure is `null` at every station and is never filled from an older observation, so one view never mixes ages. `temperature_at` is the temperature reading's time; `wind_at` is the older of the speed and direction times.
- **Unusable.** No measure loaded, or no station with any value, is a `WeatherProviderError`.

## Cache and failure

The same states as rain: one observation per client, shared by every caller, fresh for 2 minutes; concurrent callers share one load. A partial result (one measure failed) is cached as normal. When all three requests fail it serves the previous observation with `stale: true` (200), and with nothing cached the route returns `502 { "detail": "Temperature and wind data is currently unavailable" }`. A total failure is remembered for 2 minutes, so an outage or a 429 can't turn repeated presses into repeated provider calls. No per-device limit applies: the shared cache already caps upstream at one set of three calls per 2 minutes.

## Timing

Each call fills a `TempWindTiming` (served `cache`/`shared`/`fetch`, requests, pacing, retries, provider time, station count, outcome `ok`/`partial`/`stale`/`error`, fixed `errorKind`), logs it once as `temp-wind refresh timing`, and the route sends it as `Server-Timing`. Only numbers and fixed enums are written.

## Development fixture

`TEMP_WIND_FIXTURE=demo` (ignored when `NODE_ENV=production`) serves 17 hand-made stations from `tempWindFixture.ts`: calm, light, moderate and strong wind, wind only, temperature only, no reading, a speed without a direction, an out-of-range value already reduced to no reading, and the unnamed S199, read 6 minutes before now.
