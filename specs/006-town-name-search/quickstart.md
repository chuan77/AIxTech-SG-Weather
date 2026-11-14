# Quickstart: validate Town Name Search

**Feature**: [spec.md](spec.md) | **Contracts**: [contracts/town-search.md](contracts/town-search.md)

## Prerequisites

- Run from the repo root, with `npm install` done.
- Optional: start from a fresh database with `npm run reset`.

## 1. Automated checks

```bash
npx vitest run frontend/src/components/townSearch.test.ts   # matching table (contract §2), list guarantees (contract §1)
npx vitest run backend/src/weather.test.ts -t "exact area point"   # a location at Bishan's point is labelled Bishan (research R3)
npm test                      # SC-007: whole suite still passes
npm run lint                  # Principle VI gate
npm run build -w frontend     # type-check + build
```

Expected: all pass. The town-search tests cover SC-002 (all 47 found by full name), SC-004 (punggole / PUNGGOL / tampnes) and the bounds and uniqueness guarantees.

## 2. Manual walk-through (`npm run dev` → http://weather-starter.localhost:1355)

| # | Steps | Expected | Covers |
|---|-------|----------|--------|
| 1 | Add Location → type `seng` → pick **Sengkang** | Lat/Lon show 1.384 / 103.891443, "Town: Sengkang" is shown, and nothing is saved yet | US1 sc.1–2, 4 |
| 2 | Press **Add** | A new card labelled **Sengkang** is selected and has weather. A reload keeps it | US1 sc.3, SC-003 |
| 3 | Repeat steps 1–2 for Woodlands, Sembawang, Punggol and Bishan | Each card is labelled with its town | SC-001 |
| 4 | Type `punggole`, then `PUNGGOL`, then `tampnes` | The intended town is in the first 3 each time | US2, SC-004 |
| 5 | Type `water` | Both "… Water Catchment" areas are listed | US2 sc.3 |
| 6 | Type `zzz` | "No matching town" appears and the coordinate fields still work | US3 sc.1 |
| 7 | Pick **Bishan** again (already saved) → Add | "Location already exists" appears and no second card is created | US3 sc.2 |
| 8 | Pick a town, then edit Latitude | The "Town:" indicator disappears. Add saves at the edited point | US3 sc.4, FR-010 |
| 9 | Type text → Cancel → reopen | All fields are empty | US3 sc.3 |
| 10 | Keyboard only: Tab to Town, type `yi`, ↓, Enter | Yishun is picked and the form is **not** submitted | FR-014 |
| 11 | Switch through every theme | The field and list are legible and the `apple` look is unchanged | FR-016 |

## 3. No upstream calls (SC-006)

With DevTools → Network filtered to `data.gov.sg`, reload the page, open the add form and search several towns. Expect zero requests. Requests appear only after pressing Add, which runs the existing create snapshot. The server log (`backend/logs/app.log`) shows `location_town_picked` with the town name and never the typed search text. This check is automated with chrome-devtools in §5.

## 4. Automated browser walk-through (agent-browser)

The §2 table is scripted in `scripts/e2e/town-search.sh`. It needs a running dev server against a throwaway database:

```bash
DATABASE_PATH=backend/e2e.db npm run reset
DATABASE_PATH=backend/e2e.db npm run dev            # leave running
scripts/e2e/town-search.sh us1                       # rows 1–3, 10 (MVP)
scripts/e2e/town-search.sh us2                       # rows 4–5
scripts/e2e/town-search.sh us3                       # rows 6–9
scripts/e2e/town-search.sh themes                    # row 11, plus apple baseline diff
scripts/e2e/town-search.sh                           # everything, plus the a11y scan
```

Expected: each block prints its pass count and exits 0. Screenshots and `a11y.json` land in `e2e-artifacts/town-search/`, which is git-ignored. The script locates elements by role and accessible name (combobox "Town", options by town name, buttons "Add Location", "Add" and "Cancel"), so it also enforces the ARIA contract in [contracts/town-search.md §3](contracts/town-search.md#3-ui-contract-add-location-form-addlocationformtsx).

## 5. DevTools checks (chrome-devtools via MCPorter)

Per CLAUDE.md, raw network, performance and Lighthouse checks go through chrome-devtools rather than agent-browser.

```bash
mcporter daemon status || mcporter daemon start
mcporter call chrome-devtools.new_page url:"http://weather-starter.localhost:1355"
mcporter call chrome-devtools.take_snapshot          # find uids for "Add Location" and the Town combobox
# open the form, fill Town with seng / punggole / water / zzz, then:
mcporter call chrome-devtools.list_network_requests
mcporter call chrome-devtools.performance_start_trace reload:false autoStop:false
# type_text "sembawang" into Town
mcporter call chrome-devtools.performance_stop_trace
mcporter call chrome-devtools.lighthouse_audit
mcporter call chrome-devtools.list_console_messages
```

| Check | Expected | Covers |
|-------|----------|--------|
| Network while searching | 0 requests to `*.data.gov.sg`. After a pick, exactly one `POST /api/logs` with `location_town_picked` and `{ town }`, and no search text | SC-006, FR-012, FR-015 |
| Typing trace | No interaction over 200 ms and no long task over 50 ms from the form or matcher | SC-005 |
| Lighthouse accessibility | Score not lower than on `main`, with no combobox, listbox or label failures | FR-014 |
| Console | No errors or React warnings from the form | — |

Save outputs as `e2e-artifacts/town-search/{network,typing-trace,lighthouse}.json`.
