# Research: Taxi-rain study samples on time

**Feature**: [spec.md](spec.md) | **Date**: 2026-11-20

## R1. Why the samples are missing

- **Finding**: The workflow asks for `*/15 * * * *`, but GitHub started only 6 scheduled runs between 2026-11-18 13:56Z and 2026-11-20 09:05Z, about one every 6–8 hours. There was also 1 manual run. All 7 runs succeeded in 13–17 seconds. So the sampler works; the trigger is the problem.
- **Source**: `gh run list --workflow taxi-rain-study.yml` and the `research/taxi-rain-data` CSV (7 rows), checked 2026-11-20.
- **Decision**: Replace the trigger, and leave the sampling logic as it is.

## R2. Trigger: cron-job.org starts the workflow by hand-start request

- **Decision**: The owner's cron-job.org job sends `POST /repos/chuan77/AIxTech-SG-Weather/actions/workflows/taxi-rain-study.yml/dispatches` with `{"ref":"main"}` every 15 minutes. The request format is in [contracts/dispatch-request.md](contracts/dispatch-request.md).
- **Rationale**: This is the owner's choice (spec FR-011). It needs no code, so it can be live before any change merges. The workflow, data branch and sampler stay the same. The repository is **public**, so Actions minutes are free: about 96 runs a day × ~15 s ≈ 25 runner-minutes a day.
- **Token**: a fine-grained personal access token with resource owner `chuan77`, access to the selected repository `AIxTech-SG-Weather` only, and the single repository permission **Actions: Read and write** (Metadata: read is added automatically). It expires 2026-12-04, the day after the study ends, and is stored only in the cron-job.org job.
- **Residual risk (accepted by the owner, 2026-11-20)**: the token can also re-run or cancel existing workflow runs. `taxi-rain-study.yml` is the only workflow that can be started by hand (`ci.yml` runs only on push and pull request), so the worst case is re-running an old CI run on `main`. That redeploys a commit that is already live and changes no code. It cannot read secrets or push code.
- **Alternatives considered**:
  - A Vercel Schedules project (Hobby allows a run every 15 minutes, but the product is in beta, and it needs its own project plus the same token).
  - Vercel Cron Jobs (only once a day on Hobby).
  - A Cloudflare Worker that stores the rows itself (moves the data out of the repo).
  - A local launchd job (needs a machine that stays awake, against FR-002).

## R3. Keep GitHub's own schedule as a backup?

- **Decision**: Keep `schedule:` as a backup. Add a check that skips the run when the current 15-minute slot already has a row.
- **Rationale**: If cron-job.org has an outage, the backup still adds a few rows a day. The workflow's `concurrency: taxi-rain-study` group (`cancel-in-progress: false`) already runs one job at a time, so two triggers can't race on the same file. The slot check (R5) makes the second trigger in a slot exit before it calls any upstream source.
- **Alternative**: Remove `schedule:`. That is simpler, but leaves a single point of failure for 13 days.

## R4. Can past slots be recovered? (spec Story 2; the assumption "unverified")

Probed 2026-11-20, keyless, one call each:

| Source | Request | Result |
|---|---|---|
| LTA Taxi Availability v1 | `?date_time=2026-11-19T12:00:00` | HTTP 200, 79 KB, `timestamp 2026-11-19T11:59:45+08:00`, `taxi_count 3452` |
| NEA rainfall v2 | `?date=2026-11-19T12:00:00` | HTTP 200, 1 reading, `timestamp 2026-11-19T12:00:00+08:00`, no pagination token |

- **Finding**: Both sources return the value at or just before a past time. Both read a time with no offset as **SGT**. The rainfall response has the same shape as the live one, so `parseRain` (which reads `readings[0]`) works on it unchanged.
- **Decision**: The backfill (FR-008) recovers **both** taxis and rain. It sends each slot's time to both sources as SGT local time with no offset.
- **Volume**: from 2026-11-18 14:00Z to about 2026-11-20 12:00Z is roughly 185 slots. At 2 calls per slot that is about 370 calls. Paced at one slot every 6 s, the run takes about 20 minutes. The backfill can run again at the study end to fill any gaps left by outages.

## R5. One row per slot (FR-004)

- **Decision**: A slot is the run time rounded down to the quarter hour in UTC (for example `2026-11-20T09:00:00Z`). Before calling out, the sampler reads the CSV, which stays under 200 KB for the whole study. If any `run_at_utc` falls in the current slot, it logs `slot already sampled` and exits 0.
- **Rationale**: Each check is a small, testable pure function. It also saves the upstream calls. Rounding to a slot rather than matching exact times also handles cron-job.org starting runs a few seconds late.

## R6. Where backfilled rows go (FR-003, FR-008)

- **Decision**: Backfilled rows go in a separate file, `taxi-rain-backfill.csv`, on the same data branch, with the **same header**. Each row's `run_at_utc` is the slot start. Being in the backfill file is what marks a row as backfilled, and live `taxi-rain.csv` keeps its columns exactly as they are.
- **Rationale**: Adding a column to the live file would break its existing header row. A separate file also avoids push conflicts with the live sampler, and the analysis joins the two files on the slot.

## R7. Health signal (Story 3, FR-009)

- **Decision**: Two layers:
  - **Trigger failures**: cron-job.org's built-in email on failure (any non-2xx response, such as an expired token or a GitHub outage), plus GitHub's default email for failed workflow runs.
  - **Coverage**: a small script prints the time of the last sample, the count over the last 24 hours, the largest gap and slot coverage. It reads the data-branch CSVs and runs locally with one command ([quickstart.md](quickstart.md)).
- **Alternative**: a coverage summary in the workflow's job output. It isn't visible unless the owner opens Actions, so the email plus the local command is enough.
