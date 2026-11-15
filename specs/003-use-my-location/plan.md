# Implementation Plan: Use My Location

**Branch**: `003-use-my-location` (not yet created; the working tree is on `006-town-name-search` with uncommitted frontend design work, which should be committed first) | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-use-my-location/spec.md`

## Summary

Add a "Use my location" button beside "Add Location" in the sidebar. A press asks the browser for the user's position once, with the browser's own prompt as consent. A pure module then decides the outcome:
- outside Singapore: show a message;
- within 100 m of a saved place: select that place and say "Already saved";
- otherwise: add the position through the existing `create` path, which validates bounds, loads the snapshot and selects the new location.

Each failure (denied, unavailable, timed out, outside Singapore) gets its own plain message, and manual entry stays untouched. Creates from this source log no coordinates. No backend, API or schema change is needed ([research R1–R7](research.md)).

## Technical Context

**Language/Version**: TypeScript 5.7, Node 22 (npm workspaces)

**Primary Dependencies**: React 18, Tailwind 3, Vite 7 (frontend); Express 4 (backend, unchanged). Browser Geolocation API. No new dependencies.

**Storage**: none new. A geolocated location is an ordinary saved location in the existing SQLite/Drizzle table.

**Testing**:
- **Unit**: vitest 4 (node environment, forks, no file parallelism). Pure frontend modules only (`geolocate.ts`, `nearbySaved.ts`).
- **Browser E2E**: agent-browser (`scripts/e2e/use-my-location.sh`), on demand, against `DATABASE_PATH=backend/e2e.db npm run dev`, using `set geo` for the emulated position.
- **Manual**: one real Chrome run accepting the prompt, to record accuracy ([R3](research.md#r3-plain-http-localhost-fr-008-sc-007)).

**Target Platform**: Chrome on the local dev origin `http://weather-starter.localhost:1355` (verified secure context). Firefox and Safari are untested; a failed attempt there says so (FR-010).

**Project Type**: web application (single Node process: Express + React/Vite)

**Performance Goals**: a saved, refreshed location within 10 s of allowing sharing (SC-002). The geolocation timeout is 10 s; the create snapshot uses the existing paced provider path.

**Constraints**:
- No geolocation request before a press, and no tracking (FR-002, FR-012).
- No precise coordinates in logs for this source (FR-009).
- No data.gov.sg call outside the existing create snapshot (Principle I).
- Relative `/api/*` only (Principle II).
- Theme-driven classes, 44px touch targets, and every theme readable (Principle V; PRODUCT.md accessibility).

**Scale/Scope**: one new button and message row in the sidebar, two new frontend modules (one pure), one small store change, one helper gaining a parameter.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Snapshot-only weather data | Adding goes through `POST /api/locations`, which fetches the snapshot as any create does. Position lookup and the duplicate check are local. No new upstream call or endpoint, and nothing runs on page load. | PASS |
| II. One process, relative API | No new API. The flow calls `useStore().create` (gaining an optional `{ source }` option) and `select`. Logging uses the existing `logInteraction`. Attempt state is component-local UI state. | PASS |
| III. Injectable weather provider | Weather access is untouched. | PASS |
| IV. Testing within real limits | All decisions (bounds, 100 m rule, error mapping, messages, browser note, log payload) live in the pure `geolocate.ts` with unit tests. The `navigator.geolocation` adapter and the component only wire them up. | PASS |
| V. Theme-driven UI | The button reuses the sidebar's `rounded-card`/`white`-token button styles. The message row reuses existing status and error styles (`text-ink-muted`, the `--error-text` override). There are no literal colours. It is checked in all six themes. | PASS |
| VI. Testing & quality gate | No new Express route, so no new Supertest suite is needed. `npm run lint` and `npm test` must pass before commit. | PASS |
| Workflow: docs | Frontend behaviour changes, so update `docs/architecture.md` (Frontend paragraph: geolocation entry point, 100 m rule, logging rule) and `docs/src/content/docs/frontend/overview.md` (sidebar and add flow). Add the E2E script to the "Browser checks" section of `docs/testing.md` and its Astro mirror. PRODUCT.md already lists the feature as delivered, so it becomes true. No theming change. | PASS (tasks include the doc updates) |

**Post-design re-check (after Phase 1)**: unchanged, all PASS. The design adds no route, schema, dependency or theme token. The only shared-code changes are the optional `create` argument and `savedNear`'s optional `maxKm`, and both keep their existing callers' behaviour.

## Project Structure

### Documentation (this feature)

```text
specs/003-use-my-location/
├── plan.md              # This file
├── research.md          # Phase 0: placement, API options, duplicate rule, messages, logging, browser note, tests
├── data-model.md        # Phase 1: DetectedPosition, GeolocateOutcome, attempt state machine
├── quickstart.md        # Phase 1: automated, E2E and manual validation
├── contracts/
│   └── use-my-location.md   # Phase 1: geolocate.ts, geolocation.ts, store.create option, UI contract
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
frontend/src/components/
├── geolocate.ts             # NEW: pure decisions: classify, error mapping, messages, browser note, log payload
├── geolocate.test.ts        # NEW: unit tests for the above (contract §1)
├── geolocation.ts           # NEW: thin promise adapter over navigator.geolocation (contract §2)
├── UseMyLocation.tsx        # NEW: button + message row; wires adapter, geolocate.ts, store
├── nearbySaved.ts           # CHANGED: savedNear(…, maxKm = SAME_PLACE_KM)
├── nearbySaved.test.ts      # CHANGED: maxKm case
├── icons.tsx                # CHANGED: LocateIcon (crosshair), same stroke family
└── Sidebar.tsx              # CHANGED: renders UseMyLocation beside AddLocationForm's button

frontend/src/state/store.tsx # CHANGED: create(payload, { source? }) omits coordinates from logs for 'geolocation'
frontend/src/types.ts        # CHANGED: StoreValue.create signature

scripts/e2e/use-my-location.sh   # NEW: agent-browser E2E per user story; on demand, not in npm test

docs/architecture.md                                     # CHANGED: Frontend paragraph
docs/src/content/docs/frontend/overview.md               # CHANGED: sidebar / add flow
docs/testing.md, docs/src/content/docs/guides/testing.md # CHANGED: list the new E2E script
frontend/DESIGN.md                                       # CHANGED: sidebar button row in Layout/Components
```

**Structure Decision**: this uses the existing two-workspace web app layout. All code is frontend. The backend is unchanged, because its create route already validates bounds, rejects exact duplicates with 409, and labels the location with the nearest forecast area.

## Complexity Tracking

No constitution violations. Nothing to justify.
