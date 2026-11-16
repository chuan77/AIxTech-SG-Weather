# Concept: Lepak Weather on Vercel Containers with Turso

- **Slug**: vercel-container-hosting
- **Created**: 2026-11-16
- **Recommended option**: Option A, "Ship the container with Turso and checks-gated deploys". Option B follows as its own feature.

Context from problem.md: free hosting for practising deployment and CI/CD; fewer than 5 visitors; personal and non-commercial. The owner has chosen the Vercel Container preset (project `lepak-weather`) and Turso (`lepak-weather-prod`, in `aws-ap-southeast-1`, seeded with the 10 local saved locations). The owner has accepted occasional resets and per-visitor browser storage in principle. The open question is how G5 (visitors kept apart) is met.

## Options

### Option A: Ship the container with Turso and checks-gated deploys (smallest thing that works)

- **Sketch**:
  - The app looks and behaves exactly as it does locally, but at a public `lepak-weather` URL. It runs as one container, so the constitution's "one process" rule (Principle II) still holds.
  - Saved locations live in Turso. Locally, the app keeps using `backend/weather.db` unless Turso settings are provided.
  - A merge to `main` goes live only after the project's existing quality gate (lint, type-check, tests, build) passes in CI.
  - Saved locations stay one shared list. Only the owner and a few trusted visitors get the URL.
- **Appetite**: small (days).
- **Trade-offs**:
  - **Wins:** meets G1, G2, G3 and G4 and the $0 target, and fits the owner's main goal of learning to deploy. The database change is contained: [backend/src/db.ts](../../../backend/src/db.ts) already talks to Drizzle through an async callback, and only `routes/locations.ts` imports it.
  - **Sacrifices:** G5 is met only by not advertising the URL. Anyone with the link can see and change the shared list.
  - **Risks:**
    - The Container runtime is in beta.
    - Cold starts after 5 idle minutes.
    - Rate pacing and the lightning cache live in each instance's memory, which is acceptable with fewer than 5 visitors.
    - The Hobby region choice (`sin1`) is unconfirmed.
- **Rabbit holes**:
  - Swapping Node's built-in SQLite for Turso's client while keeping tests on a local shared SQLite file (Principle IV), and running migrations against Turso at startup.
  - Making Vercel wait for the GitHub checks before promoting a deploy, rather than deploying on every push. It's unconfirmed whether Hobby can do this natively; the fallback is to deploy from GitHub Actions with the Vercel CLI.
  - A Dockerfile for an npm-workspaces repo that should skip the `docs` workspace and keep the image small.

### Option B: Per-visitor saved locations in the browser (on top of A)

- **Sketch**:
  - Each visitor's saved locations, and the weather snapshots shown for them, are kept in that visitor's own browser.
  - Visitors never see each other's lists, with no signup needed. Clearing browser data clears that visitor's list.
  - The server keeps doing the weather fetches.
- **Appetite**: medium (one to two weeks), as a separate feature after A.
- **Trade-offs**:
  - **Wins:** fully meets G5 without accounts or extra cost, and makes the shared database matter less.
  - **Sacrifices:** a visitor's list doesn't follow them across devices.
  - **Constitution:** it changes where "the stored snapshot" lives (Principle I) and where server state sits on the frontend (Principle II store), so it likely needs a constitution amendment.
  - **Data:** the 10 seeded locations in Turso would no longer be what visitors see.
- **Rabbit holes**:
  - Rewriting the data flow the whole frontend relies on.
  - Keeping Principle I (no weather calls on page load) true when the snapshot lives in the browser.
  - Migrating existing data.
  - Testing within the "pure `.ts` modules only" limit, since there is no DOM test environment.

### Option C: Gate access to the hosted app (on top of A)

- **Sketch**:
  - Visitors must pass a simple access check before the app loads: Vercel's own deployment protection where Hobby allows it, or a shared password.
  - The shared list stays, but only people the owner lets in can touch it.
- **Appetite**: small.
- **Trade-offs**:
  - **Wins:** closes the open-URL gap in G5 cheaply.
  - **Sacrifices:** not really per user; it adds friction for the few visitors.
  - **Risk:** what Hobby supports for protecting production is unverified. A home-made password gate is a security surface that's easy to get wrong.
- **Rabbit holes**: drifting into a real auth system, which is a non-goal.

### Rejected: do nothing, or another free host

- Doing nothing leaves the owner with no deployment practice (problem.md, "Cost of Inaction").
- Free tiers elsewhere either don't keep data or need an external database anyway (research.md, unverified). Turso is already set up, so another host buys nothing.

## Recommendation

**Build Option A now, and treat Option B as the next feature.**

- **Why A:**
  - It reaches the owner's stated purpose fastest: real hosting plus a CI/CD pipeline where only changes that pass all required checks go live (G1–G3).
  - It keeps saved data through idle periods and redeploys via Turso (G4), at $0.
  - It touches the least code, and the constitution stays intact.
- **G5 for now:** with fewer than 5 visitors and an unadvertised URL, a shared list is an acceptable short-term risk. The owner already said occasional resets are fine.
- **Why B next instead of C:** B delivers the "kept per user" outcome the owner asked for, without building accounts. C is the fallback if B is delayed and the URL starts spreading.

## Out of Scope (for the recommended option)

- User signup, login or accounts.
- Per-visitor saved locations (Option B) and access gating (Option C). These are separate follow-ups.
- Hosting the Astro `docs` site, a custom domain, paid plans, multiple regions and high-traffic scaling.
- Sharing rate pacing or the lightning cache across instances.
- Reducing cold-start delay.
- Preview deployments with their own database; previews may be skipped or use no database.
- Keeping the local `backend/weather.db` in sync with Turso after the one-off seed.

## Assumptions to Validate

- A Hobby team can set its function region to `sin1`, close to Turso's `aws-ap-southeast-1`.
- Vercel deploys of the Container preset can be held until the GitHub checks pass, or GitHub Actions can deploy with the Vercel CLI on Hobby at no cost.
- The Turso free plan's limits comfortably cover fewer than 5 visitors. Its exact limits haven't been checked.
- The uploaded `lepak-weather-prod` database, including its `__drizzle_migrations` table, is accepted by Drizzle's libSQL migrator, so migrations aren't re-run.
- Turso's client can open a local `file:` database for tests and local development, preserving the shared, forked test setup (Principle IV).
- The image fits Vercel's limits, and registry storage on Hobby stays free or costs cents at most.
- Rate pacing per instance is enough at this traffic, with no data.gov.sg 429s.
- A shared, unadvertised URL is an acceptable stand-in for G5 until Option B ships. The owner should confirm this at the decide step.
