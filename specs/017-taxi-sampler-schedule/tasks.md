---
description: "Tasks for spec 017: taxi-rain study samples on time"
---

# Tasks: Taxi-rain study samples on time

**Input**: Design documents from `/specs/017-taxi-sampler-schedule/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dispatch-request.md, quickstart.md

**Tests**: Included. Constitution IV requires a bug fix to come with a test that fails without it. Plan.md lists vitest tests for every new pure function. Tests make no network calls.

**Organization**: Grouped by user story (spec.md): US1 P1 on-time sampling, US2 P2 backfill, US3 P3 health.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- All code lives in `scripts/research/` next to the existing sampler. Nothing under `frontend/` or `backend/` changes (FR-005).

---

## Phase 1: Setup

- [X] T001 Create branch `017-taxi-sampler-schedule` from `main`. Carry the uncommitted `data/vercel.json` lines from `.github/workflows/taxi-rain-study.yml` onto it (the same change as open PR #29), and leave the other uncommitted files (`.impeccable/config.json`, `docs/deployment.md`, `.specify/assessments/*`) out of this branch's commits.
- [X] T002 **Owner, no code** (US1 go-live): create the fine-grained PAT (`chuan77` → only `AIxTech-SG-Weather`, Repository permission **Actions: Read and write** only, expiry **2026-12-04**). Create the cron-job.org job exactly as in `specs/017-taxi-sampler-schedule/contracts/dispatch-request.md`: POST, every 15 min, Asia/Singapore, failure notifications on. Press Test run and expect `204`. Never commit or paste the token.
- [X] T003 Confirm the trigger works: `gh run list --workflow taxi-rain-study.yml --limit 5` shows a successful `workflow_dispatch` run within 15 minutes of T002, and a new row appears on `origin/research/taxi-rain-data:taxi-rain.csv`.

---

## Phase 2: Foundational (shared slot helpers)

**Purpose**: Slot maths and CSV reading used by US1, US2 and US3. Blocks all three.

- [X] T004 Write failing tests in `scripts/research/taxi-rain-sample.test.mjs`:
  - `slotOf('2026-11-20T09:14:59.999Z') === '2026-11-20T09:00:00Z'`
  - `slotOf('2026-11-20T09:15:00.000Z') === '2026-11-20T09:15:00Z'`
  - `runTimes(csvText)` returns the `run_at_utc` column without the header, ignores blank lines, and returns `[]` for `''`.
- [X] T005 Implement and export `slotOf(iso)` (round down to the quarter hour in UTC, output format `YYYY-MM-DDTHH:mm:00Z`), `runTimes(csvText)` (first column of each data row) and `listSlots(fromIso, toIso)` (every 15 min, end exclusive) in `scripts/research/taxi-rain-sample.mjs`. Also export the existing `TAXI_URL`, `RAIN_URL`, `STUDY_END` and `getJson` so the backfill reuses them. Don't change `HEADER`, `buildRow` or row formatting (FR-003).

**Checkpoint**: `npx vitest run scripts/research` passes.

---

## Phase 3: User Story 1 — Samples arrive every 15 minutes (P1) 🎯 MVP

**Goal**: At most one live row per 15-minute slot, whichever trigger fired (cron-job.org or GitHub's backup schedule). The trigger's setup is documented in the repo.

**Independent Test**: After 24 h live, the health numbers (or a manual count of `taxi-rain.csv`) show ≥ 85 new rows and no gap > 30 min. No slot has two rows dated after this change merges.

- [X] T006 [US1] Write a failing test in `scripts/research/taxi-rain-sample.test.mjs`: `slotTaken(csvText, '2026-11-20T09:00:00Z')` is `true` when a row has `run_at_utc` `2026-11-20T09:07:12.000Z`, `false` when the only row is in `08:45`, and `false` for an empty or header-only file. This test fails on today's code: it's the duplicate-slot bug test that Constitution IV requires.
- [X] T007 [US1] Implement and export `slotTaken(csvText, slot)` in `scripts/research/taxi-rain-sample.mjs` using `runTimes` and `slotOf`. In `main()`, after the `STUDY_END` check and **before** any fetch: if the file exists and `slotTaken(readFileSync(file,'utf8'), slotOf(runAt))`, log `slot <slot> already sampled; nothing collected` and return (exit 0, no upstream calls).
- [X] T008 [P] [US1] Update the header comments in `.github/workflows/taxi-rain-study.yml` (FR-010). Say that the primary trigger is the owner's cron-job.org job calling `workflow_dispatch` every 15 min (spec 017), that `schedule:` stays as a backup and the slot check stops duplicates, that `workflow_dispatch:` must not be removed before the study ends, and give the end-of-study steps (disable the cron job, revoke the PAT, delete this workflow). Keep the `data/vercel.json` lines from T001.
- [X] T009 [P] [US1] Append a dated note to `.specify/assessments/sg-transport-data/decision.md` under "If needs-clarification". Say that only 7 samples were collected 2026-11-18 → 2026-11-20 because GitHub throttled the schedule, that the trigger moved to cron-job.org on 2026-11-20 (spec 017), and that missed slots will be backfilled.
- [ ] T010 [US1] Run `npm run verify`. Open a `fix:` PR from `017-taxi-sampler-schedule` that says it supersedes PR #29, then close #29 with a link to it.

**Checkpoint**: US1 is complete once T003 has passed and T010 has merged.

---

## Phase 4: User Story 2 — Recover the lost days (P2)

**Goal**: One row per missed slot from `2026-11-18T13:45:00Z`, using values the sources published for that time, written to `taxi-rain-backfill.csv`. Re-runs are safe.

**Independent Test**: The first run adds about one row per missed slot. A second run adds 0. No slot appears in both files.

- [X] T011 [P] [US2] Write tests in `scripts/research/taxi-rain-backfill.test.mjs`:
  - `listSlots('2026-11-18T13:45:00Z','2026-11-18T14:30:00Z')` returns 3 slots (13:45, 14:00, 14:15). The end is exclusive.
  - `sgtLocal('2026-11-18T16:00:00Z') === '2026-11-19T00:00:00'` (+8 h, no offset, matching research R4).
  - `missingSlots(slots, liveCsv, backfillCsv)` drops any slot taken in either file.
  - `pastUrls(slot)` builds `…/taxi-availability?date_time=<sgtLocal>` and `…/rainfall?date=<sgtLocal>` with the time URL-encoded.
- [X] T012 [US2] Create `scripts/research/taxi-rain-backfill.mjs` (importing `listSlots` from the sampler) with exported `sgtLocal`, `missingSlots`, `pastUrls`, and a `main()` that:
  - takes the usage `node scripts/research/taxi-rain-backfill.mjs <live-csv> <backfill-csv> [--from ISO] [--to ISO]`;
  - defaults `--from` to `2026-11-18T13:45:00Z`, and `--to` to the earlier of `slotOf(now)` (the current slot is excluded, because the live sampler owns it) and `STUDY_END`;
  - for each missing slot, fetches both past URLs with `getJson`, parses them with `parseTaxis` and `parseRain`, and appends `buildRow(slot, taxis, rain, errors)` (header first if the file is new);
  - waits **6 s** between slots;
  - stops with exit 1 after **3 slots in a row** where both sources failed, so a re-run resumes;
  - logs a progress line every 10 slots.
- [X] T013 [US2] Add a header comment to `scripts/research/taxi-rain-backfill.mjs` matching the sampler's style. It should say: research only; keyless; past-time queries verified 2026-11-20 (spec 017 research R4); backfilled rows are marked by their file, not a column; no interpolation; run locally, then push the file to `research/taxi-rain-data`.
- [ ] T014 [US2] After PR 2 merges (T020), follow `specs/017-taxi-sampler-schedule/quickstart.md` §2: check out the data branch in a worktree under the scratchpad, run the backfill, commit `taxi-rain-backfill.csv` and push to `research/taxi-rain-data`. Run it a second time and confirm it adds 0 rows. Remove the worktree.

---

## Phase 5: User Story 3 — See that sampling is healthy (P3)

**Goal**: One command shows the last sample, the 24 h count, the largest gap and coverage.

**Independent Test**: Given a CSV whose last row is 60+ min before `now`, the output shows the gap. Given an on-time CSV, it shows ≥ 85 samples in 24 h.

- [X] T015 [P] [US3] Write tests in `scripts/research/taxi-rain-health.test.mjs` for `summarize({ live, backfill, now, from })`, where `live` and `backfill` are arrays of ISO run times:
  - It returns `last_sample_utc`, `minutes_since_last`, `samples_last_24h`, `largest_gap_last_24h_min` (including the gap from the last sample to `now`), and `slot_coverage_pct` over `listSlots(from, slotOf(now))`, counting live and backfilled slots separately and combined.
  - Cover: an empty input, a 60-min stall, and 96 evenly spaced samples, which should give `samples_last_24h` 96 and the largest gap ≈ 15.
- [X] T016 [US3] Create `scripts/research/taxi-rain-health.mjs`:
  - Export `summarize`, reusing `slotOf`, `runTimes` and `listSlots`.
  - Its `main()` takes the usage `node scripts/research/taxi-rain-health.mjs <live-csv> [backfill-csv]`, and accepts `-` for the live CSV to read it from stdin.
  - It prints one `key: value` line per field, and exits 1 if `minutes_since_last > 30` so it can be scripted.

---

## Phase 6: Polish & Cross-Cutting

- [X] T017 [P] Update `specs/017-taxi-sampler-schedule/quickstart.md` §1 and §2 if the final CLI flags or file names differ from the plan.
- [X] T018 [P] Add one line to the `scripts/research/` section of `docs/architecture.md`, if it has one, pointing to the backfill and health scripts. If it doesn't have one, skip this task, because the research scripts are not app architecture.
- [X] T019 Run `npm run verify`. Lint, typecheck, tests and build must all pass.
- [ ] T020 Open a `feat:` PR for US2 and US3 (it can share a branch with US1 if PR 1 is still open), with the attribution footer.
- [ ] T021 24 h after T003, run the health command (quickstart §1) and record SC-001 (≥ 85 samples, largest gap ≤ 30 min) in `.specify/assessments/sg-transport-data/decision.md`.

---

## Dependencies & Execution Order

- **T002 → T003** happens first and needs no code, because it stops the data loss.
- **Phase 2 (T004–T005)** blocks every story.
- **US1 (T006–T010)**: T006 → T007. T008 and T009 can run in parallel with them.
- **US2 (T011–T014)** depends only on Phase 2. T014 also needs the merged code.
- **US3 (T015–T016)** depends only on Phase 2 (`listSlots` lives in the sampler, T005).
- **Polish** comes after the stories it touches. T021 is time-gated (24 h after T003).

## Parallel Example

```text
After T005:
  T006 (sample test)   ‖  T011 (backfill tests)  ‖  T015 (health tests)
  T008 (workflow doc)  ‖  T009 (decision note)
```

## Implementation Strategy

1. **MVP = T002–T003**: the owner sets up cron-job.org, and data flows every 15 minutes from then on.
2. **PR 1 = Phase 2 + US1**: no duplicate slots, documented, and supersedes #29.
3. **PR 2 = US2 + US3**: recover the missed slots and add the health command. Run the backfill once.
4. At the study end (2026-12-03), re-run the backfill to fill outage gaps. Then disable the job, revoke the token and delete the workflow (quickstart §4).
