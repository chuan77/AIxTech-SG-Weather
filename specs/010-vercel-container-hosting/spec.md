# Feature Specification: Host Lepak Weather publicly with lasting saved locations and checked deploys

**Feature Branch**: `010-vercel-container-hosting` (not yet created; the current branch is `008-uv-hourly-trend`)

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: handoff from `.specify/assessments/vercel-container-hosting/decision.md` (verdict: go). "Weather Starter, released as 'Lepak Weather', runs only locally. The owner needs a free, real hosting environment, with automated deploys that only promote changes passing all required checks, and saved locations that survive idle periods and redeploys. Option A: run the existing single-process app as one container on the hosting platform, keep saved locations in a hosted database in Singapore, and promote a merge to the main branch only after lint, type-check, tests and build pass."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Lepak Weather from a public link (Priority: P1)

A visitor (the owner or one of a few people they share the link with) opens the app's public web address on a laptop or phone. The app loads over HTTPS and works the same way it does locally: saved locations, their weather snapshots, refresh, "Use my location", town search and the lightning layer.

**Why this priority**: Nothing else matters until the app is reachable outside the owner's laptop. This is also the owner's first real deployment.

**Independent Test**: Deploy once by hand, open the public address on a laptop and on a phone, and use each main feature. This delivers a usable hosted app even before automation or lasting storage exist.

**Acceptance Scenarios**:

1. **Given** the app has been deployed, **When** a visitor opens the public address on a phone, **Then** the dashboard loads over HTTPS and shows the saved locations.
2. **Given** the app is open from the public address, **When** the visitor adds a location and refreshes it, **Then** a weather snapshot appears for it, just as it would locally.
3. **Given** the app has had no visitors for a while, **When** a visitor opens it, **Then** it loads (possibly after a short start-up delay) without an error page.

---

### User Story 2 - Saved locations are still there later (Priority: P1)

A visitor saves a location today, and when they (or another visitor) come back an hour or a day later, after the app has gone idle or been redeployed, the location and its last snapshot are still there.

**Why this priority**: Without this, the hosted app forgets its data whenever it goes idle, which with fewer than 5 visitors happens most of the time. The owner chose a lasting store specifically to avoid this.

**Independent Test**: Save a location, leave the app idle for at least an hour, redeploy, then reopen. The location and its snapshot are unchanged.

**Acceptance Scenarios**:

1. **Given** a visitor saved a location, **When** the app has been idle for at least 1 hour and is opened again, **Then** the location and its last snapshot are shown.
2. **Given** a visitor saved a location, **When** a new version of the app is deployed, **Then** the location is still there afterwards.
3. **Given** the hosted app starts for the first time against the prepared data store, **When** it opens the store, **Then** the 10 seeded saved locations appear, and no existing data is lost or duplicated.
4. **Given** the owner runs the app on their laptop with no hosting settings, **When** they save a location, **Then** it is stored only on their laptop and never reaches the hosted data.

---

### User Story 3 - Only checked changes go live (Priority: P2)

When the owner merges a change into the main branch, the project's full quality gate (lint, type-check, tests, build) runs automatically. If it passes, the new version goes live at the public address with no manual step. If any check fails, the live app is left exactly as it was and the owner can see which check failed.

**Why this priority**: This is the CI/CD practice the owner set out to learn, and it protects the live app from broken changes. It depends on Story 1 existing first.

**Independent Test**: Merge a harmless visible change and confirm it appears live with no manual action. Then push a change that fails a test and confirm the live app is unchanged and the failure is reported.

**Acceptance Scenarios**:

1. **Given** a change that passes every check, **When** it is merged into the main branch, **Then** it is live at the public address without any manual action.
2. **Given** a change that fails any check, **When** it is pushed or merged, **Then** it is not deployed, the live app keeps running the previous version, and the failed check is visible to the owner.
3. **Given** a pull request into the main branch, **When** its checks have not passed, **Then** it cannot be merged.

---

### User Story 4 - Owner can repeat and explain the setup (Priority: P3)

The owner can read a short guide in the repo that explains the path from commit to live, which settings and secrets are needed and where they are kept, and how to deploy by hand or roll back if automation fails.

**Why this priority**: The goal is learning. A setup the owner can't explain or repeat misses that goal, but the app works without the guide.

**Independent Test**: Following only the guide, the owner can name every setting, find where each secret is stored, and do a manual deploy and a rollback.

**Acceptance Scenarios**:

1. **Given** the guide, **When** the owner sets up the hosting settings from scratch, **Then** every required setting is listed with where it is configured, and no secret value appears in the repo.
2. **Given** a bad version is live, **When** the owner follows the guide's rollback steps, **Then** the previous version is live again.

---

### Edge Cases

- **Data store unreachable or credentials wrong**: the app reports that saved locations are unavailable and logs the reason without exposing credentials. It does not silently fall back to a temporary store that would lose data.
- **Hosting settings only partly set** (address without credentials, or the reverse): this counts as a configuration error. The hosted app must not fall back to temporary local storage.
- **Data store already holds the tables and migration history** (seeded upload): start-up applies no changes and loses no data. If the existing history is incompatible, start-up fails with a clear log instead of altering data.
- **Weather provider rate limit or outage**: same behaviour as locally. Snapshots show the existing "unavailable" or stale state, and nothing else breaks.
- **Free-plan usage exceeded on the host or data store**: the app may become unavailable until the allowance resets. No charges are incurred.
- **Two quick merges in a row**: the later passing version ends up live. A failing later change never replaces a passing earlier one.
- **Cold start**: the first request after an idle period may be slower but must succeed.
- **Shared list**: any visitor with the link can see and change the same saved locations. This is accepted until per-visitor storage ships (out of scope).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST be reachable at a public HTTPS address generated by the hosting platform, on laptop and mobile browsers.
- **FR-002**: The hosted app MUST run as the existing single deployable unit: frontend and backend together, served from one address (constitution Principle II).
- **FR-003**: The hosted app MUST run in Singapore, in the same region as its data store.
- **FR-004**: The hosted app MUST keep saved locations and their weather snapshots in a lasting data store that survives idle shutdowns, restarts and redeploys.
- **FR-005**: When no hosting data-store settings are provided, the app MUST keep using the local database file, so local development and tests behave as they do today (constitution Principle IV).
- **FR-006**: If hosting data-store settings are incomplete or invalid, the app MUST fail with a clear, credential-free log message instead of falling back to temporary storage.
- **FR-007**: On start-up against a data store that already contains the schema and migration history, the app MUST apply only migrations that are missing and MUST NOT delete, recreate or duplicate existing data.
- **FR-008**: The 10 locations seeded into the hosted data store MUST be visible in the hosted app after the first deploy.
- **FR-009**: Every push and pull request to the main branch MUST run the full quality gate: lint, type-check, tests and build, the same gate the owner runs locally.
- **FR-010**: A new version MUST go live at the public address only after the quality gate passes on the main branch, with no manual step.
- **FR-011**: A failing quality gate MUST leave the live version unchanged and MUST show the owner which check failed.
- **FR-012**: The main branch MUST require the quality gate to pass before a pull request can be merged.
- **FR-013**: No secret (data-store credentials, weather API key, deploy token) may be committed to the repository. The repo MUST document every required setting by name only, with empty example values.
- **FR-014**: The hosted app MUST use the owner's weather API key and keep its call rate within the key's Development-tier limit.
- **FR-015**: The repository MUST include a short deployment guide covering commit-to-live flow, required settings and where each is stored, manual deploy, and rollback.
- **FR-016**: The hosted app MUST behave identically to the local production build for all existing features (no feature changes in this work).

### Key Entities *(include if feature involves data)*

- **Saved location**: an existing entity, unchanged. A named place with coordinates and its latest weather snapshot. Lives in the hosted data store when hosted and in the local file otherwise. One shared list for all visitors.
- **Migration history**: the record of which schema changes the data store has already received. The seeded hosted store already contains it.
- **Deployment**: one version of the app built from a specific commit on the main branch. It is live only if its quality gate passed. The previous deployment can be restored.
- **Hosting setting**: a named configuration value (data-store address, data-store credential, weather API key, deploy credential) stored in the hosting platform or CI secret store, never in the repo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The app loads at its public address on both a laptop and a phone, and every existing feature works there.
- **SC-002**: Monthly hosting and data-store cost is $0.
- **SC-003**: A saved location is still present after 1 hour idle and after a redeploy, in 100% of checks.
- **SC-004**: 100% of merges to the main branch that pass all checks go live with no manual step.
- **SC-005**: 0 versions that failed a check ever go live.
- **SC-006**: A warm page load (app already running) shows the dashboard in under 3 seconds on a phone. A cold start after an idle period succeeds; its duration is measured and recorded, with no target.
- **SC-007**: No weather-provider rate-limit errors occur during normal use by up to 5 visitors.
- **SC-008**: Using only the repo's guide, the owner can describe the path from commit to live and perform a manual deploy and a rollback.

## Assumptions

- **Platform choices** (made in the assessment and recorded in its decision.md):
  - The hosting platform is Vercel's Container preset on the free Hobby plan, project `lepak-weather`.
  - The data store is Turso Cloud (hosted SQLite, free plan), database `lepak-weather-prod` in `aws-ap-southeast-1`. It is already created and seeded with 10 locations.
  - CI is GitHub Actions on the public repo `chuan77/AIxTech-SG-Weather`.
- **What goes live**: production deploys whatever is on GitHub `main`. Features 008 and 009 were merged and pushed on 2026-11-16, before this feature's first deploy.
- **Safety**: automated tests and browser checks never use the hosted database, even if a developer's local settings point at it.
- **Deploy gating**: CI runs the gate and then deploys production with the platform's CLI. The platform's own automatic production deploys from Git are turned off, so the gate can't be bypassed.
- **Region**: the Hobby plan allows choosing a single region, and `sin1` (Singapore) can be chosen. This will be confirmed after the first deploy.
- **Usage**: fewer than 5 visitors, personal and non-commercial. Free-plan limits (Turso: 500M reads, 10M writes and 5 GB storage a month; Vercel Hobby: 4 Active CPU hours a month) are far above expected use.
- **Shared list**: one shared list of saved locations for all visitors is accepted until per-visitor storage ships. The URL is shared only with a few people.
- **Migration history**: the uploaded store's migration history is expected to be compatible. This will be proven once against a local copy. If it isn't, the owner accepts recreating the store empty, which loses the 10 sample locations.
- **In-memory state**: rate pacing and the lightning cache stay per running instance. That's acceptable at this traffic.
- **Out of scope**:
  - Signup, login and accounts.
  - Per-visitor saved locations.
  - Access gating.
  - The docs site, a custom domain, paid plans, multiple regions and scaling.
  - Preview deployments with their own data store.
  - Reducing cold-start delay.
  - Syncing the local database to the hosted store after the one-off seed.
