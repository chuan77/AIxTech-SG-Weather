# Research: WBGT Heat-Stress Tile

**Feature**: [spec.md](./spec.md) | **Date**: 2026-11-14

## R1. WBGT dataset shape (re-verified live)

- **Decision**: Read `GET /v2/real-time/api/weather?api=wbgt` and use `data.records[0].item.readings[]`. Each reading is `{ station: { id, name, townCenter }, location: { latitude, longitude } (strings), wbgt: "27.3" (string), heatStress: "Low" }`. The record also carries `datetime`, the measurement time, and `updatedTimestamp`.
- **Evidence**: fetched 2026-11-14 11:55 SGT with the Development key; HTTP 200 in 0.13 s, `code: 0`, 1 record, `isStationData: true`, 30 station readings, all `Low` (late morning, cloudy).
- **Rationale**: matches the sg-weather-api skill (verified 2026-11-11) and is a single request, so the refresh grows from 11 to 12 calls.
- **Use**: `wbgt` goes through `Number()`, and a non-finite result becomes null. `heatStress` is stored as given (trimmed). `datetime` is the reading time, falling back to `updatedTimestamp`.
- **Alternatives considered**: passing `date=` and paging. Rejected, because only the latest reading is needed.

## R2. Distance and the 10 km cut-off

- **Decision**: Choose the nearest WBGT station by great-circle (haversine) distance in km, using Earth radius 6371 km. The choice is made among readings whose `wbgt` is numeric. The backend stores the station name and distance even when the station is far. The frontend's pure `heatStressView()` applies the cut-off: `distance > 10` gives "No nearby station", and exactly 10.0 counts as near.
- **Rationale**: the spec asks for real km (FR-002). The existing `nearestStation()` compares squared degrees, which is fine for ranking but cannot express a km threshold, so it stays unchanged for the other endpoints. Keeping the cut-off in one pure frontend module makes it unit-testable, and the threshold can change without re-fetching.
- **Coverage check (SC-005)**: against today's 30 stations, the nearest-station distance at edge points is: Tuas West 6.4 km, Lim Chu Kang 6.2, Sembawang 4.7, Pasir Panjang 4.2, Seletar 3.9, Changi Airport 1.2, Marina Bay 1.1, and Pulau Tekong 8.3. Every tested main-island point is within 10 km, so SC-005 is expected to pass at 100%.
- **Alternatives considered**: applying the cut-off on the backend and storing nulls. Rejected, because the frontend would still need the threshold to tell "No reading" from "No nearby station" and would duplicate it.

## R3. Heat-stress levels and guidance wording

- **Decision**: Use NEA's Heat Stress Advisory bands: Low for WBGT below 31 °C, Moderate for 31 to below 33 °C, High for 33 °C and above. The app shows NEA's `heatStress` label as published, rather than recomputing it from WBGT. Guidance appears only for Moderate and High:
  - **Moderate**: "Reduce prolonged or strenuous outdoor activity. Take regular breaks in the shade and drink water often."
  - **High**: "Minimise outdoor activity and stay in the shade where possible. Drink water often and watch for signs of heat illness."
- **Source**: the national Heat Stress Advisory, launched July 2023 ([MSE press release](https://www.mse.gov.sg/latest-news/press-release-heat-stress-advisory/)), and the action bands in the Sport Singapore Heat Stress Management Plan (April 2024 [PDF](https://www.sportsingapore.gov.sg/files/Sport%20Education/Sport%20Safety/Heat%20Stress%20Management%20Plan/3_phase_approach_Heat_Stress_Mgmt_Plan_26_Apr_24_730am_FINAL.pdf)). Under these, Moderate means reduce outdoor activity and take regular breaks, and High means minimise outdoor activity and stay in shade. Both add drinking more and watching for heat-illness symptoms. The wording above paraphrases these at advisory level, which satisfies FR-006.
- **Residual check**: the current advisory page on weather.gov.sg or myENV was not fetched. Before release, compare the two lines against it (quickstart step 6). This is a wording check, not a design blocker.
- **Alternatives considered**: deriving the level from WBGT locally. Rejected, because NEA's label is authoritative and would stay correct if NEA changed its bands.

## R4. Shared request pacing (answers "what's the concern")

- **Finding**: `SingaporeWeatherClient` ([weather.ts:221](../../backend/src/weather.ts)) and `SingaporeLightningClient` ([lightning.ts:139](../../backend/src/lightning.ts)) each create their own `ProviderRequester`, and each one spaces only its own calls (250 ms). The provider's limit is per key, though. A refresh is 12 calls, and lightning makes up to 4 (three pages today plus yesterday). If the two overlap, more than 12 calls land in 10 s, and the Development key rejects the extras with HTTP 429.
- **Decision**: Create one `ProviderRequester` in `createApp` and pass it to both default clients through a new `requester` constructor option. The routers keep their current fallbacks for direct construction.
- **Interval**: `requestIntervalMs = ceil(10000 / limit) + 50`, where `limit` is 12 with a key and 6 without one. That gives 884 ms with the Development key and 1717 ms keyless. With even spacing, no 10 s window can hold more than `limit` request starts. An optional `WEATHER_API_RATE_LIMIT` env var (requests per 10 s) overrides the limit for a Production key. It is not required.
- **Retry**: on a 429, wait 10 000 ms, as the provider's error body says ("try again in 10 seconds"), then retry once (FR-011). The current wait is 1000 ms.
- **Timing check (FR-012)**: 12 calls make 11 gaps of 884 ms, about 9.7 s, plus about 0.15 s of latency per call. Calls are queued, not run in parallel, so expect roughly 10 to 11 s in total, within the 15 s target. A refresh that hits a 429 takes about 10 s longer; the spec accepts that, since FR-012 holds only under normal conditions.
- **Tests**: `ProviderRequester` takes `requestIntervalMs` and `rateLimitRetryDelayMs` options so tests can pass 0. Without them, the existing weather tests would take about 20 s each at keyless pacing.
- **Alternatives considered**:
  - A module-level singleton requester. Rejected, because hidden global state makes test isolation harder.
  - A token bucket. Rejected, because even spacing is simpler and already guarantees the limit.
  - Keeping separate requesters, each at half the rate. Rejected, because it would slow a refresh to about 20 s.

## R5. Unknown: does the v1 `4-day-weather-forecast` count toward the limit?

- **Decision**: Treat it as counting, which is the safe choice and matches the spec's assumptions. It goes through the same shared requester, so nothing extra is needed either way.

## R6. Storage

- **Decision**: Add five nullable columns to `locations` (see [data-model.md](./data-model.md)) and generate migration `0002_*` with `npm run db:generate`. Existing rows read as null, which displays as "No reading" (FR-015).
- **Alternatives considered**: a JSON column. Rejected, because every other scalar reading is its own column.

## R7. Refresh-in-progress UI (FR-013)

- **Finding**: `store.tsx` already tracks `refreshingId`, and `Hero.tsx` shows `isRefreshing`. The location's snapshot is replaced only when the refresh response arrives, so the previous readings stay visible. No new state is needed. Planning should check that the existing indicator is visible enough for a 10 s refresh (quickstart step 4).
