---
title: Rain
description: The on-demand island-wide rain client, its 15-minute window, cache and fixture.
sidebar:
  order: 5
---

Island-wide rain (spec 011) is the second weather call outside a location create or refresh, under the same constitution exception as lightning (Principle I, 1.5.0). It is never stored in SQLite or in any location's snapshot.

`backend/src/rain.ts` exports `SingaporeRainClient`, which implements:

```ts
interface RainClient {
  getRecentRain(now?: Date, timing?: Partial<RainTiming>): Promise<IslandRainObservation>;
}
```

`routes/rain.ts` exposes it as `POST /api/rain/refresh`. Inject a different client with `createApp({ rainClient })`.

## The 15-minute window

- **One request.** `GET /v2/real-time/api/rainfall?date=<today in SGT>` returns the newest 25 five-minute readings, newest first, so the first page always covers the window. The pagination token is never followed. When the window reaches before midnight (or today has no data yet, including a 404 or provider code 17), one more request reads the previous SGT date.
- **Anchor.** The newest period fills in over several minutes (3 of 87 stations at 08:25 for the 08:20 period, measured 2026-11-17). A period counts once its row count is at least 80% of the largest row count returned. The newest such period is the anchor `T`; it is normally about 10 minutes old.
- **Sum.** Each station's total is its values at `T`, `T−5` and `T−10` added up, to 0.1 mm. `periods_covered` says how many of the three it had. A station with none gets `total_mm: null`, which the map draws as "no reading", never as dry.
- **Unusable.** No usable period, or every station without a reading, is a `WeatherProviderError`.

## Cache and failure

The same states as lightning: one observation per client, shared by every caller, fresh for 2 minutes (`FRESH_MS = 120_000`); concurrent callers share one in-flight load; a failed refresh serves the previous observation with `stale: true` (200), and with nothing cached the route returns `502 { "detail": "Rain data is currently unavailable" }`. No per-device limit applies: the shared cache caps upstream at one rain fetch per 2 minutes, and a failed attempt is remembered for 2 minutes too (serving the stale copy, or failing without an upstream call), so an outage or a 429 can't turn repeated presses into repeated provider calls.

All requests go through the shared `ProviderRequester`, in the same paced stream as location refreshes and lightning.

## Timing

Each call fills a `RainTiming` (served `cache`/`shared`/`fetch`, pages, requests, pacing, retries, provider time, station count, outcome, fixed `errorKind`), logs it once as `rain refresh timing`, and the route sends it as `Server-Timing`. Only numbers and fixed enums are written.

## Development fixture

`RAIN_FIXTURE=demo` (ignored when `NODE_ENV=production`) serves 20 hand-made stations from `rainFixture.ts`: dry, every level, two partial and two with no reading, with the window ending about 10 minutes before now.
