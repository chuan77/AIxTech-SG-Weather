# Idea Research: Host the weather app on Vercel using the Container preset

- **Slug**: vercel-container-hosting
- **Created**: 2026-11-16
- **Evidence confidence (overall)**: medium. Vercel's behaviour is well cited from its own pages, which were updated in the last month. Demand and usage data is thin, and some limits (memory, cold start, region) were not on the pages read.

The idea: deploy the existing single-process app (Express + built React frontend + SQLite) to Vercel by giving it a Dockerfile and choosing the **Container** application preset. This is in place of the **Services** split that Vercel proposes on import (backend `/api`, frontend, `docs`, and a root `app`).

## Users & Demand

- The owner wants a public URL for the app and has started a Vercel import of `chuan77/AIxTech-SG-Weather` on the Hobby team "SNAIC-Nexus". [source: user screenshot in this session] (confidence: high)
- The app is planned as a public replacement for a mobile weather app, used on laptop and mobile, so it needs public hosting, not just localhost. [source: project memory `public-mobile-release`, 2026-11-16] (confidence: medium; the expected number of users is unknown)
- There is no other user signal (tickets, requests, usage data) about how or where the app is hosted. Public users care that the app works, not which platform runs it. [ASSUMPTION] (confidence: medium)

## Prior Art

- **Internal: one-process design.** Constitution Principle II says Express and the frontend MUST run in one Node process and the frontend calls only relative `/api/*` paths, "one deployable unit". A single container fits this. Vercel's suggested Services split (separate backend and frontend) would need an amendment. [source: `.specify/memory/constitution.md` §II] (confidence: high)
- **Internal: no deployment exists yet.** The repo has no Dockerfile, `vercel.json`, Procfile or any other host config. Production runs through `npm run build` and then `npm start`, which starts `node backend/dist/server.js` with `NODE_ENV=production`. [source: repo root listing; `package.json`; `scripts/start.mjs`] (confidence: high)
- **Internal: saved locations are stored durably on purpose.** Spec `001-persist-saved-locations` made SQLite the store for saved locations and their snapshots. The DB uses `node:sqlite` `DatabaseSync` with WAL mode, at `DATABASE_PATH` or `backend/weather.db`. [source: `specs/001-persist-saved-locations/`; `backend/src/db.ts:1,53-62`] (confidence: high)
- **Internal: the server binds to loopback.** It runs `app.listen(port, '127.0.0.1')` with `PORT` defaulting to 3000. [source: `backend/src/server.ts:111-116`] (confidence: high)
- **External: Vercel's Container preset.** Vercel picks the Container preset when it finds a root `Dockerfile`/`Containerfile` and no other framework. It builds the image, pushes it to Vercel Container Registry and routes requests to it. You can force the preset with `"framework": "container"` in `vercel.json`, `vercel project update --framework container`, or a `Dockerfile.vercel`. [source: vercel.com changelog 2026-10-27; KB "Does Vercel support Docker deployments", updated 2026-10-29] (confidence: high)
- **External: Vercel's Node example.** The Fastify guide uses a two-stage `node:24-alpine` Dockerfile with `npm ci --omit=dev`, `NODE_ENV=production`, `PORT=80` and `USER node`, plus a SIGTERM handler. [source: KB "Deploy a Node.js Fastify app on Vercel with Docker", updated 2026-10-29] (confidence: high)

## Market & Context

- **Vercel's own comparison with Render.** Choose Render "for attached disks or private TCP" and Vercel "for HTTP services with traffic-based autoscaling". Render runs always-on instances with no scale to zero on paid plans, and persistent disks. A disk-backed Render service cannot scale horizontally, and attaching a disk turns off zero-downtime deploys. [source: KB "Running Docker on Vercel vs Render", updated 2026-10-29] (confidence: high)
- **Other hosts.** Railway (volumes) and Fly.io (volumes) also run a long-lived Node container with a persistent disk, so the current SQLite file would work unchanged. [ASSUMPTION, not fetched] (confidence: medium)
- **Cost of doing nothing.** Without hosting, public users can't reach the app at all, which blocks the planned public release. [source: memory `public-mobile-release`; inference] (confidence: medium)

## Data & Constraints

- **Beta.** "The Container runtime is in beta on all plans." No GA date is given. [source: KB "Does Vercel support Docker deployments"] (confidence: high)
- **Runs as a function, not a server.** Container images run "as Vercel Functions". Production instances scale down after 5 minutes without traffic (30 s on preview). Shutdown is SIGTERM with a 30 s grace period. One instance can serve several requests at once. [source: KB "Does Vercel support Docker deployments"; KB "Docker on Vercel vs Render"] (confidence: high)
- **No persistent storage.** "Instance-local data is temporary; use external services for durable state." The Node guide says "the file system is not persistent". None of the pages mention volumes or disks for container functions. Suggested stores are Vercel Blob, Marketplace Postgres, Marketplace Redis and Global Config. [source: KB "Docker on Vercel vs Render"; KB Node/Fastify guide] (confidence: high)
  - Impact here: the SQLite file at `DATABASE_PATH` would be lost on every scale-down or redeploy, and each instance would have its own copy, so saved locations and snapshots would vanish or differ between requests. [source: combining the above with `backend/src/db.ts`] (confidence: high)
- **Port and bind address.** Traffic goes to port 80 by default and `PORT` overrides it. "The server must bind to 0.0.0.0, not localhost, and read PORT." `EXPOSE` does not configure routing. The current `127.0.0.1` bind would not receive traffic. [source: KB Node/Fastify guide; `backend/src/server.ts:113`] (confidence: high)
- **Background work.** Timers and detached promises may break, because instances can pause or stop. [source: KB Node/Fastify guide] (confidence: high)
- **In-memory state is per instance.**
  - `ProviderRequester` paces data.gov.sg calls through a queue in process memory, so the per-key rate limit (12 requests per 10 s with a key) is only enforced inside one instance. Two or more concurrent instances could together go over it and get HTTP 429. [source: `backend/src/providerHttp.ts:6-14,44-56`; Vercel concurrency/autoscaling above] (confidence: medium; depends on how many instances Vercel actually runs at low traffic)
  - Principle I requires the lightning layer to be "cached server-side for at least 2 minutes". An in-memory cache is lost when an instance scales to zero and isn't shared between instances, so calls to data.gov.sg could go up. [source: constitution §I; `backend/src/routes/lightning.ts`] (confidence: medium; where the cache lives in `lightning.ts` was not read in full)
- **Billing.** Fluid compute bills Active CPU (paused during I/O waits), provisioned memory and invocations. [source: KB "Docker on Vercel vs Render"; changelog 2026-10-27] (confidence: high)
- **Hobby plan.** Vercel's Hobby plan is for personal, non-commercial use. [ASSUMPTION: Vercel fair-use policy, not fetched] (confidence: medium) Whether a public app replacing a mobile app counts as commercial is unknown.
- **Unsupported.** Custom container functions do not support Secure Compute or Static IPs. [source: KB "Docker on Vercel vs Render"] (confidence: high) That matters only if data.gov.sg ever requires IP allow-listing. [ASSUMPTION]
- **Container limits (added 2026-11-16 after a second fetch).** "The same limits and Active CPU pricing model of Vercel Functions apply to custom container images." [source: docs/functions/runtimes/container, updated 2026-07-07] (confidence: high) On Hobby that means:
  - **Memory and CPU:** 2 GB and 1 vCPU, which is both the default and the maximum. [source: docs/functions/limitations, updated 2026-08-24]
  - **Maximum duration:** 300 s per request. [same source]
  - **Included each month:** 4 hours of Active CPU, 360 GB-hours of provisioned memory, and the first 1,000,000 invocations. If you go over, "you will have to wait until 30 days have passed before you can use the feature again". In other words you're blocked, not billed. [source: docs/plans/hobby, updated 2026-11-12] For fewer than 5 visitors this is far more than needed. [ASSUMPTION] (confidence: medium)
  - **Image size:** Vercel Container Registry allows 2 GB per compressed layer and 15 GB per image, and layers must be gzip or zstd. The 250 MB function bundle limit isn't stated to apply to container images. [source: docs/container-registry/limits-and-pricing, updated 2026-09-22]
  - **Registry storage:** priced at "$0.10 per GB". The page doesn't say whether Hobby includes any free storage. [same source] [UNVERIFIED: whether Hobby is ever charged for it] For an image of roughly 200–300 MB, this is cents a month at most. [ASSUMPTION]
  - **Region:** new projects default to `iad1` (Washington, D.C.). Hobby gets a "Single region", which you can change in the dashboard or with `"regions"` in `vercel.json`. `sin1` (Singapore) is one of the 19 compute regions. [source: docs/functions/configuring-functions/region, updated 2026-08-11; docs/regions, updated 2026-08-11] No page says outright that a Hobby team can choose `sin1`. [UNVERIFIED, likely yes] (confidence: medium)
  - **Instances:** functions autoscale "up to 30,000 (Hobby and Pro)" concurrent requests. None of the pages read mentions a setting to cap the number of instances. [source: docs/functions/limitations] (confidence: medium)
  - **Cold start:** no figures given on any page read. [UNVERIFIED]
  - **Persistent storage or volumes:** not mentioned on the container runtime page. [source: docs/functions/runtimes/container]
  - **Hobby non-commercial clause:** not stated on any of the five pages read. [UNVERIFIED] The owner confirms the project is personal anyway.
- **Node version.** `node:sqlite` needs a recent Node; local development uses v26.13.1. A container image can pin a matching Node version, so this is not a blocker. [source: `node -v` in session; Vercel examples use `node:24`/`node:26-alpine`] (confidence: medium)

## Evidence Against the Idea

- **Storage is the strongest objection.** Vercel says container state is temporary and offers no persistent disk. Today saved locations and snapshots live in a local SQLite file. Hosting on Vercel without moving storage to an external database (for example Turso/libSQL or Marketplace Postgres) would silently lose user data. That move changes `backend/src/db.ts` and the Drizzle setup, and possibly the test harness, which is "Tests share SQLite" under Principle IV. [sources above] (confidence: high)
- **Vercel's own guide points elsewhere.** For workloads that need attached disks it recommends Render, not Vercel. [source: KB "Docker on Vercel vs Render"] (confidence: high)
- **Beta runtime.** A beta runtime is a risk for a public release meant to replace an existing app. [source: KB "Does Vercel support Docker deployments"] (confidence: medium)
- **Scaling vs rate limits.** Autoscaling and scale to zero work against the app's process-local rate pacing and lightning cache, which were designed for one long-lived process (Principles I and II). [sources above] (confidence: medium)
- **Cold starts.** After 5 idle minutes, the next mobile user waits for a container cold start. How long that takes is not stated. [source: KB; UNVERIFIED duration] (confidence: medium)
- **Hobby plan terms** may not allow a public commercial-style release. [ASSUMPTION] (confidence: low)

## Gaps & Open Questions

- ~~Is Vercel itself required?~~ Answered by the owner on 2026-11-16: the real requirement is **free hosting**. Vercel isn't mandatory, and the owner prefers containerising the app because it's simpler. [source: owner, this session]
- [UNVERIFIED: Free tiers elsewhere. As far as I know, Render's free web services have no persistent disk and sleep when idle, and Fly.io and Railway no longer offer an ongoing free tier. Neither claim was fetched.]
- [NEEDS CLARIFICATION: Should saved locations be shared by everyone (one global list, as today) or belong to each user? Public use may change the storage design no matter which host is chosen.]
- [NEEDS CLARIFICATION: Expected number of users and request volume. This decides instance count and whether rate pacing has to be shared between instances.]
- [NEEDS CLARIFICATION: Is the release commercial? This affects whether the Hobby plan is allowed.]
- Container limits: mostly answered on 2026-11-16 (see "Data & Constraints"). Still not confirmed: cold-start time, whether Hobby can choose `sin1`, and whether registry storage is free on Hobby.
- [UNVERIFIED: Whether Vercel can cap the number of instances. None of the pages read mentions a setting for it.]
- [UNVERIFIED: Whether an external SQLite-compatible store (Turso/libSQL) works with Drizzle's current `sqlite-proxy`/migrate approach in `db.ts` without a larger rewrite.]
- Should the `docs` (Astro) site be deployed as well? Out of scope for this idea unless the owner says otherwise.

## Sources

- Repo files: `backend/src/server.ts`, `backend/src/db.ts`, `backend/src/providerHttp.ts`, `backend/src/routes/lightning.ts`, `package.json`, `scripts/start.mjs`, `.specify/memory/constitution.md`, `specs/001-persist-saved-locations/` (host: local, policy: n/a)
- Project memory `public-mobile-release` (host: local, policy: n/a)
- User-supplied screenshot of the Vercel "New Project" import screen (host: local, policy: n/a)
- https://vercel.com/changelog/deploy-a-container-from-a-plain-dockerfile (host: vercel.com, policy: confirmed-by-user; published 2026-10-27)
- https://vercel.com/kb/guide/does-vercel-support-docker-deployments (host: vercel.com, policy: confirmed-by-user; updated 2026-10-29)
- https://vercel.com/kb/guide/docker-on-vercel-vs-render (host: vercel.com, policy: confirmed-by-user; updated 2026-10-29)
- https://vercel.com/kb/guide/deploy-nodejs-on-vercel-with-docker (host: vercel.com, policy: confirmed-by-user; updated 2026-10-29)
- https://vercel.com/docs/functions/limitations (host: vercel.com, policy: confirmed-by-user; updated 2026-08-24)
- https://vercel.com/docs/limits (host: vercel.com, policy: confirmed-by-user; updated 2026-09-16)
- https://vercel.com/docs/functions/configuring-functions/region (host: vercel.com, policy: confirmed-by-user; updated 2026-08-11)
- https://vercel.com/docs/regions (host: vercel.com, policy: confirmed-by-user; updated 2026-08-11)
- https://vercel.com/docs/plans/hobby (host: vercel.com, policy: confirmed-by-user; updated 2026-11-12)
- https://vercel.com/docs/container-registry/limits-and-pricing (host: vercel.com, policy: confirmed-by-user; updated 2026-09-22)
- https://vercel.com/docs/functions/runtimes/container (host: vercel.com, policy: confirmed-by-user; updated 2026-07-07)
- Fetch note: the pages were fetched through the harness's WebFetch tool, which does not show the connected peer address. The owner approved vercel.com only. No other host was fetched, and no redirects or linked pages were followed.
