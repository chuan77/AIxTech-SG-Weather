<!--
Sync Impact Report (temporary; remove before commit)
- Version change: (unversioned template) → 1.0.0
- Modified principles: none renamed (all five principles newly defined from the template)
- Added sections: Core Principles I–V, Technical Constraints, Development Workflow, Governance
- Removed sections: none
- Follow-up TODOs: none
-->
# Weather Starter Constitution

## Core Principles

### I. Snapshot-Only Weather Data
The app MUST NOT call data.gov.sg while serving a page load. Weather data is fetched only when a
location is created or explicitly refreshed (`POST /api/locations/:id/refresh`), merged into one
`WeatherSnapshot`, and stored in SQLite. `GET /api/locations` MUST only read stored data. Map pins
and other views MUST derive from that stored data and make no weather calls of their own.
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
- No ESLint or Prettier is enforced; new code MUST match the style of the surrounding code.

## Development Workflow

- Before changing the backend, API or data flow, read `docs/architecture.md`; before touching
  colours, Tailwind classes or `index.css`, read `docs/theming.md`; before adding tests, read
  `docs/testing.md`.
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

**Version**: 1.0.0 | **Ratified**: 2026-11-11 | **Last Amended**: 2026-11-11
