# Quickstart: Taxi-rain study samples on time

## 0. Go live now (no code needed)

The current workflow on `main` already accepts a manual start, so P1 can start before anything merges.

1. **Create the token**: GitHub → Settings → Developer settings → Fine-grained tokens → Generate.
   - Owner: `chuan77`. Repository access: **Only select repositories** → `AIxTech-SG-Weather`.
   - Permissions: Repository → **Actions: Read and write**. Leave everything else off.
   - Expiration: **2026-12-04**.
2. **Create the cron-job.org job**:
   - URL: `https://api.github.com/repos/chuan77/AIxTech-SG-Weather/actions/workflows/taxi-rain-study.yml/dispatches`.
   - Schedule: every 15 minutes, timezone Asia/Singapore.
   - Advanced: method **POST**, the headers and body from [contracts/dispatch-request.md](contracts/dispatch-request.md).
   - Notifications: **on failure**.
3. Press **Test run** in cron-job.org. Expect `204`.
4. Check the run: `gh run list --workflow taxi-rain-study.yml --limit 3` shows a `workflow_dispatch` run that succeeded.

Until the slot check merges, a GitHub scheduled run can land in the same slot as a cron-job.org run, which happens a few times a day. Those duplicates are harmless, and the analysis keeps the first row per slot.

## 1. Check health (Story 3)

```bash
git fetch -q origin research/taxi-rain-data
git show origin/research/taxi-rain-data:taxi-rain.csv | node scripts/research/taxi-rain-health.mjs -
```

Expected after 24 hours live: `samples_last_24h ≥ 85` and `largest_gap_last_24h_min ≤ 30` (SC-001, SC-002). The command exits 1 when the last live sample is over 30 minutes old. To include backfilled slots in the coverage figure, pass the backfill CSV as a second argument.

## 2. Backfill the missed slots (Story 2)

Run this once, after the slot check merges. Run it again at the study end to fill any outage gaps.

```bash
git worktree add /tmp/taxi-data origin/research/taxi-rain-data -B research/taxi-rain-data
node scripts/research/taxi-rain-backfill.mjs /tmp/taxi-data/taxi-rain.csv /tmp/taxi-data/taxi-rain-backfill.csv
cd /tmp/taxi-data && git add taxi-rain-backfill.csv && git commit -m "data: backfill missed slots" && git push origin HEAD:research/taxi-rain-data
```

Expected:
- About 180 rows from 2026-11-18 13:45Z up to the go-live time.
- A second run adds 0 rows (US2 scenario 3).
- `taxi-rain-health.mjs` given both files shows coverage near 100% for the backfilled window.

## 3. Verify the code changes

```bash
npx vitest run scripts/research
npm run verify
```

## 4. End of study (SC-006, by 2026-12-04)

1. In cron-job.org: disable or delete the job.
2. In GitHub fine-grained tokens: revoke the token.
3. Delete `.github/workflows/taxi-rain-study.yml` in a `chore:` PR, once the findings note is written.
