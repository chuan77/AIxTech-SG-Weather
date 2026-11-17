# Implementation Plan: Island-wide Rain on the Map

**Branch**: `011-island-rain-view` (not created yet; work is currently on `main`) | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-island-rain-view/spec.md`

## Summary

Add an island-wide rain view to the card map and the full-screen map. It shows every rainfall station's total for the latest 15 minutes, a heaviness level, and explicit "partial" and "no reading" states. The view is off by default and fetched only on a user action.

The backend adds `POST /api/rain/refresh`, backed by an injectable `SingaporeRainClient`:
- it makes one `rainfall?date=<today>` request (two just after midnight) through the shared `ProviderRequester`;
- it skips the newest period while that period is still filling;
- it sums the three periods ending at the newest usable one;
- it caches one snapshot in memory for 2 minutes, shared by all viewers, and serves it as stale on failure.

The frontend adds rain state to the existing store, a Rain switch and status strip next to Lightning, a key, and a `RainLayer` of themed symbols that differ by size and shape. All logic lives in a pure, tested `rainHelpers.ts`.

Principle I is amended (1.4.0 → 1.5.0) to name rain as a second island-wide exception on lightning's terms.

**Gates**:
- **Gate 1 (live data check) passed** on 2026-11-17 ([research.md](research.md#gate-1-live-15-minute-data-check-passed-2026-11-17)).
- **Gate 2 (owner mock-up review)** is the first task. The owner chose to plan now and review the mock-up before any feature code. **If the owner rejects it, everything after task 1 is cancelled.**

## Technical Context

**Language/Version**: TypeScript on Node (npm workspaces `frontend`, `backend`)

**Primary Dependencies**: Express 4, React 18, Leaflet 1.9 with react-leaflet, Tailwind 3, Vite. No new dependencies.

**Storage**: none for this feature. One snapshot is kept in server memory. The saved-location store (SQLite or Turso) is untouched, so there is no schema change and no migration.

**Testing**: vitest (node environment, forked, non-parallel). Supertest route tests use `createApp` with injected fakes. Frontend tests cover pure `.ts` only. Browser checks use agent-browser via `scripts/e2e/`.

**Target Platform**: one Node process; browsers on laptop and phone, down to 375 px. Hosted as one Vercel container (spec 010).

**Project Type**: web application (Express backend and React frontend in one process).

**Performance Goals**:
- Toggle with data loaded in under 1 s (SC-004).
- Fresh data in under 5 s on a phone (SC-005). Expected about 1–2 s: 1–2 paced requests of about 0.9 s each, plus about 70 ms of provider time.
- No more than one provider fetch per 2 minutes (SC-008).

**Constraints**:
- No data.gov.sg call on page load (Principle I, FR-007).
- One paced request stream per key: 884 ms spacing on Development (12 per 10 s).
- Saved-location refresh stays at 10–15 s with zero 429s (SC-006).
- WCAG AA in every theme (Principle V).
- Symbols must not rely on colour alone (FR-016).

**Scale/Scope**: about 86–88 stations per observation, fewer than 5 users at launch, one Development key.

No NEEDS CLARIFICATION remains. Every unknown is resolved in [research.md](research.md): R1 fetch shape, R2 anchor rule, R3 freshness, R4 levels, R5 cache, R6 queueing, R7 symbols, R8 controls, R9 attribution, R10 amendment, R11 fixture.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How the design complies |
|---|---|---|
| I. Snapshot-only weather data | **Pass, with amendment** | Rain is island-wide and fetched only from `POST /api/rain/refresh` on a user action, never on load. A remembered "on" shows a prompt instead. It is not stored in SQLite or any `WeatherSnapshot`, it is cached on the server for 2 minutes, and it degrades to "unavailable". This needs the amendment that the owner accepted on 2026-11-17 (research R10). The amendment lands **before** the route ships (task order below). |
| II. One process, relative API | Pass | The new route is on the same Express app, and the frontend calls the relative `/api/rain/refresh` through `api.ts`. Rain state lives in `store.tsx`. There is no new state container. |
| III. Injectable weather provider | Pass | `createApp({ rainClient })` is injectable, like `lightningClient`. Tests inject fakes and never reach the network. The default client uses the shared `ProviderRequester`. |
| IV. Testing within real limits | Pass | Backend parse, anchor, sum, cache and fallback logic is tested in `rain.test.ts`. Frontend logic (levels, coverage, freshness, status text, preference) is in pure `rainHelpers.ts` with `rainHelpers.test.ts`. Components stay thin. |
| V. Theme-driven UI | Pass | New per-theme variables (`--rain-*`) go in each of the six `[data-theme]` blocks, with measured contrast noted beside each value. Controls reuse `map-control`, and panels use `rounded-card`. The `apple` theme's existing look is unchanged. `docs/theming.md` is updated. |
| VI. Testing & quality gate | Pass | `routes/rain.test.ts` follows the `locations.test.ts` pattern (createApp, fake provider, temp SQLite, Supertest). The pre-commit hook is unchanged and never bypassed. `npm run verify` must pass before the feature is called done. |
| Technical constraints | Pass | No schema change. `RealtimeWeatherReadingsacrossSingapore/` is not committed; the fixture is a small hand-made file. No new secrets, and the optional key still degrades gracefully. |
| Development workflow | Pass | Read `docs/architecture.md`, `docs/theming.md` and `docs/testing.md` before changing those areas. Update the matching docs in the same change (Documentation section below). |

**Post-design re-check (after Phase 1)**: still passes. The contract has no input, so there's nothing to validate and nothing that could leak SQL or XSS: popups are built from strings that go through Leaflet text APIs or escaping, as `formatStrikePopup` does. The data model stores nothing. The only deviation is the Principle I amendment, which is approved and listed below.

## Project Structure

### Documentation (this feature)

```text
specs/011-island-rain-view/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0 (includes the Gate 1 record)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── rain-refresh.md  # Phase 1
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
backend/src/
├── rain.ts                    # NEW SingaporeRainClient: fetch, anchor, sum, 2-min cache, stale fallback
├── rain.test.ts               # NEW parser and anchor rules, cache, shared load, midnight, fallback
├── rainFixture.ts             # NEW RAIN_FIXTURE=demo client (development only)
├── routes/rain.ts             # NEW POST /api/rain/refresh, Server-Timing, 502 mapping
├── routes/rain.test.ts        # NEW Supertest route tests (Principle VI)
├── server.ts                  # wire rainClient option, fixture, shared requester
└── providerHttp.ts            # unchanged (reused)

frontend/src/
├── types.ts                   # IslandRainObservation, RainStationReading, RainStatus, RainState
├── api.ts                     # refreshRain()
├── state/store.tsx            # rain state, mirroring lightning: enabled, status, observation, refresh
├── index.css                  # --rain-* variables per theme; .rain-mark symbol classes
└── components/map/
    ├── rainHelpers.ts         # NEW pure: levels, coverage, out-of-date, status/popup text, preference
    ├── rainHelpers.test.ts    # NEW
    ├── rainMarker.ts          # NEW pure markup for each symbol (no colour in markup)
    ├── RainLayer.tsx          # NEW Leaflet pane below lightning, divIcon markers, popups
    ├── RainControl.tsx        # NEW switch, refresh, status strip, key button and legend
    ├── WeatherMap.tsx         # mount RainLayer
    ├── MapCard.tsx            # mount RainControl; hide card rain while full screen is open
    └── MapFullscreen.tsx      # mount RainControl

scripts/e2e/rain-view.sh       # NEW browser check (stubs the route; never calls data.gov.sg)
.specify/memory/constitution.md  # Principle I amendment, 1.5.0
```

**Structure Decision**: the existing web-application layout (`backend/` and `frontend/` workspaces in one process). The new files mirror the lightning feature's files one-for-one, so reviewers can compare them side by side. Lightning code is not refactored or shared (out of scope).

## Task outline (for `/speckit-tasks`)

The order is binding where noted.

1. **Gate 2 mock-up (blocking).** A throwaway, uncommitted static page:
   - about 88 symbols at real station positions, with every level, partial and missing;
   - the key and both status strips;
   - the card map at 375 px and the full-screen map;
   - the `apple` and `radar` themes.

   The owner accepts, accepts with changes, or rejects. **Rejecting stops the feature.**
2. **Constitution amendment** to 1.5.0, plus `docs/architecture.md`. This must land before or with the route.
3. **Backend client and tests first** (TDD): `rain.ts` and `rain.test.ts`, with fixtures built from the Gate 1 response shape, including an incomplete newest period, a duplicate timestamp and a midnight carry-over.
4. **Route and tests**: `routes/rain.ts`, `routes/rain.test.ts`, and the `server.ts` wiring with the shared requester.
5. **Fixture**: `rainFixture.ts` and `RAIN_FIXTURE=demo`.
6. **Frontend pure logic and tests**: `rainHelpers.ts`, `rainMarker.ts`, `rainHelpers.test.ts`.
7. **Store and API**: rain state with an in-flight guard, a 2-minute client freshness check, keeping earlier readings on failure, and a preference that defaults to off.
8. **UI**: `RainLayer`, `RainControl`, the key, and wiring into both maps.
9. **Themes**: `--rain-*` in all six themes with measured contrast, and `docs/theming.md`.
10. **Attribution wording** checked against the data.gov.sg licence (R9).
11. **Docs**:
    - `docs/architecture.md`;
    - `docs/testing.md`, for the new e2e script;
    - the docs site pages `backend/api.md`, `backend/lightning.md` (sibling note) or a new `backend/rain.md`, `frontend/map.md` and `configuration.md` (`RAIN_FIXTURE`).
12. **Verification**: `npm run verify`, `scripts/e2e/rain-view.sh` (all stories and themes), and the rate-budget run (quickstart §5).

## Documentation to update (same change, per the constitution's Development Workflow)

- `.specify/memory/constitution.md`: Principle I (rain exception) and the Sync Impact Report.
- `docs/architecture.md`: a rain exception paragraph next to the lightning one, covering the anchor rule, cache, fixture and timing.
- `docs/theming.md`: the `--rain-*` variables, symbol rules and contrast rule.
- `docs/testing.md`: `scripts/e2e/rain-view.sh`.
- Docs site:
  - `docs/src/content/docs/backend/api.md`;
  - a new `backend/rain.md`;
  - `frontend/map.md`;
  - `configuration.md`;
  - `architecture/data-flow.md`.

## Spec updates made by this plan

- FR-005, SC-003 and US3 scenario 4 now use a **20-minute** out-of-date threshold instead of "5 minutes + cache". Gate 1 showed that the newest complete reading is normally about 10 minutes old (research R3). This is recorded in the spec's Clarifications section.
- The Gates section now records Gate 1 as passed, and Gate 2 as the first implementation task by the owner's choice.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle I: a second island-wide exception (rain), by amendment 1.5.0 | The spec's core goal (rain over the last 15 minutes, fresher than the last saved-location refresh) needs a fetch outside location create or refresh. The owner approved it on 2026-11-17. | Reusing readings from the last saved-location refresh (concept Option A) fails the 15-minute window and freshness decisions, shows nothing without saved locations, and probably still conflicts with the "not in a WeatherSnapshot" wording. |
