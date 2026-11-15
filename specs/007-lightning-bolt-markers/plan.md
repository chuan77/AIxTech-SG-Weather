# Implementation Plan: Themed Lightning Bolt Markers and Refresh Timing

**Branch**: `007-lightning-bolt-markers` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-lightning-bolt-markers/spec.md`

## Summary

Replace each lightning strike's circle with a filled bolt silhouette, using react-leaflet `Marker` + `L.divIcon` with an inline SVG. It's coloured by the theme variables `--lightning` and the new `--lightning-outline` through CSS, and fades in 12 cached age steps with a never-faded outline, so it meets 3:1 contrast and stays smooth at ~370 strikes. Add diagnostics-only refresh timing: an optional `RequestStats` accumulator in `ProviderRequester`, one `lightning refresh timing` server log line and a `Server-Timing` header per refresh, and one `console.info` record in the browser covering network and drawing time. How and when lightning is fetched is unchanged.

## Technical Context

**Language/Version**: TypeScript (Node, React 18)

**Primary Dependencies**: Express, react-leaflet 4 / Leaflet 1.9, Tailwind 3, pino. No new dependencies.

**Storage**: N/A. Nothing persisted, no schema change.

**Testing**: vitest (node env, forked, no DOM); Supertest route tests; agent-browser e2e script.

**Target Platform**: Modern desktop and mobile browsers; single Node process.

**Project Type**: Web application (npm workspaces `frontend`, `backend`).

**Performance Goals**: Pan and zoom smooth with 370 strikes (SC-004); timing adds no provider requests and no noticeable delay (FR-011).

**Constraints**: ≥3:1 mark contrast on all 6 themes at every age; colours only from theme variables; no fetch on page load; ≤1 provider refresh per 2 minutes; timing only in developer diagnostics.

**Scale/Scope**: Up to a few hundred strikes per window, 6 themes and 3 basemaps, card and full-screen map.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Snapshot-only weather data | Pass | Lightning's user-action-only exception, its 2-minute cache and its no-storage rule are untouched. Timing is in-memory and observational. |
| II. One process, relative API | Pass | Same `POST /api/lightning/refresh`; state stays in `store.tsx`. |
| III. Injectable provider | Pass | `createApp({ lightningClient })` unchanged. The timing sink is an optional argument, so fakes keep working. |
| IV. Testing within real limits | Pass | New logic lives in pure `.ts` modules (`strikeMarker.ts`, `lightningTiming.ts`, `serverTiming.ts`). Backend logic is tested with a fake `fetchImpl` and no network. |
| V. Theme-driven UI | Pass, improves | Removes the literal outline and fallback colours from `LightningLayer`; adds `--lightning-outline` to every theme block; updates `docs/theming.md`. |
| VI. Testing & quality gate | Pass | The route keeps Supertest coverage, extended for `Server-Timing`; `npm run verify` before done. |

Post-design re-check (after Phase 1): still passing; no violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-lightning-bolt-markers/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── lightning-refresh-timing.md
│   └── strike-marker.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
backend/src/
├── providerHttp.ts          # getJson(url, stats?) + RequestStats
├── providerHttp.test.ts     # stats: requests, pacing wait, 429 retry
├── lightning.ts             # LightningTiming built per call; one info log; timing sink arg
├── lightning.test.ts        # served cache/shared/fetch, stale, error
├── lightningFixture.ts      # + LIGHTNING_FIXTURE=busy (~370 deterministic strikes)
├── serverTiming.ts          # format LightningTiming → Server-Timing header (pure)
├── server.ts                # select busy fixture (dev only)
└── routes/
    ├── lightning.ts         # pass sink, set Server-Timing on 200 and 502
    └── lightning.test.ts

frontend/src/
├── index.css                         # --lightning-outline (+ optional --lightning-fill-floor) per theme; .strike-mark styles
├── state/store.tsx                   # start/stop timestamps, trigger, reused record
├── api.ts                            # refreshLightning returns body + Server-Timing header
└── components/map/
    ├── strikeMarker.ts               # age → step/size/fresh fraction; bolt markup; icon cache (pure)
    ├── strikeMarker.test.ts
    ├── lightningTiming.ts            # parse Server-Timing; build console record (pure)
    ├── lightningTiming.test.ts
    ├── lightningHelpers.ts           # strikeStyle() replaced by strikeMarker; others unchanged
    └── LightningLayer.tsx            # Marker + divIcon per strike; report drawn frame

scripts/e2e/lightning-markers.sh      # stubbed lightning; us1/us2/themes; shared lib.sh teardown
docs/theming.md, docs/architecture.md # --lightning-outline; timing diagnostics
```

**Structure Decision**: Existing web-application layout (`backend/src`, `frontend/src`). New pure modules sit beside their components, following `mapHelpers.ts` and `pinMarkup.ts`.

## Design Notes

- **Fade with a per-theme floor**: each cached icon sets an inline custom property `--strike-fresh` (1 → 0 across the 12 steps). CSS computes `fill-opacity: calc(var(--lightning-fill-floor, 0.25) + (1 - var(--lightning-fill-floor, 0.25)) * var(--strike-fresh))`. A theme can raise its floor without code changes ([research §3–4](./research.md)).
- **Timing sink**: `LightningClient.getRecentLightning(now?, timing?: Partial<LightningTiming>)`. The route measures `total` itself and merges whatever the client filled in.
- **Drawn moment**: `LightningLayer` takes an `onDrawn(observation)` callback from the store's timing ref and calls it in a `requestAnimationFrame` after the commit for a new `observation`.
- **No change** to `isFresh`, `visibleStrikes`, `statusMessage`, `nearestStrike`, the toggle or the status strip.

## Complexity Tracking

No violations.
