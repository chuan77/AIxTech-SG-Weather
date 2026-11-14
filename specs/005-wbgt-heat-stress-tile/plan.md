# Implementation Plan: WBGT Heat-Stress Tile

**Branch**: `005-wbgt-heat-stress-tile` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-wbgt-heat-stress-tile/spec.md`

## Summary

Add NEA's official WBGT heat-stress reading to each location's snapshot. It comes from the nearest station by great-circle distance and adds one upstream call, bringing a refresh to 12 calls. A new "Heat Stress" tile shows the value, the level, the station, the distance and the reading time, plus guidance at Moderate or High. A location more than 10 km from any station shows "No nearby station" instead.

To keep the extra call from causing HTTP 429 errors, the weather and lightning clients will share one `ProviderRequester`. It spaces requests to fit the key's limit: 884 ms apart with the Development key, 1717 ms without a key. After a 429 it waits 10 s before its single retry.

## Technical Context

**Language/Version**: TypeScript on Node (ESM), React 18

**Primary Dependencies**: Express, Drizzle ORM (sqlite-proxy over `node:sqlite`), Vite, Tailwind 3, react-leaflet (unchanged)

**Storage**: SQLite `locations` table. Five new nullable columns, added by migration `0002_*`.

**Testing**: vitest, run forked and not in parallel. Supertest for routes. The frontend is tested through pure `.ts` modules only.

**Target Platform**: a single Node process serving the backend and frontend. Desktop and phone-width browsers.

**Project Type**: web application in npm workspaces (`backend`, `frontend`)

**Performance Goals**: one refresh takes 15 s or less with the Development key (about 10 to 11 s expected, research R4). No provider calls are rejected for rate limiting.

**Constraints**:
- Provider limit of 12 calls per 10 s (Development key) or 6 per 10 s (no key), shared by all clients.
- No provider calls on page load.
- Colours come from the theme only.

**Scale/Scope**: personal use, a handful of saved locations, about 30 WBGT stations.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I. Snapshot-only | ✅ | WBGT is fetched only on create or refresh, inside `getCurrentWeather`, and stored in the snapshot. No new endpoint and no amendment needed. |
| II. One process, relative API | ✅ | No new routes. The frontend reads the new fields from the existing `/api/locations` responses through the store. |
| III. Injectable provider | ✅ | WBGT goes through `SingaporeWeatherClient`. The shared requester is passed into the client constructors, and fakes injected through `createApp({ weatherClient, lightningClient })` are unaffected. |
| IV. Testing within limits | ✅ | View logic lives in the pure module `heatStress.ts`, which has unit tests. Backend coverage is in `weather.test.ts` and `providerHttp.test.ts`, using injected intervals so no test waits on real time. |
| V. Theme-driven UI | ✅ | Only `white/*` classes and `rounded-card` (through `TileShell`), plus the existing `ScaleBar` gradient. No literal colours. |
| VI. Testing & quality gate | ✅ | No new route. The existing route tests in `locations.test.ts` get assertions for the new fields. `npm run lint` and `npm test` gate commits. |

Re-check after design: still passing. No violations, so Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/005-wbgt-heat-stress-tile/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── providerHttp.ts        # requestIntervalMs / rateLimitRetryDelayMs options; key-aware default; 10 s retry
│   ├── providerHttp.test.ts   # NEW: spacing, shared stream, single retry (fake timers / 0 ms)
│   ├── weather.ts             # `requester` option; fetchWbgt(); haversine distanceKm(); 5 snapshot fields
│   ├── weather.test.ts        # wbgt payload in fixture; nearest-by-km; failure isolation; injected 0 ms pacing
│   ├── lightning.ts           # `requester` option
│   ├── lightning.test.ts      # pass 0 ms pacing where needed
│   ├── server.ts              # build one ProviderRequester; construct default clients with it
│   ├── schema.ts              # 5 nullable columns + WeatherSnapshot fields
│   ├── db.ts                  # map new columns ↔ snapshot; default snapshot nulls
│   └── routes/locations.test.ts  # refresh response includes WBGT fields
└── drizzle/0002_*.sql         # generated

frontend/src/
├── types.ts                   # 5 WeatherSnapshot fields
└── components/
    ├── heatStress.ts          # NEW pure: heatStressView(), WBGT_MAX_STATION_KM, HEAT_STRESS_GUIDANCE
    ├── heatStress.test.ts     # NEW
    └── Tiles.tsx              # HeatStressTile; add to TileGrid beside Feels Like

docs/architecture.md           # WBGT in snapshot (12 calls); shared requester + pacing numbers
```

**Structure Decision**: the existing `backend/` and `frontend/` workspaces. The new code follows the patterns already there: snapshot fields like the pollutants from spec 004, a pure tile helper like `feelsLike.ts`, and the shared HTTP code in `providerHttp.ts`.

## Design Notes

1. **Shared requester wiring**: `createApp` builds one `ProviderRequester` from `process.env.WEATHER_API_KEY`. It builds it lazily, only when at least one default client is needed, and passes `{ requester }` to `createLocationsRouter` and `createLightningRouter`. Those pass it to `new SingaporeWeatherClient` and `new SingaporeLightningClient`. Each client constructor uses `options.requester ?? new ProviderRequester(options)`, so tests that build clients directly keep working.
2. **Pacing defaults** come from research R4. `WEATHER_API_RATE_LIMIT` is optional, so leaving it unset works fine (the constitution's optional-key rule).
3. **WBGT fetch**: `fetchWbgt(lat, lon)` follows the other optional fetches inside the `Promise.all` call (`fetchOptional('wbgt', …, EMPTY_WBGT)`). It checks the `code` envelope like the other endpoints. Its timestamp joins the `latestTimestamp([...])` list for `observed_at`.
4. **The cut-off is applied only in the frontend** (research R2), so the backend stays a plain recorder of the nearest station.
5. **No change to `nearestStation()`** for the existing endpoints. Moving them to km distance is out of scope.
6. **Docs**: update `docs/architecture.md` in the same change. It should say 12 calls per refresh, describe the shared requester and pacing in place of "250 ms spacing", and add the Heat Stress tile to the frontend paragraph.

## Complexity Tracking

No constitution violations.
