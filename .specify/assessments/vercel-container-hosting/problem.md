# Problem Definition: A free, real hosting environment for Weather Starter

- **Slug**: vercel-container-hosting
- **Created**: 2026-11-16
- **Inputs used**: research.md and owner answers on 2026-11-16 (no intake.md; intake was skipped)

## Problem Statement

Weather Starter runs only on the owner's laptop, so the owner can't practise deploying to a real hosting environment or delivering changes there automatically (CI/CD), and nobody else can open the app. Any hosting must cost nothing. Once the app is reachable from the internet, its current single shared list of saved locations could be lost when the host restarts. It could also be seen and changed by any visitor.

## Affected Users & Stakeholders

- **Users**:
  - **The owner, as learner and operator.** The main user. They want hands-on experience shipping to real hosting and running CI/CD. Today there is no deployment at all: no host config and no `.github/workflows`. [source: owner, 2026-11-16; research.md "Prior Art"; repo has no `.github/workflows`]
  - **Occasional visitors.** A few people, with no advertising planned, who open the app on laptop or mobile. They expect their saved locations to stay where they left them and to belong to them. [source: owner, 2026-11-16; memory `public-mobile-release`] Expected numbers: fewer than 5. [source: owner, 2026-11-16]
- **Stakeholders**:
  - **The owner** decides and pays, with a budget of $0, and is the only stakeholder.
  - **data.gov.sg (NEA).** Its per-key rate limit is shared by every visitor and every running copy of the app. [source: research.md "Data & Constraints"]
  - **Hosting provider terms.** Free tiers are personal and non-commercial; the owner confirms the project is personal and non-commercial for now. [source: owner, 2026-11-16; Vercel Hobby terms are an ASSUMPTION in research.md]

## Goals

- **G1:** The app is reachable at a public HTTPS URL on laptop and mobile, at no cost.
- **G2:** A change merged to the main branch reaches the hosted app without manual steps, so the owner learns and practises CI/CD.
- **G3:** A broken change is caught before it reaches the hosted app. The project's existing quality gate (lint, type-check, tests, build) applies to deployments too.
- **G4:** Saved locations and their stored weather snapshots survive idle periods, restarts and redeploys of the hosted app.
- **G5:** Visitors can't see or change each other's saved locations, or the hosted app isn't opened to visitors until that's true.
- **G6:** Hosting doesn't push the app over the data.gov.sg rate limit or weaken the project's constitution rules: snapshot-only weather calls (Principle I) and one deployable unit (Principle II).

## Non-Goals

- Building user signup, login or account management as part of this work. The owner wants saved locations to be per user eventually, but accounts are a separate piece of work. [source: owner, 2026-11-16] G5 is about making sure the lack of accounts isn't exposed publicly.
- Commercial use, paid plans, uptime promises or scaling for heavy traffic.
- Hosting the Astro `docs` site.
- A custom domain.
- Removing cold-start delays after idle periods. Some wait is acceptable at this scale. [ASSUMPTION: owner hasn't said]
- Migrating or keeping the data in the owner's local `backend/weather.db`.

## Success Metrics

- **Hosting cost** stays at $0 a month. (baseline: $0, nothing hosted)
- **Automatic delivery**: a merge to main that passes all required checks shows up on the public URL with no manual action. There's no time target, per the owner on 2026-11-16. (baseline: no deployments)
- **Failed changes deployed**: changes that fail the quality gate and still reach the hosted app stay at 0. (baseline: n/a)
- **Data survives**: a saved location still exists after (a) at least 1 hour idle and (b) a redeploy. (baseline: n/a; it is known to fail on a host with temporary storage, per research.md)
- **Visitors kept apart**: a second visitor sees none of the first visitor's saved locations and can't change them. (baseline: today every client shares one global list)
- **Rate-limit errors**: data.gov.sg HTTP 429 errors stay at 0 during normal use by a few visitors. (baseline: unknown for hosted use)
- **Owner learning outcome** (qualitative): the owner can explain and repeat the pipeline from commit to live.

## Cost of Inaction

The app stays local-only. The owner gets no practice with real hosting or CI/CD, which was the stated reason for this work. Nobody else can use the app, so the planned public replacement for a mobile weather app (memory `public-mobile-release`) can't go ahead. There's no money at stake, and nothing breaks for current use, which is just the owner on localhost.

## Owner Answers (2026-11-16)

- **Visitors:** fewer than 5. This is far inside the Hobby allowance and the data.gov.sg Development-tier limit of 12 requests per 10 s with a key. [source: owner; research.md]
- **Merge to live:** no time target. A merge goes live only if it passes all required checks (the quality gate). This replaces the time metric with the "failed changes deployed = 0" metric.
- **API key:** use the owner's key, as long as usage stays within the Development tier limit.
- **Beta runtime:** acceptable. Vercel is already connected to the owner's GitHub account.
- **Hosting choice:** Vercel, with SQLite (or DuckDB) inside the container and no external database host.
  - **This conflicts with G4.** Vercel says container files are temporary and offers no volumes (research.md). A database file inside the container is wiped when the container scales down after 5 idle minutes, and on every redeploy. DuckDB stores data on local disk in the same way, so it changes nothing here. With fewer than 5 visitors, idle periods will be common, so data loss would be routine, not rare.
- **Container limits:** researched. Hobby gives 2 GB and 1 vCPU per container, 300 s per request, 4 hours of Active CPU a month, and over-use blocks the feature instead of charging. Singapore (`sin1`) is a compute region. See research.md "Data & Constraints".

- **Storage options (owner, 2026-11-16):**
  - Agrees that saved data **may reset now and then** while the goal is practising deployment.
  - Agrees with keeping saved locations **in each visitor's own browser**.
  - Asked whether Vercel offers a free hosted database. **Yes, through the Vercel Marketplace**, which is available on all plans. Its storage providers include Neon (Postgres, "generous Free Plan"), Prisma Postgres ("A free database for your app"), Supabase, Upstash (Redis) and Turso Cloud (SQLite-compatible). You add them with `vercel install <provider>`, and free plans can be picked with `--plan free`. [source: vercel.com/docs/marketplace-storage, vercel.com/marketplace/neon] [UNVERIFIED: free-tier limits for Turso, Upstash and Supabase] Turso is the closest match to the current SQLite and Drizzle setup. [ASSUMPTION]

- **Direction chosen (owner, 2026-11-16):** host on the **Vercel Container preset** and keep saved data in **Turso Cloud** (hosted SQLite, free plan). The owner has signed up to Turso (account `chuan77`, Free plan). The names are Vercel project **`lepak-weather`** and Turso database **`lepak-weather-prod`**. This meets G4. G5 (visitors kept apart) is still open, because one shared Turso database still holds one global list until accounts or per-visitor separation exist.

## Open Questions

- [NEEDS CLARIFICATION: The owner agreed to both "resets are fine" and "per-visitor browser storage". Are these phases (deploy first and accept resets, then move saved locations into the browser), or is browser storage needed from the first public deploy? The shaping step should settle this.]

- [NEEDS CLARIFICATION: How should G4 (data survives) and G5 (visitors kept apart) be met when the database lives only inside the container? Which is acceptable:
  - (a) the saved data resets now and then (drop or weaken G4);
  - (b) saved locations are kept somewhere that persists without an external database host, such as each visitor's own browser, which would also keep visitors apart without accounts;
  - (c) a free external database after all?
  This is the main question for the shaping step.]
- [NEEDS CLARIFICATION: Until accounts exist, is it acceptable to limit who can open the hosted app (e.g. owner-only)? This is only needed if (b) isn't chosen.]
- [UNVERIFIED: Container cold-start time; whether a Hobby team can choose `sin1`; whether Container Registry storage ($0.10 per GB) is ever charged on Hobby; whether the number of instances can be capped.]
