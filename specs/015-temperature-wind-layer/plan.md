# Implementation Plan: Temperature and Wind Across Singapore on the Map

**Branch**: `015-temperature-wind-layer` (not created yet; the work is on `main`) | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-temperature-wind-layer/spec.md`

## Summary

Add a Temperature & wind view to the **full-screen map only**. Each of about 17 NEA stations shows its air temperature and an arrow pointing the way the wind blows, sized by strength. Calm and "no reading" states are explicit. The view is off by default and fetched only on a user action.

**Backend**: a new `POST /api/temp-wind/refresh`, backed by an injectable `SingaporeTempWindClient`. The client:
- makes three latest-reading requests (`air-temperature`, `wind-speed`, `wind-direction`) through the shared `ProviderRequester` at high priority;
- joins them by station;
- lets each measure fail on its own;
- caches one observation in memory for 2 minutes, shared by all viewers, and serves it as stale on total failure.

**Frontend**:
- a `tempWind` store slice that mirrors `rain`;
- a switch, refresh button and status strip on the full-screen map;
- a legend;
- a `TempWindLayer` of themed labels.

All logic lives in the pure, tested modules `tempWindHelpers.ts` and `tempWindMarker.ts`. The card map is unchanged.

**Constitution**: Principle I is amended from 1.5.0 to 1.6.0 to name temperature and wind as a third island-wide exception, on the same terms as lightning and rain.

**Gates**: both passed on 2026-11-19 (see spec Clarifications):
- Gate 1, the mock-up, was accepted with one change: full-screen only.
- Gate 2, the afternoon sample, passed, and its 6–7 minute lag moved the out-of-date threshold to 15 minutes.

## Technical Context

**Language/Version**: TypeScript on Node (npm workspaces `frontend`, `backend`)

**Primary Dependencies**: Express 4, React 18, Leaflet 1.9 with react-leaflet, Tailwind 3, Vite. No new dependencies.

**Storage**: none. One observation is held in server memory. SQLite/Turso is untouched, so there is no schema change and no migration.

**Testing**:
- vitest (node environment, forked, non-parallel);
- Supertest route tests using `createApp` with injected fakes;
- pure `.ts` frontend tests only;
- browser check `scripts/e2e/temp-wind.sh` using agent-browser.

**Target Platform**: one Node process (a Vercel container). Browsers on laptop and phone, down to 375 px.

**Project Type**: web application (Express and React in one process).

**Performance Goals** (research R6):
- toggling with data loaded takes under 1 s (SC-004);
- fresh data arrives in under 5 s (SC-005); expect about 2 s, made up of 3 paced requests (about 1.8 s) plus provider time;
- at most one provider fetch per 2 minutes (SC-008).

**Constraints**:
- no data.gov.sg call on page load (Principle I, FR-007);
- one paced request stream per key, 884 ms apart on the Development key;
- saved-place refresh stays at 10–15 s with no 429 responses (SC-006);
- WCAG AA on every theme (Principle V);
- no reliance on colour alone (FR-017).

**Scale/Scope**: about 17 stations (19 distinct IDs across the three measures), fewer than 5 users, one Development key.

Every unknown is resolved in [research.md](research.md), so nothing needs clarification:

| Item | Topic |
|---|---|
| R1 | fetch |
| R2 | join and partial failure |
| R3 | reading time and the 15-minute out-of-date threshold |
| R4 | strength levels |
| R5 | plausible ranges |
| R6 | queue |
| R7 | marks |
| R8 | full-screen controls |
| R9 | attribution |
| R10 | amendment |
| R11 | fixture |
| R12 | state and legend |

## Constitution Check

*GATE: must pass before Phase 0 research, and re-checked after Phase 1 design.*

| Principle | Status | How the design complies |
|---|---|---|
| I. Snapshot-only weather data | **Pass, with amendment** | The data is island-wide and fetched only from `POST /api/temp-wind/refresh` on a user action. A remembered "on" shows a prompt instead of fetching. Nothing is stored in SQLite or any `WeatherSnapshot`. It is cached for 2 minutes on the server and degrades to "unavailable". This needs amendment 1.6.0, accepted by the owner on 2026-11-19 (R10), and the amendment lands **before or with** the route. |
| II. One process, relative API | Pass | The new route is on the same Express app. `api.ts` gets `refreshTempWind()`, and the state goes in a `store.tsx` slice. There is no new state container. |
| III. Injectable weather provider | Pass | `createApp({ tempWindClient })` is injectable, like `rainClient`. Tests inject fakes and never reach the network. |
| IV. Testing within real limits | Pass | The backend parse, join, range, partial-failure, cache and stale logic is tested in `tempWind.test.ts`. The frontend levels, rotation, compass, freshness, status and popup text, and the saved preference are in pure modules with tests. Components stay thin. |
| V. Theme-driven UI | Pass | New per-theme variables (`--tw-label-bg`, `--tw-label-text`, `--tw-label-border`, `--tw-arrow`, `--tw-missing`) go in all six `[data-theme]` blocks, with contrast measured. Controls reuse `map-control`, and the legend uses `rounded-card`. The `apple` theme's existing look is unchanged. `docs/theming.md` is updated. |
| VI. Testing & quality gate | Pass | `routes/tempWind.test.ts` follows the `locations.test.ts` pattern. The pre-commit hook is unchanged and never bypassed. `npm run verify` must pass. |
| Technical constraints | Pass | No schema change. The sample dumps are not committed; fixtures are hand-made. No new secrets. |
| Development workflow | Pass | Read the architecture, theming and testing docs before changing those areas, and update them in the same change (see below). |

**Post-design re-check (after Phase 1)**: still passes.
- The route takes no input, so there is nothing to validate.
- Popup and label text from the provider (station names) is escaped with the existing `escapeHtml`, as rain does, so there is no XSS through Leaflet.
- Nothing is stored.
- The only deviation is the approved Principle I amendment (Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/015-temperature-wind-layer/
├── spec.md
├── plan.md                   # this file
├── research.md               # Phase 0
├── data-model.md             # Phase 1
├── quickstart.md             # Phase 1
├── contracts/
│   └── temp-wind-refresh.md  # Phase 1
├── checklists/
│   └── requirements.md
└── tasks.md                  # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
backend/src/
├── tempWind.ts                # NEW SingaporeTempWindClient: 3 latest calls, join, ranges, per-measure failure, 2-min cache, stale
├── tempWind.test.ts           # NEW
├── tempWindFixture.ts         # NEW TEMP_WIND_FIXTURE=demo (development only)
├── routes/tempWind.ts         # NEW POST /api/temp-wind/refresh, Server-Timing, 502 mapping
├── routes/tempWind.test.ts    # NEW Supertest (Principle VI)
├── server.ts                  # wire tempWindClient option, fixture, shared requester
└── providerHttp.ts, serverTiming.ts   # reused unchanged

frontend/src/
├── types.ts                   # IslandConditionsObservation, TempWindStation, TempWindStatus
├── api.ts                     # refreshTempWind()
├── state/store.tsx            # tempWind slice (mirrors rain)
├── index.css                  # --tw-* per theme; .tw-mark classes
└── components/map/
    ├── tempWindHelpers.ts     # NEW pure: levels, rotation, compass, freshness (15 min), status/popup text, preference
    ├── tempWindHelpers.test.ts
    ├── tempWindMarker.ts      # NEW pure markup per mark kind (no colour in markup)
    ├── tempWindMarker.test.ts
    ├── TempWindLayer.tsx      # NEW pane between rain and lightning; divIcon labels; popups
    ├── TempWindControl.tsx    # NEW switch, refresh, status strip, legend
    ├── WeatherMap.tsx         # mount TempWindLayer behind showTempWind (default false)
    └── MapFullscreen.tsx      # controls (wrapping top bar), strip, showTempWind

scripts/e2e/temp-wind.sh       # NEW browser check (stubbed route; own server; teardown)
.specify/memory/constitution.md  # Principle I amendment → 1.6.0
```

**Structure Decision**: keep the existing two-workspace web layout. The new files mirror the rain feature's files one for one, so review can compare them side by side. Rain and lightning code is not refactored or shared, because that is out of scope.

## Task outline (for `/speckit-tasks`)

Steps 1 and 2 must happen in this order.

1. **Constitution amendment** to 1.6.0, with `docs/architecture.md`. This must land before or with the route.
2. **Backend client tests first (TDD)**: `tempWind.test.ts`, then `tempWind.ts`. The fixtures are shaped like the 2026-11-19 responses and cover:
   - temperature-only and wind-only stations;
   - an unnamed station;
   - out-of-range values;
   - speed without direction;
   - one measure failing;
   - all measures failing, with and without a cache;
   - shared loads in flight.
3. **Route and server**: `routes/tempWind.ts`, `routes/tempWind.test.ts`, and `server.ts` wiring with the shared requester.
4. **Fixture**: `tempWindFixture.ts` with `TEMP_WIND_FIXTURE=demo`.
5. **Frontend pure logic and tests**: `tempWindHelpers.ts` and `tempWindMarker.ts`, with their tests.
6. **Store and API**: the `tempWind` slice and `refreshTempWind()`.
7. **UI**:
   - `TempWindLayer`, `TempWindControl` and the legend;
   - wiring into `WeatherMap` (`showTempWind`) and `MapFullscreen`;
   - the top-bar wrap at 375 px.
8. **Themes**: `--tw-*` variables in all six themes, with contrast measured, and `docs/theming.md`.
9. **Docs**: see the list below.
10. **Verification**:
    - `npm run verify`;
    - `scripts/e2e/temp-wind.sh`;
    - the live check and the shared-budget runs (quickstart §4–5).

## Documentation to update (in the same change)

- `.specify/memory/constitution.md`: Principle I (third exception) and the Sync Impact Report.
- `docs/architecture.md`: a temperature and wind exception paragraph next to rain's, plus a frontend note that it is full-screen only.
- `docs/theming.md`: the `--tw-*` variables and mark rules.
- `docs/testing.md`: `scripts/e2e/temp-wind.sh`.
- Docs site:
  - `docs/src/content/docs/backend/api.md`;
  - a new `backend/temp-wind.md`;
  - `frontend/map.md`;
  - `configuration.md` (`TEMP_WIND_FIXTURE`).
- `CLAUDE.md`: no change needed.

## Spec updates made by this plan

FR-006, SC-003 and US3 scenario 4 now use a **15-minute** out-of-date threshold instead of 10 minutes (research R3, from Gate 2). This is recorded in the spec's Clarifications.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle I: a third island-wide exception (temperature and wind), by amendment 1.6.0 | The spec needs current island-wide conditions, fresher than the last saved-place refresh, including for places that aren't saved. The owner approved it on 2026-11-19. | Reusing readings from the last saved-place refresh (concept Option C) fails freshness, shows nothing without a recent refresh, and still conflicts with the "not in a WeatherSnapshot" wording. |
