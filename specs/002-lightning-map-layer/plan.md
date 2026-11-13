# Implementation Plan: Lightning Strikes on the Map

**Branch**: `002-lightning-map-layer` | **Date**: 2026-11-12 (revised after clarification and constitution 1.1.0) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-lightning-map-layer/spec.md`

## Summary

Add an island-wide, user-toggleable lightning layer to the existing Leaflet map. The backend gains one
endpoint, `POST /api/lightning/refresh`, that reads data.gov.sg's `weather?api=lightning` dataset
(paginating back ~60 minutes), normalises and filters the strikes, and caches the result in memory for
2 minutes. The frontend never calls it on page load: it is triggered only by turning the layer on or
pressing refresh. Strikes render as fading circle markers with a popup, plus an on/off control, an
empty/unavailable/last-updated status strip, and a `localStorage` preference. No SQLite or snapshot
changes. Per the 2026-11-12 clarification, a fresh page shows the layer "on" with a "Show latest lightning"
prompt and no data until the first user action. Constitution 1.1.0 (ratified 2026-11-12) now
explicitly permits this island-wide, user-triggered, non-persisted fetch.

## Technical Context

**Language/Version**: TypeScript (Node 22+ with built-in `node:sqlite`; React 18)

**Primary Dependencies**: Express, react-leaflet/Leaflet (existing); no new dependencies

**Storage**: None for lightning. Server keeps a 2-minute in-memory cache; the toggle lives in browser `localStorage`. SQLite and Drizzle schema untouched

**Testing**: vitest (node env, forks). Backend route/client tests via `createApp` with a fake `lightningClient`; pure frontend logic in a new `lightningHelpers.ts` with a `.test.ts`

**Target Platform**: Single Node process serving API and Vite/React frontend; desktop and mobile browsers

**Project Type**: Web application (npm workspaces `backend` + `frontend`)

**Performance Goals**: Toggle reflects in under 1 s (SC-002); at most 1 upstream lightning fetch per 2 minutes (SC-005)

**Constraints**: data.gov.sg shares a low rate limit and the existing client spaces requests 250 ms apart; works with no API key (FR-016); no automatic fetch on page load (FR-013)

**Scale/Scope**: Zero to a few hundred strikes per hour island-wide; one shared observation window

All Technical Context items are resolved in [research.md](./research.md); none remain NEEDS CLARIFICATION.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Snapshot-Only Weather Data | Pass (via ratified exception) | Constitution 1.1.0 allows island-wide data to be fetched through `POST /api/lightning/refresh` only on explicit user action, never on page load, never stored, with a server cache of at least 2 minutes and graceful degradation. The design meets each condition |
| II. One Process, Relative API | Pass | Relative `/api/lightning/refresh`; state added to the existing `store.tsx` via `api.ts`; no router or second container |
| III. Injectable Weather Provider | Pass | New `LightningClient` interface injected through `createApp({ lightningClient })`; default is the real client; tests use a fake and never touch the network |
| IV. Testing Within Real Limits | Pass | Backend tests via `createApp`; frontend logic extracted into pure `lightningHelpers.ts` (no DOM tests) |
| V. Theme-Driven UI | Pass | Toggle and status use `white`/`rounded-card` conventions; strike colour via CSS variable defined per theme, no per-component overrides; `apple` theme visually unchanged when layer is off |

Technical Constraints: no schema change, no new secrets, optional `WEATHER_API_KEY` reused and optional. **Post-design re-check**: still passes; the Principle I exception is the only lightning-specific rule and is already in the constitution, so no amendment task remains.

## Project Structure

### Documentation (this feature)

```text
specs/002-lightning-map-layer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── lightning-api.md
├── checklists/requirements.md
└── tasks.md             # created later by /speckit-tasks
```

### Source Code (repository root)

```text
backend/src/
├── lightning.ts                 # NEW: LightningClient interface, SingaporeLightningClient, normalise/filter, 2-min cache
├── lightning.test.ts            # NEW: normalisation, pagination, window and cache tests
├── routes/
│   ├── lightning.ts             # NEW: POST /api/lightning/refresh
│   └── lightning.test.ts        # NEW: route tests with fake client
└── server.ts                    # EDIT: lightningClient option, mount router, dev-only LIGHTNING_FIXTURE client

frontend/src/
├── api.ts                       # EDIT: refreshLightning()
├── types.ts                     # EDIT: LightningStrike, LightningObservation
├── state/store.tsx              # EDIT: lightning data, status, enabled flag, refresh action
└── components/map/
    ├── lightningHelpers.ts      # NEW: age → opacity/radius, label, status text, freshness check
    ├── lightningHelpers.test.ts # NEW
    ├── LightningLayer.tsx       # NEW: strike markers + popups
    ├── LightningControl.tsx     # NEW: toggle, refresh, status strip
    ├── WeatherMap.tsx           # EDIT: render layer
    ├── MapCard.tsx              # EDIT: control
    └── MapFullscreen.tsx        # EDIT: control
frontend/src/index.css           # EDIT: strike colour token per theme, status strip styles
docs/architecture.md             # EDIT: describe the lightning exception
```

**Structure Decision**: Existing web-application layout (`backend`, `frontend` workspaces). Lightning gets its own backend module and router, separate from `SingaporeWeatherClient`, because it has a different lifecycle (shared, cached, not per-location) and must not touch the snapshot path.

## Complexity Tracking

No unresolved violations. The earlier Principle I conflict was resolved by constitution amendment 1.1.0
(2026-11-12), which names the lightning exception and its conditions. Storing strikes per location was
rejected (it would duplicate one island dataset and violate FR-012), as was fetching on page load.
