---

description: "Task list for Town Name Search"
---

# Tasks: Town Name Search

**Input**: Design documents from `specs/006-town-name-search/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/town-search.md](contracts/town-search.md), [quickstart.md](quickstart.md)

**Tests**: Included, at three levels:
1. **vitest unit tests** for the pure modules, as Constitution Principle IV requires. These run in `npm test`.
2. **agent-browser end-to-end script** (`scripts/e2e/town-search.sh`) that drives the real form in Chrome for each user story. This follows CLAUDE.md's routing: agent-browser for UI navigation, clicking `@eN`/role refs, form filling, screenshots and E2E checks.
3. **chrome-devtools checks** through MCPorter for the things agent-browser shouldn't own: the raw network log (SC-006, no data.gov.sg calls), a performance trace while typing (SC-005), and a Lighthouse accessibility audit (FR-014).

The browser checks need a running dev server, so they are **not** part of `npm test` or the pre-commit hook.

**Organization**: tasks are grouped by user story so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story from spec.md (US1, US2, US3)

## Path Conventions

Web app layout: `frontend/src/`, `backend/src/`. Browser scripts go in `scripts/e2e/`. All commands run from the repo root.

## Browser test environment (used by every agent-browser / chrome-devtools task)

- **Throwaway database**: start the app with `DATABASE_PATH=backend/e2e.db npm run dev`. The path is git-ignored through `backend/*.db`, and the owner's `backend/weather.db` is left alone. Reset between runs with `DATABASE_PATH=backend/e2e.db npm run reset`.
- **Base URL**: `http://weather-starter.localhost:1355`, overridable with `E2E_BASE_URL`.
- **agent-browser**: v0.42+ (`/opt/homebrew/bin/agent-browser`). Always use an isolated `--session town-search` and close it at the end.
- **chrome-devtools**: check with `mcporter daemon status`, and start it with `mcporter daemon start` if needed. Call tools as `mcporter call chrome-devtools.<tool> key:"value"`. Tools used: `new_page`, `navigate_page`, `take_snapshot`, `fill`, `type_text`, `press_key`, `click`, `list_network_requests`, `performance_start_trace`, `performance_stop_trace`, `performance_analyze_insight`, `lighthouse_audit` and `list_console_messages`.
- **Adding a location** triggers the normal create snapshot, so it calls data.gov.sg (about 12 calls). That is expected. *Searching* must cause zero calls.

---

## Phase 1: Setup

**Purpose**: a branch, and a place for browser test output.

- [X] T001 **(Done 2026-11-14: spec 005 committed first, then this branch was created from `005-wbgt-heat-stress-tile`, so it stacks on 005.)** Create and switch to branch `006-town-name-search` from `main` after the owner has committed or stashed the uncommitted `005-wbgt-heat-stress-tile` work (`git status` must be clean first). `.specify/feature.json` already points to `specs/006-town-name-search`.
- [X] T002 [P] Add `e2e-artifacts/` to `.gitignore` (under a new `# Browser test output` comment) so screenshots, traces and Lighthouse reports from the browser checks are never committed.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: the town list every story reads, and the browser-test harness every story's E2E check extends.

**⚠️ CRITICAL**: no user-story work can start until T003–T005 are done.

- [X] T003 Create `frontend/src/components/towns.ts`:
  - Export `interface Town { name: string; latitude: number; longitude: number }` and `export const TOWNS: readonly Town[]` with exactly the 47 entries from [research.md R1](research.md#r1-town-list-contents-live-check), in alphabetical order. Copy names and coordinates verbatim (for example `{ name: 'Bishan', latitude: 1.350772, longitude: 103.839 }`, `{ name: 'Sengkang', latitude: 1.384, longitude: 103.891443 }`).
  - Add a header comment with the source (`GET https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast` → `data.area_metadata`, captured 2026-11-14) and the attribution from [research.md R5](research.md#r5-licence): "Contains information from the NEA two-hour weather forecast accessed on 2026-11-14 from data.gov.sg, made available under the Singapore Open Data Licence v1.0."
  - Also note that the list must be updated by hand if NEA changes its areas.
  - Pure data: no other imports.
- [X] T004 Create `frontend/src/components/townSearch.test.ts` with a `describe('TOWNS')` block that asserts the contract §1 guarantees from [contracts/town-search.md](contracts/town-search.md):
  - `TOWNS.length === 47`.
  - "Names are unique (case-insensitive)" and "coordinate pairs are unique".
  - Every entry satisfies "1.1 ≤ latitude ≤ 1.5 and 103.6 ≤ longitude ≤ 104.1".
  - Woodlands (1.432, 103.786528), Sembawang (1.445, 103.818495), Sengkang (1.384, 103.891443), Punggol (1.401, 103.904) and Bishan (1.350772, 103.839) are present with those exact coordinates.
  - Run `npx vitest run frontend/src/components/townSearch.test.ts` and confirm it passes.
- [X] T005 [P] Create the agent-browser harness `scripts/e2e/town-search.sh` (bash, `set -euo pipefail`, executable).
  - **Setup**:
    - `BASE_URL="${E2E_BASE_URL:-http://weather-starter.localhost:1355}"`, `SESSION=town-search`, `OUT=e2e-artifacts/town-search`, then `mkdir -p "$OUT"`.
    - A `trap` that always runs `agent-browser --session "$SESSION" close`.
    - A preflight that `curl -sf "$BASE_URL/api/locations"` and exits with a clear message ("start the app with DATABASE_PATH=backend/e2e.db npm run dev") if it fails.
  - **Helpers**:
    - `ab()` wraps `agent-browser --session "$SESSION" "$@"`.
    - `open_form()`: `ab open "$BASE_URL"`, then `ab find role button click --name "Add Location"`, then `ab wait` for the combobox.
    - `town_type <text>`: `ab find role combobox fill --name "Town" "<text>"`.
    - `assert_value <label> <expected>`: reads `ab find label "<label>" ...` / `ab get value` and fails with a message on mismatch.
    - `assert_option <name>` / `assert_no_option <name>`: check `ab find role option ... --name`.
    - `assert_text <text>`: `ab get text body` contains the text.
    - `shot <name>`: `ab screenshot "$OUT/<name>.png"`.
    - `pass`/`fail` counters with a final summary. Exit 1 on any failure.
  - **Selection**: accept an optional story filter argument (`us1`, `us2`, `us3`, `themes`, or none for all) so later tasks can add one block per story.
  - Use role/label locators, not CSS classes, so the script tracks the ARIA contract in contracts §3. Run `bash -n scripts/e2e/town-search.sh` to syntax-check it.

**Checkpoint**: the town list exists and is tested, and the E2E harness is ready for story blocks.

---

## Phase 3: User Story 1: Find a town by name and add it (Priority: P1) 🎯 MVP

**Goal**: type part of a town name, pick it from a list, have the coordinates filled, press Add, and get a saved location labelled with that town.

**Independent Test**: `scripts/e2e/town-search.sh us1` passes against a fresh `backend/e2e.db` (quickstart.md §4).

### Tests for User Story 1 ⚠️

> Write these first and make sure they fail before T008.

- [X] T006 [P] [US1] In `frontend/src/components/townSearch.test.ts`, add a `describe('searchTowns')` block with the exact, prefix and word-prefix rows from contract §2:
  - `''` and `'   '` → `[]`.
  - `'bish'` → first result Bishan with tier 1.
  - `'BISHAN'` and `'  bishan '` → first result Bishan with tier 0.
  - `'angmokio'` → Ang Mo Kio tier 0; `'ang mo'` → Ang Mo Kio tier 1.
  - `'water'` → Central Water Catchment and Western Water Catchment, tier 2.
  - `'islands'` → Southern Islands and Western Islands, tier 2.
  - `'zzz'` → `[]`.
  - `'b'` → at most 8 results, all tier 1 or 2.
  - For any query, results are sorted by tier then name, and length ≤ `limit` (also test `limit = 3`).
  - SC-002: every `TOWNS` entry's full name returns that town first at tier 0.
- [X] T007 [P] [US1] In `backend/src/weather.test.ts`, add a test named `labels a location at an exact area point with that area ("exact area point")`:
  - Using the file's existing `installFetchMock` / `payloadFor` pattern and `NO_PACING`, give the two-hour forecast payload several real areas: Bishan (1.350772, 103.839), Ang Mo Kio (1.375, 103.839) and Toa Payoh (1.334304, 103.856327), each with a forecast.
  - Fetch a snapshot for latitude 1.350772, longitude 103.839 and assert `area === 'Bishan'` ([research.md R3](research.md#r3-picked-town-is-labelled-as-itself-fr-007)).
  - Adapt the payload builder minimally, or add a local override, without changing existing tests' behaviour.
- [X] T008 [P] [US1] In `scripts/e2e/town-search.sh`, add the `us1` block (quickstart.md §2 rows 1–3, 10):
  - **Sengkang by mouse**:
    - `open_form` → `town_type seng` → `assert_option Sengkang` → `ab find role option click --name Sengkang`.
    - Assert Latitude = `1.384`, Longitude = `103.891443`, and the text `Town: Sengkang`.
    - Assert `GET $BASE_URL/api/locations` (via `curl -s`) has no Sengkang yet: picking doesn't save (US1 sc.4). Take `shot us1-picked`.
    - `ab find role button click --name Add` → wait for a sidebar card whose text contains `Sengkang` → `shot us1-added` → `ab reload` → the card is still present.
  - **Other towns**: loop over `Woodlands Sembawang Punggol Bishan`, typing the full name, picking, Add, and asserting a card labelled with that name (SC-001, SC-003).
  - **Keyboard only, Yishun** (FR-014):
    - `open_form` → `ab find role combobox focus --name Town` → `ab keyboard type yi` → `ab press ArrowDown`, then `ArrowUp` as needed so the active option is Yishun. Read `aria-activedescendant` with `ab get attr aria-activedescendant` on the combobox.
    - `ab press Enter`, then assert Latitude = `1.418`, and that `/api/locations` still has **no** Yishun: Enter picked, it didn't submit.
    - `ab press Escape`, then click Cancel.
  - The block must fail before T009–T012 exist. Confirm by running it and seeing the combobox lookup fail.

### Implementation for User Story 1

- [X] T009 [US1] Create `frontend/src/components/townSearch.ts`:
  - Export `interface TownMatch { town: Town; tier: 0 | 1 | 2 | 3 }` and `searchTowns(query: string, towns: readonly Town[] = TOWNS, limit = 8): TownMatch[]`.
  - Implement [research.md R6](research.md#r6-matching-algorithm-fr-002-fr-003-fr-004) steps 1–2 and tiers 0–2 only:
    - Normalise to lower case, trim and collapse whitespace; the compact form also removes spaces.
    - An empty query gives `[]`.
    - Tier 0: exact match, normal or compact. Tier 1: the name starts with the query, normal or compact. Tier 2: any word of the name starts with the query.
  - Sort by tier, then `name.localeCompare`, and slice to `limit`.
  - Never throw. No side effects.
  - Leave a clearly named spot for tier 3 (US2). T006 must now pass.
- [X] T010 [US1] Extend `frontend/src/components/AddLocationForm.tsx` with the town combobox, following contract §3 and the data-model.md state transitions:
  - New state: `townQuery`, `activeIndex` (-1 when none), `listOpen` and `pickedTown: Town | null`. Derive `matches` with `useMemo(() => searchTowns(townQuery), [townQuery])`.
  - Render a visible label "Town" and an input above the Latitude/Longitude grid. The accessible name must be exactly "Town", because the E2E script locates it by that name. The placeholder is "Search a town, e.g. Sengkang". Use the same input classes as the existing coordinate inputs.
  - ARIA on the input: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded={listOpen}`, `aria-controls` pointing to the listbox id, and `aria-activedescendant` pointing to the active option id (use `useId()` for ids).
  - While `listOpen && matches.length > 0`, render a `role="listbox"` list under the input with up to 8 `role="option"` items. Each item's accessible name is the town name, with `aria-selected` for the active index.
  - Style it with theme classes only (`border-white/15 bg-white/10 text-white`, active `bg-white/20`) so Principle V holds. Literal colours are forbidden.
- [X] T011 [US1] In `frontend/src/components/AddLocationForm.tsx`, implement typing, keyboard handling and picking:
  - **onChange**: set `townQuery`, clear `pickedTown`, set `listOpen` to whether the trimmed query is non-empty, and reset `activeIndex` to 0 when there are matches (-1 otherwise).
  - **onKeyDown**: ArrowDown/ArrowUp move `activeIndex`, wrapping at the ends, and call `preventDefault`. Enter with the list open and an active option calls `preventDefault` (it MUST NOT submit the form) and picks that option. Escape closes the list.
  - **Close on blur**: use `onMouseDown` with `preventDefault` on options so a click picks before blur fires.
  - **pick(town)**: `setLatitude(String(town.latitude))`, `setLongitude(String(town.longitude))`, `setTownQuery(town.name)`, `setPickedTown(town)`, `setListOpen(false)`, and `logInteraction('location_town_picked', { town: town.name })`, importing from `../api`. Never log `townQuery` ([research.md R8](research.md#r8-logging-fr-015)).
  - Picking MUST NOT call `create`.
- [X] T012 [US1] In `frontend/src/components/AddLocationForm.tsx`, show the chosen-town indicator "Town: <name>" (small `text-white/60` text) only while `pickedTown` is set and `latitude === String(pickedTown.latitude) && longitude === String(pickedTown.longitude)`.
  - After a successful Add, clear `townQuery`, `pickedTown`, `listOpen` and `activeIndex` along with the existing coordinate reset in `onSubmit`.
  - Leave the existing Add path (`create({ latitude: Number(latitude), longitude: Number(longitude) })`) unchanged (FR-006, FR-009).
- [X] T013 [US1] Run the US1 checks against a fresh throwaway database:
  1. `DATABASE_PATH=backend/e2e.db npm run reset`.
  2. Start `DATABASE_PATH=backend/e2e.db npm run dev`.
  3. Run `scripts/e2e/town-search.sh us1`. All assertions must pass. Review `e2e-artifacts/town-search/us1-*.png`.
  4. Run `npx vitest run frontend/src/components/townSearch.test.ts backend/src/weather.test.ts`. Both must pass.

**Checkpoint**: US1 is fully usable and checked end to end. This is the MVP.

---

## Phase 4: User Story 2: Forgiving matching (Priority: P2)

**Goal**: spelling slips such as "punggole" and "tampnes", and any capitalisation, still find the intended town.

**Independent Test**: the unit near-match rows pass, and `scripts/e2e/town-search.sh us2` passes (quickstart.md §4).

### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] In `frontend/src/components/townSearch.test.ts`, add the near-match rows from contract §2 and SC-004:
  - `'punggole'` → Punggol within the first 3, with tier 3.
  - `'tampnes'` → Tampines within the first 3, with tier 3.
  - `'PUNGGOL'` → Punggol first, with tier 0.
  - `'SEMBAWANG'` → Sembawang first.
  - `'pu'` (under 3 characters) → no tier-3 results.
  - Exact and prefix matches always rank above near matches. For example, `'bedok'` → Bedok first at tier 0.
  - Confirm these fail before T016.
- [X] T015 [P] [US2] In `scripts/e2e/town-search.sh`, add the `us2` block (quickstart.md §2 rows 4–5):
  - For each of `punggole→Punggol`, `PUNGGOL→Punggol`, `tampnes→Tampines` and `SEMBAWANG→Sembawang`: `open_form`, `town_type <query>`, then assert the expected option is among the first 3 `role=option` entries (read them from `ab snapshot` / `ab find role listbox text`). Take `shot us2-<query>`.
  - `town_type water`: assert options `Central Water Catchment` and `Western Water Catchment`.
  - Cancel the form after each case so nothing is added.

### Implementation for User Story 2

- [X] T016 [US2] In `frontend/src/components/townSearch.ts`, add tier 3 per [research.md R6](research.md#r6-matching-algorithm-fr-002-fr-003-fr-004) step 3:
  - Only for compact queries of 3+ characters, and only for towns that matched no better tier.
  - Write a small local `levenshtein(a, b)` helper (no dependency). It's a match when the distance between the compact query and some prefix of the compact name, of length query−1 to query+1, is ≤ 1. Check each word of the name the same way.
  - Keep the sort and limit unchanged. T014 and all US1 tests must pass.
- [X] T017 [US2] Run `npx vitest run frontend/src/components/townSearch.test.ts` and `scripts/e2e/town-search.sh us2` with the throwaway-database dev server running. Both must pass.

**Checkpoint**: US1 and US2 both work. The near-match rows pass in unit and browser tests.

---

## Phase 5: User Story 3: Clear outcomes when a town can't be used (Priority: P3)

**Goal**: plain feedback for no match and already-saved towns, and a form that never shows a town mismatched to its coordinates.

**Independent Test**: `scripts/e2e/town-search.sh us3` passes (quickstart.md §4).

### Tests for User Story 3 ⚠️

- [X] T018 [P] [US3] In `scripts/e2e/town-search.sh`, add the `us3` block (quickstart.md §2 rows 6–9):
  - **No match**: `town_type zzz` → `assert_text "No matching town"`. No `role=option` is present. Then `ab find label Latitude fill 1.3508` succeeds, so the field is still enabled.
  - **Duplicate**: ensure Bishan is saved first (add it if `/api/locations` lacks it). Then pick `Bishan` → Add → `assert_text "Location already exists"`. The count of Bishan entries in `/api/locations` (by `weather.area`) is still 1. Take `shot us3-duplicate`.
  - **Edit clears pick**: pick `Tampines` → `assert_text "Town: Tampines"` → `ab find label Latitude fill 1.346` → assert `Town: Tampines` is no longer shown.
  - **Cancel clears**: type `ser` → Cancel → `open_form` → assert the Town, Latitude and Longitude values are all empty.
  - Confirm the no-match and edit-clears checks fail before T019–T020.

### Implementation for User Story 3

- [X] T019 [US3] In `frontend/src/components/AddLocationForm.tsx`, add the live region and no-match state:
  - A visually subtle `aria-live="polite"` element shows "N towns found" while matches exist, and "No matching town" when the trimmed `townQuery` is non-empty and `matches.length === 0`.
  - Show the no-match text visibly under the town input as `text-xs text-white/60`.
  - Show nothing for empty or whitespace input.
  - Keep the coordinate inputs enabled (FR-008).
- [X] T020 [US3] In `frontend/src/components/AddLocationForm.tsx`, clear `pickedTown` in the Latitude and Longitude `onChange` handlers while keeping `townQuery` (data-model.md transition "picked ──edit latitude or longitude──▶ idle"). Extend `cancel()` to also clear `townQuery`, `pickedTown`, `listOpen` and `activeIndex` (FR-010, FR-011).
- [X] T021 [US3] Run `scripts/e2e/town-search.sh us3`. The duplicate path should pass with no code change, because the existing `submitError` shows the server's 409 "Location already exists". If it doesn't, fix it in `frontend/src/components/AddLocationForm.tsx` without changing the backend, and re-run until the block passes.

**Checkpoint**: all three stories work independently and are browser-checked.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 [P] In `scripts/e2e/town-search.sh`, add the `themes` block (FR-016, Principle V, quickstart.md §2 row 11):
  - For each theme id in `frontend/src/theme/themes.ts`: select it with `ab find role combobox select --name <theme selector label> <id>`, or `ab select` on the theme `<select>`.
  - Then `open_form` → `town_type b` → `shot themes-<id>` with the list open.
  - Compare the `apple` shot against a baseline captured from `main` before this feature, using `ab diff screenshot --baseline e2e-artifacts/town-search/baseline-apple.png`. Only the added Town field area may differ.
  - Review every theme shot by eye for legibility.
- [X] T023 [P] Run an agent-browser accessibility scan of the open form: `agent-browser --session town-search a11y "$BASE_URL" --selector form --json > e2e-artifacts/town-search/a11y.json`, with the form opened and a list showing. There must be no violations on the combobox, listbox or options (FR-014). Add it as the final step of the default (all-stories) run in `scripts/e2e/town-search.sh`.
- [X] T024 chrome-devtools network check for SC-006 and FR-012 (quickstart.md §3). This is CDP network internals, so per CLAUDE.md it uses chrome-devtools, not agent-browser.
  1. `mcporter daemon status` (start it if needed).
  2. `mcporter call chrome-devtools.new_page url:"http://weather-starter.localhost:1355"`.
  3. `take_snapshot`, then click "Add Location" by its uid.
  4. `fill` the Town combobox with `seng`, `punggole`, `water` and `zzz` in turn.
  5. `mcporter call chrome-devtools.list_network_requests`. Assert **zero** requests to any `data.gov.sg` host and zero requests other than the initial page load assets and `/api/locations`. `POST /api/logs` is allowed only after a pick.
  6. Pick one town, then list again: one `POST /api/logs`, whose body (`get_network_request`) has `event: "location_town_picked"`, `metadata.town` set to the town name, and no search text.
  7. Save the request list to `e2e-artifacts/town-search/network.json`.
- [X] T025 chrome-devtools performance check for SC-005:
  1. `performance_start_trace` with reload false.
  2. Use `type_text` to type `sembawang` one key at a time into the Town field.
  3. `performance_stop_trace`, then `performance_analyze_insight` for INP / long tasks.
  4. Assert no interaction over 200 ms and no long task over 50 ms attributable to `AddLocationForm` or `townSearch`. That is well inside the spec's 0.5 s.
  5. Save the trace to `e2e-artifacts/town-search/typing-trace.json`.
- [X] T026 chrome-devtools Lighthouse and console check:
  - Run `mcporter call chrome-devtools.lighthouse_audit` (accessibility category) on the dashboard with the add form open. The accessibility score must not drop compared with a run on `main`, and there must be no new combobox, listbox or label failures.
  - `list_console_messages` must show no errors or React warnings from the form.
  - Save the report to `e2e-artifacts/town-search/lighthouse.json`.
- [X] T027 [P] Update `docs/testing.md` (required by the constitution workflow, because testing behaviour changes). Add a "Browser checks" section:
  - `scripts/e2e/town-search.sh [us1|us2|us3|themes]` uses agent-browser against `DATABASE_PATH=backend/e2e.db npm run dev`.
  - chrome-devtools (MCPorter) is used for network, performance and Lighthouse checks.
  - Output goes to the git-ignored `e2e-artifacts/`.
  - These checks are manual or run on demand, not part of `npm test` or the pre-commit hook.
  - They don't replace the vitest unit tests that Principle IV requires.
  - Mirror the same in `docs/src/content/docs/guides/testing.md`.
- [X] T028 [P] Update `docs/architecture.md` (Frontend paragraph): the add form has a town search backed by the static `components/towns.ts` list (47 NEA forecast areas, captured 2026-11-14) and the pure matcher `components/townSearch.ts`. Picking fills the coordinates, the user presses Add, and no weather call is made.
- [X] T029 [P] Update `docs/src/content/docs/frontend/overview.md` to describe the town field in `AddLocationForm`: matching rules, at most 8 results, and that picking fills the coordinates without saving.
- [X] T030 [P] Update `README.md` roadmap item 3 ("Singapore area picker") to show it's done. Note that manual lat/lon entry is kept and the list is bundled rather than fetched from `area_metadata` at runtime.
- [X] T031 Final gate:
  1. `npm run lint`, `npm test` and `npm run build -w frontend` must all pass (Principle VI, SC-007).
  2. With a fresh `backend/e2e.db` and the dev server running, run `scripts/e2e/town-search.sh` (all blocks) once more. It must pass.
  3. Stop the dev server and delete `backend/e2e.db`.

---

## Implementation Notes (2026-11-14)

- **T022**: no `main` baseline was captured for the `apple` diff. Getting one would mean stashing the owner's uncommitted spec-005 work. All five theme screenshots were reviewed by eye instead. The first review caught a real defect: the town list was translucent and sat beneath the sidebar cards. Fixed with a new `--popover-bg` token plus the `app-popover` class in `index.css`, and `relative z-10` on the form. `docs/theming.md` and the Astro theming page are updated.
- **T023**: the axe scan reports 0 violations. One "incomplete" colour-contrast item can't be measured over the gradient background and applies to the existing form labels as well.
- **T024**:
  - Searching seng, punggole, water and zzz made 0 data.gov.sg requests.
  - Picking Punggol sent one `POST /api/logs` with `{"event":"location_town_picked","metadata":{"town":"Punggol"}}` and no search text.
  - The request list is saved to `e2e-artifacts/town-search/network-search.txt`, with the CARTO key redacted.
- **T025**:
  - Typing "sembawang" gave an INP of 28 ms and CLS of 0.00.
  - The raw trace file couldn't be saved, because chrome-devtools' workspace roots exclude the repo. The summary is in `e2e-artifacts/town-search/typing-trace-summary.txt`.
- **T026**:
  - Lighthouse accessibility scored 97. Its only failing accessibility audit is `target-size` on the React Grab dev toolbar, not app UI. No comparison run on `main` was done.
  - The console showed a pre-existing `favicon.ico` 404 and a "form field should have an id or name" issue. `name` attributes were added to the Town, Latitude and Longitude inputs. The remaining unnamed field is the existing sidebar Search box.
- **Contract change**: `'islands'` also returns Jurong Island as a tier-3 near match, after the two tier-2 results. The contract and unit test are updated.

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T005)** → user stories.
- **US1 (T006–T013)** depends only on Foundational. It is the MVP.
- **US2 (T014–T017)** depends on T009, because it extends `townSearch.ts`. Its E2E block (T015) also needs the US1 form (T010–T011) to run.
- **US3 (T018–T021)** depends on T010–T012, because it extends the same form component.
- **Polish (T022–T031)** comes after the stories you plan to ship:
  - T022–T026 need the finished form.
  - T027–T030 can start once US1 is done.
  - T031 is last.

### Within each story

- Tests (unit and E2E) come before the implementation that makes them pass.
- T010 → T011 → T012 → T019 → T020 all edit `AddLocationForm.tsx` and must run in sequence.
- T008, T015, T018, T022 and T023 all edit `scripts/e2e/town-search.sh`. Each is [P] only relative to tasks in other files. Don't run two of them at the same time.

## Parallel Opportunities

- T002 (`.gitignore`) and T005 (E2E harness) can run alongside T003/T004.
- T006 (frontend unit), T007 (backend unit) and T008 (E2E script) touch three different files.
- T014 (unit) and T015 (E2E) can be written in parallel.
- US2's `townSearch.ts` work (T016) and US3's form work (T019–T020) can run in parallel once US1 is done.
- T027–T030 are separate doc files.
- The chrome-devtools checks (T024–T026) can run in parallel with each other on separate pages (`new_page`).

### Parallel example: User Story 1

```text
Task: "T006 [US1] searchTowns exact/prefix/word tests in frontend/src/components/townSearch.test.ts"
Task: "T007 [US1] exact-area-point labelling test in backend/src/weather.test.ts"
Task: "T008 [US1] us1 agent-browser block in scripts/e2e/town-search.sh"
```

## Implementation Strategy

### MVP first (US1 only)

1. T001–T002 → T003–T005 → T006–T013.
2. **Stop and validate**: `npm test`, plus `scripts/e2e/town-search.sh us1` green against a fresh `backend/e2e.db`.
3. Ship-ready: the owner can add Woodlands, Sembawang, Sengkang, Punggol and Bishan by name.

### Incremental delivery

1. Add US2 (T014–T017), so spelling slips find towns. Unit and browser tests must be green.
2. Add US3 (T018–T021), for clear no-match, duplicate and clearing behaviour. The browser test must be green.
3. Polish (T022–T031):
   - Run the theme and accessibility sweep with agent-browser.
   - Run the network, performance and Lighthouse checks with chrome-devtools.
   - Update the docs.
   - Pass the final gate.

Commit only after `npm run lint` and `npm test` pass (the pre-commit hook enforces them). Browser checks are run on demand before opening the PR.
