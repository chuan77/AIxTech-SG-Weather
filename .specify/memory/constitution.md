<!--
Sync Impact Report (temporary; remove before commit)
- Version change: 1.1.0 → 1.2.0
- Modified principles: none (I–V unchanged)
- Added sections: VI. Testing & Quality Gate
- Removed sections: none
- Other edits: Technical Constraints bullet "No ESLint or Prettier is enforced" replaced, because it
  contradicts Principle VI (`npm run lint` is now a mandatory gate). Development Workflow
  "Before merge" bullet is unchanged and remains consistent.
- Follow-up TODOs: `.husky/pre-commit` is currently empty and must run `npm run lint` and
  `npm test`; CLAUDE.md and docs/testing.md still say no ESLint runs and need syncing; verify
  `backend/src/routes/lightning.test.ts` conforms to the locations.test.ts pattern.
-->
# Weather Starter Constitution

## Core Principles

### I. Snapshot-Only Weather Data
The app MUST NOT call data.gov.sg while serving a page load. Weather data is fetched only when a
location is created or explicitly refreshed (`POST /api/locations/:id/refresh`), merged into one
`WeatherSnapshot`, and stored in SQLite. `GET /api/locations` MUST only read stored data. Map pins
and other views MUST derive from that stored data and make no weather calls of their own.
Exception: island-wide data that is not tied to any saved location (currently the lightning map
layer) MAY be fetched through a dedicated endpoint (`POST /api/lightning/refresh`) only on an
explicit user action, never during a page load. It MUST NOT be stored in SQLite or in any
location's `WeatherSnapshot`, MUST be cached server-side for at least 2 minutes so repeated actions
do not call data.gov.sg again, and MUST degrade to an "unavailable" state without affecting the
rest of the app. Any further exception requires its own amendment.
Rationale: keeps the dashboard fast and independent of upstream availability and rate limits.

### II. One Process, Relative API
Express and the React/Vite frontend MUST run in a single Node process. The frontend MUST call only
relative `/api/*` paths, so no CORS or port configuration exists. Server state on the frontend
MUST live in the single store context (`frontend/src/state/store.tsx`) backed by
`frontend/src/api.ts`; no router or second state container is introduced without an amendment
of this principle.
Rationale: one deployable unit and one data path stay easy to reason about.

### III. Injectable Weather Provider
`createApp` MUST accept a `weatherClient` option, and all weather access MUST go through that
interface. Tests MUST inject a fake provider and MUST NOT reach the network.
Rationale: makes backend behaviour deterministic and testable offline.

### IV. Testing Within Real Limits
Backend routes and logic MUST have vitest tests using `createApp` with a fake `weatherClient`.
Frontend tests are limited to pure `.ts` modules (no DOM environment); logic worth testing in
a component MUST be extracted into such a module (as with `mapHelpers.ts`). Tests share SQLite,
so they MUST run in the existing forked, non-parallel configuration. A bug fix MUST include a
test that fails without the fix whenever the code is testable under these limits.
Rationale: matches the actual harness while keeping regressions visible.

### V. Theme-Driven UI
Colours MUST come from the theme system: use Tailwind `white` classes (mapped to `--ink`) rather
than literal colours, and mark every themeable panel with `rounded-card`. Literal white is allowed
only where it must not follow the theme (for example `text-[#fff]` on the map's dark buttons).
New themes MUST be added as a `[data-theme='…']` block in `index.css` plus a `THEMES` entry naming
its map basemap. The `apple` theme is the default and MUST stay visually unchanged.
Rationale: every theme must work for every component without per-component overrides.

### VI. Testing & Quality Gate
Every backend Express route MUST have Vitest and Supertest coverage that follows the patterns in
`backend/src/routes/locations.test.ts`: build the app with `createApp`, inject a fake provider,
use a temporary SQLite database, and exercise the route through Supertest. No code MAY be
committed unless `npm run lint` and `npm test` both pass, and this MUST be enforced by a Husky
pre-commit hook; the hook MUST NOT be bypassed (for example with `--no-verify`).
Rationale: untested routes and unlinted code are caught before they enter history, not after.

## Technical Constraints

- Stack: Node with npm workspaces (`frontend`, `backend`), React 18, Tailwind 3, Vite, Express,
  Drizzle over Node's built-in `node:sqlite`, and vitest.
- Schema changes MUST be made in `backend/src/schema.ts` and shipped as a generated Drizzle
  migration (`npm run db:generate`) in `backend/drizzle/`.
- The server runs from the repo root; the database path is relative to `process.cwd()` unless
  `DATABASE_PATH` is set.
- Optional keys (for example `VITE_CARTO_API_KEY`) MUST degrade gracefully when absent, and
  secrets MUST NOT be committed.
- `RealtimeWeatherReadingsacrossSingapore/` sample dumps MUST NOT be committed.
- ESLint (`npm run lint`) is enforced by the pre-commit gate in Principle VI; Prettier is not
  enforced, so new code MUST match the style of the surrounding code.

## Development Workflow

- Before changing the backend, API or data flow, read `docs/architecture.md`; before touching
  colours, Tailwind classes or `index.css`, read `docs/theming.md`; before adding tests, read
  `docs/testing.md`.
- Before commit, `npm run lint` and `npm test` MUST pass (Principle VI).
- Before merge, `npm test` MUST pass and `npm run build -w frontend` MUST type-check and build.
- Changes to architecture, theming or testing behaviour MUST update the matching file in `docs/`
  in the same change.
- Commits SHOULD be small, use conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`), and
  describe why the change was made.
- Restart `npm run dev` after changing `.env`, `.env.local` or `frontend/.env.local`.

## Governance

This constitution supersedes other practices and conventions in the repository. Amendments MUST
be made by editing this file in a commit that states the reason, and MUST update any affected
`docs/` file or Spec Kit artifact in the same change. Versioning follows semantic versioning:
MAJOR for removing or redefining a principle in a backward-incompatible way, MINOR for adding a
principle or section or materially expanding guidance, PATCH for clarifications and wording.
Every plan and review MUST check compliance with the principles; any deviation MUST be justified
in writing in the plan or pull request. `CLAUDE.md` and `docs/` provide runtime development
guidance and MUST NOT contradict this document.

**Version**: 1.2.0 | **Ratified**: 2026-11-11 | **Last Amended**: 2026-11-13
