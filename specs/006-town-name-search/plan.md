# Implementation Plan: Town Name Search

**Branch**: `006-town-name-search` (not yet created; work currently sits on `005-wbgt-heat-stress-tile`) | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-town-name-search/spec.md`

## Summary

Add a town search field to the add-location form. As the user types, a type-ahead list shows matching NEA two-hour forecast areas (the 47 "towns"). Matching ignores case and spaces, matches word starts, and tolerates one wrong, missing or extra letter. Picking a town fills the latitude and longitude fields with that area's reference point. The user then presses Add and the existing create flow runs unchanged. The town list is a static frontend module captured live on 2026-11-14 ([research.md R1](research.md#r1-town-list-contents-live-check)), so searching makes no network call. The server already labels a location at an area's exact point with that area's name ([R3](research.md#r3-picked-town-is-labelled-as-itself-fr-007)), so no backend, API or schema change is needed.

## Technical Context

**Language/Version**: TypeScript 5.7, Node 22 (npm workspaces)

**Primary Dependencies**: React 18, Tailwind 3, Vite 7 (frontend); Express 4 (backend, unchanged). No new dependencies.

**Storage**: none new. Towns are bundled static data. Saved locations use the existing SQLite/Drizzle table unchanged.

**Testing**:
- **Unit**: vitest 4 (node environment, forks, no file parallelism). Frontend unit tests cover pure `.ts` modules only. One backend unit test is added in `weather.test.ts`.
- **Browser E2E**: agent-browser 0.42 (`scripts/e2e/town-search.sh`) against `DATABASE_PATH=backend/e2e.db npm run dev`.
- **DevTools checks**: chrome-devtools via MCPorter for the network log, typing trace and Lighthouse accessibility.
- **Scope**: browser checks run on demand, outside `npm test` and the pre-commit hook. They add to the Principle IV unit tests and don't replace them.

**Target Platform**: modern desktop browsers on the local dev origin `http://weather-starter.localhost:1355`

**Project Type**: web application (single Node process: Express + React/Vite)

**Performance Goals**: matches appear with no perceptible delay, under 0.5 s per SC-005. Matching 47 entries is sub-millisecond.

**Constraints**:
- Zero data.gov.sg calls from searching or on page load (FR-012, Principle I).
- Relative `/api/*` only (Principle II).
- Theme-driven classes only (Principle V).
- The `apple` theme stays visually unchanged apart from the new field.

**Scale/Scope**: 47 towns. One form component changes, plus two new pure modules and their tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Snapshot-only weather data | Searching reads a bundled list. Adding runs the existing create + refresh snapshot path. No new upstream call or endpoint. | PASS |
| II. One process, relative API | No new API calls. The form still uses `useStore().create`, and logging goes through the existing `logInteraction` (`/api/logs`). No new state container. Search state is component-local UI state, not server state. | PASS |
| III. Injectable weather provider | Weather access is untouched. The new backend test uses the existing `SingaporeWeatherClient` with the mocked `fetch` pattern already in `weather.test.ts`, with no network. | PASS |
| IV. Testing within real limits | Matching and the list live in pure modules (`townSearch.ts`, `towns.ts`) with unit tests. The component only wires them up. | PASS |
| V. Theme-driven UI | The new input and listbox reuse the form's existing `white`-based classes. The panel uses existing tokens, with no literal colours. | PASS |
| VI. Testing & quality gate | No new Express route, so no new Supertest suite is needed. `npm run lint` and `npm test` must pass before commit. | PASS |
| Workflow: docs | Frontend behaviour gains a component capability. Update `docs/architecture.md` (Frontend paragraph) and `docs/src/content/docs/frontend/overview.md`, and mark README roadmap item 3 as done. Testing behaviour changes, because an on-demand browser E2E layer is added, so `docs/testing.md` (and its Astro mirror) is updated too. No theming changes. | PASS (tasks include the doc updates) |
| IV/VI and browser tests | The E2E script and chrome-devtools checks don't change the vitest config or the pre-commit gate, and they don't stand in for the required unit tests. They use a throwaway `backend/e2e.db`, so the owner's data is untouched. | PASS |

**Post-design re-check (after Phase 1)**: unchanged, all PASS. The design adds no route, schema, dependency or theme token.

## Project Structure

### Documentation (this feature)

```text
specs/006-town-name-search/
├── plan.md              # This file
├── research.md          # Phase 0: live town list, bounds, labelling, matching, a11y, logging
├── data-model.md        # Phase 1: Town, TownMatch, form state transitions
├── quickstart.md        # Phase 1: automated + manual validation
├── contracts/
│   └── town-search.md   # Phase 1: towns.ts, townSearch.ts, form UI contract
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
frontend/src/components/
├── towns.ts                 # NEW: TOWNS (47 NEA forecast areas, attribution comment)
├── townSearch.ts            # NEW: searchTowns() pure matcher (R6)
├── townSearch.test.ts       # NEW: list guarantees + matching table (contract §1–2)
└── AddLocationForm.tsx      # CHANGED: town combobox, pick → fill coords, picked-town state

backend/src/
└── weather.test.ts          # CHANGED: "exact area point" labelling test (R3)

scripts/e2e/
└── town-search.sh           # NEW: agent-browser E2E per user story (quickstart §4); on demand, not in npm test

.gitignore                                            # CHANGED: ignore e2e-artifacts/ (screenshots, traces, Lighthouse)
docs/testing.md, docs/src/content/docs/guides/testing.md  # CHANGED: "Browser checks" section (agent-browser + chrome-devtools)
docs/architecture.md                                  # CHANGED: Frontend paragraph mentions town search
docs/src/content/docs/frontend/overview.md            # CHANGED: add-form description
README.md                                             # CHANGED: roadmap item 3 marked done
```

**Structure Decision**: this uses the existing two-workspace web app layout. All new code is frontend. The backend gets one test only, and no backend source changes.

## Complexity Tracking

No constitution violations. Nothing to justify.
