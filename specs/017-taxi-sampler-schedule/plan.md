# Implementation Plan: Taxi-rain study samples on time

**Branch**: `017-taxi-sampler-schedule` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/017-taxi-sampler-schedule/spec.md`

## Summary

GitHub's own schedule has started the taxi-rain sampler only about every 6–8 hours. The fix has three parts:

1. **The owner's cron-job.org account starts the existing workflow every 15 minutes** using a token that can only start workflows. This needs no code, so it goes live first ([quickstart §0](quickstart.md)).
2. **A slot check in the sampler** keeps one row per 15-minute slot. GitHub's schedule stays on as a backup and can't add duplicates.
3. **A one-off backfill script and a health script.** Live probes showed that both sources answer past-time queries ([research R4](research.md)), so the roughly 185 missed slots can be recovered for both taxis and rain.

The app, its API, database, deploys and constitution don't change.

## Technical Context

**Language/Version**: Node 24, ES modules (`.mjs`), the same as `scripts/research/taxi-rain-sample.mjs`.

**Primary Dependencies**: none new. Built-in `fetch` and `node:fs` only.

**Storage**: CSV files on the orphan branch `research/taxi-rain-data`: `taxi-rain.csv` (live) and the new `taxi-rain-backfill.csv`.

**Testing**: vitest, which already picks up `scripts/research/**/*.test.mjs` (`vitest.config.ts`). Tests use pure functions and make no network calls.

**Target Platform**: GitHub Actions `ubuntu-latest` for live runs. The owner's Mac for the one-off backfill and the health check.

**Project Type**: research scripts plus CI workflow config. Not part of the app.

**Performance Goals**: at least 90% of slots sampled per 24 hours. Backfill paced at one slot every 6 s (about 20 min for about 185 slots).

**Constraints**: keyless upstream calls only. A token that can only start workflows (FR-006). No change under `frontend/` or `backend/`. No Vercel builds.

**Scale/Scope**: about 1,393 slots in the study. Two scripts (one changed, one new) plus one small new health script and their tests. Comment and doc updates in one workflow file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | Status |
|---|---|---|
| I. Snapshot-only weather data | The app's data.gov.sg calls only. These scripts never run in the server and store nothing in SQLite | ✅ Not affected (same position the study took in concept.md) |
| II. One process, relative API | No server change | ✅ N/A |
| III. Injectable weather provider | No app weather calls | ✅ N/A |
| IV. Testing within real limits | Pure functions get vitest tests. The bug fix (duplicate slots) gets a test that fails without it | ✅ Planned |
| V. Theme-driven UI | No UI | ✅ N/A |
| VI. Testing & quality gate | `npm run lint` and `npm test` cover `scripts/research`. No `--no-verify` | ✅ Planned |
| Technical constraints: secrets MUST NOT be committed | The token lives only in cron-job.org | ✅ |

**Post-design re-check**: ✅ No violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/017-taxi-sampler-schedule/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/dispatch-request.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
.github/workflows/
└── taxi-rain-study.yml            # comments: new trigger, backup role, end-of-study steps (FR-010);
                                   # keeps the data/vercel.json write (same as PR #29)
scripts/research/
├── taxi-rain-sample.mjs           # + slotOf(), slotTaken(csvText, slot); skip if the slot is taken
├── taxi-rain-sample.test.mjs      # + slot tests (one fails on today's code)
├── taxi-rain-backfill.mjs         # new: missing slots → past-time calls → backfill CSV (FR-008)
├── taxi-rain-backfill.test.mjs    # new: slot listing, SGT time format, skip rules, re-run adds 0
├── taxi-rain-health.mjs           # new: last sample, 24 h count, largest gap, coverage (FR-009)
└── taxi-rain-health.test.mjs      # new
.specify/assessments/sg-transport-data/
└── decision.md                    # note: trigger moved to cron-job.org on 2026-11-20, rows lost before that
```

**Structure Decision**: Everything sits next to the existing sampler in `scripts/research/`, reusing its exported `parseTaxis`, `parseRain`, `buildRow` and `HEADER`, so all rows are built the same way.

## Delivery Order (urgency)

1. **Now, by the owner, no code**: create the token and the cron-job.org job, following [quickstart §0](quickstart.md). This stops the data loss.
2. **PR 1** (`fix:`): the slot check, the workflow comments, and the `vercel.json` change from PR #29. Close #29 in favour of it, or merge #29 first, and drop the local uncommitted copy.
3. **PR 2** (`feat:`): the backfill and health scripts. After it merges, run the backfill once and push the file to the data branch.

## Risks

- **The token can also re-run or cancel runs.** Accepted by the owner. `ci.yml` can't be started by hand.
- **cron-job.org outage**: the GitHub schedule backup and failure emails cover it, and the backfill fills the gaps again at the study end.
- **Upstream rate limits during the backfill**: paced at 6 s per slot, and it stops after 3 errors in a row, so a re-run resumes where it left off.
- **Past taxi positions may be thinner than live ones** (the archive could be sparser). The health script reports backfilled rows separately so the analysis can compare them.
