# Decision: Lepak Weather on Vercel Containers with Turso

- **Slug**: vercel-container-hosting
- **Decided**: 2026-11-16
- **Verdict**: go
- **Artifacts reviewed**: research.md, problem.md, concept.md (no intake.md; intake was skipped)

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | strong | The app is local-only, with no host config and no CI. The owner's stated purpose, learning to deploy and running CI/CD, can't be met without hosting (problem.md). |
| Evidence strength | adequate | Vercel's container behaviour, limits and Hobby allowances come from 11 recent vercel.com pages (research.md). Non-blocking gaps remain: cold-start time, whether Hobby can choose `sin1`, Turso free-tier limits, and whether deploys can wait for GitHub checks. |
| Value vs. inaction | strong | Doing nothing means no deployment practice and no way for anyone else to use the app. Option A costs $0 and is small (problem.md "Cost of Inaction"; concept.md). |
| Feasibility / appetite | strong | Option A is small. The owner has already set up the Vercel project and Turso database (`lepak-weather-prod`, seeded, in `aws-ap-southeast-1`). The database change is limited to `backend/src/db.ts`, which already uses an async Drizzle callback, and its single consumer, `routes/locations.ts` (concept.md). |
| Strategic fit | strong | One container keeps Principle II (one process). Principles I, III and IV are unchanged if tests keep using a local SQLite file. It serves the public mobile release in [memory `public-mobile-release`] as a first step. |
| Risk posture | adequate | The known risks are understood and either accepted or mitigated: a beta runtime (accepted by the owner), cold starts (a non-goal), rate pacing and lightning cache per instance (fine below 5 visitors), and the shared list (accepted short-term, with Option B planned and Option C as a fallback). Unmitigated: the shared list is open to anyone who gets the URL until Option B ships. |

## Verdict & Rationale

**Go.** The problem is real and specific to the owner's goal. The evidence for the chosen platform is cited and recent. The recommended Option A is small, costs nothing, and keeps the constitution intact. The remaining unknowns (region selection, gating deploys on checks, Turso limits, and Drizzle accepting the uploaded migrations table) can be settled during specification and planning, and each has a fallback. None is a reason to stop. The main accepted risk is G5: the shared list is protected only by not advertising the URL. The owner has accepted occasional resets and a personal, low-traffic scope, and Option B is lined up to close the gap properly.

## If needs-clarification

Not applicable.

## If go: Handoff to `/speckit-specify`

- **Problem**: Weather Starter, released as "Lepak Weather", runs only locally. The owner needs a free, real hosting environment, with automated deploys that only promote changes passing all required checks. Saved locations must survive idle periods and redeploys.
- **Chosen approach**: Option A, "Ship the container with Turso and checks-gated deploys".
  - Run the existing single-process app as one container on the Vercel Container preset, in project `lepak-weather`.
  - Persist saved locations in Turso (`lepak-weather-prod`) when the Turso settings are present. Otherwise use the local SQLite file, which local development and tests keep using.
  - Promote a merge to `main` only after lint, type-check, tests and build pass.
- **In scope**:
  - Container image and preset config.
  - Binding to `0.0.0.0` and reading `PORT`.
  - Choosing Turso or the local file from configuration.
  - Running migrations against Turso safely, given the seeded `__drizzle_migrations`.
  - A checks-gated pipeline from GitHub to Vercel.
  - Documenting the environment variables in `.env.example`, without any secrets.
  - Region aligned with Singapore where Hobby allows.
- **Out of scope**:
  - Signup and accounts.
  - Per-visitor browser storage (Option B, the next feature).
  - Access gating (Option C, the fallback).
  - The `docs` site, a custom domain, paid plans, multiple regions and scaling.
  - Sharing rate pacing or the lightning cache across instances.
  - Cold-start tuning.
  - Preview databases.
  - Ongoing sync from the local database to Turso.
- **Success metrics**:
  - Hosting cost stays at $0 a month.
  - A merge to `main` that passes all required checks goes live with no manual step.
  - Failed changes deployed stays at 0.
  - A saved location survives at least 1 hour idle and a redeploy.
  - No data.gov.sg 429s with fewer than 5 visitors.
  - The owner can explain and repeat the pipeline from commit to live (qualitative).
- **Owner answers (2026-11-16, after the verdict)**:
  - **Region:** Singapore only, because the app is meant only for Singapore users. Pin the Vercel function region to `sin1`; Turso is already in `aws-ap-southeast-1`. Check after the first deploy that Hobby accepted `sin1`.
  - **Turso free limits** (owner's dashboard): 500M reads, 10M writes, 3 GB syncs, 5 GB storage and 100 databases, all per month. The seeded database is 44 KB, with fewer than 5 visitors. That's ample headroom.
  - **Shared URL:** confirmed acceptable until Option B. The URL is the one Vercel generates.
  - **Gating deploys on checks:** the owner asked for a recommendation. The recommendation is that GitHub Actions runs the quality gate and only then deploys to production with the Vercel CLI, with Vercel's automatic Git deploys turned off for production. This works on any plan, the gate can't be skipped, and it's the better CI/CD learning exercise. Branch protection requiring the check before merge is a bonus; on GitHub Free it needs a public repo, and `chuan77/AIxTech-SG-Weather` is public (checked with `gh` on 2026-11-16), so it's available. Note: `gh`'s default repo for this folder resolves to `AISG-AIAP/weather_starter`, so pass `--repo chuan77/AIxTech-SG-Weather` when setting up CI.
  - **Migration history:** the owner asked for a recommendation. The recommendation is to keep the uploaded database, and during implementation run the app's migrator once against a local copy of the uploaded file (`file:` URL) to prove it applies nothing. If it fails, recreate `lepak-weather-prod` empty and let the app create the tables. That costs 10 sample locations, which is acceptable because the owner accepts resets.
- **Carried-forward open questions**:
  - Can a Hobby team set its region to `sin1`?
  - Can Vercel hold Container deploys until the GitHub checks pass, or should GitHub Actions deploy with the Vercel CLI?
  - Turso free-plan limits.
  - Will Drizzle's libSQL migrator accept the uploaded database's migration history?
  - Does the image fit Vercel's limits, and is registry storage free on Hobby?
  - Cold-start time (accepted, but worth measuring).
  - The owner should confirm that a shared, unadvertised URL is acceptable until Option B ships.
