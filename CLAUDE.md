# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Weather Starter: a Singapore weather dashboard (Express + React/Vite in one Node process, SQLite via Drizzle) that stores a weather snapshot per saved location.

## Commands

Run from the repo root (npm workspaces: `frontend`, `backend`).

```bash
npm run dev                   # Express + Vite via Portless -> http://weather-starter.localhost:1355
npm test                      # vitest run (backend + frontend *.test.ts)
npx vitest run <file>         # single test file; add -t "name" for one test
npm run build -w frontend     # frontend type-check + build
npm run lint                  # eslint . (pre-commit runs this and npm test)
npm run typecheck             # tsc --noEmit for frontend and backend
npm run verify                # fail-fast gate: lint -> typecheck -> tests -> build
npm run reset                 # deletes backend/weather.db
npm run db:generate           # drizzle migration after editing backend/src/schema.ts
```

ESLint (`eslint.config.js`) is enforced; Prettier (`.prettierrc`) formats edited files but is not enforced, so match the surrounding style. Restart `npm run dev` after changing `.env`, `.env.local` or `frontend/.env.local`. Run from the repo root: the DB path is relative to `process.cwd()`.

Do not commit `RealtimeWeatherReadingsacrossSingapore/` (untracked sample API dumps).

## Read before working on

- [Architecture](docs/architecture.md): one-process server, snapshot pattern, storage, frontend store, map. Read before changing backend, API or data flow.
- [Theming](docs/theming.md): the `--ink` and `rounded-card` mechanics. Read before touching colours, Tailwind classes or `index.css`.
- [Testing](docs/testing.md): vitest setup and its limits. Read before adding tests.

## Verification

Two tiers:

1. **While editing:** the `PostToolUse` hook (`.claude/hooks/post-edit-lint.sh`) runs Prettier and `eslint --fix` on each `.ts`/`.tsx`/`.js` file you edit (Ruff for `.py`). If it exits 2, fix the errors it reports in that file before moving on. It checks one file only: no type-check, no tests, and it skips `specs/`, `.specify/` and Markdown. Don't run the full gate after every edit.
2. **Before a browser check or calling a task done:** run `npm run verify` once. It stops at the first failure, in this order: ESLint (and Ruff when Python exists), `tsc --noEmit`, vitest (and pytest), `npm run build`. A failing gate means the task is not done.

This sits on top of the constitution's gate and doesn't replace it. Pre-commit still runs only `npm run lint` and `npm test`, and must not be bypassed with `--no-verify`. Before merge, the build must pass, which `verify` covers.

## Browser Automation Routing
- Use `agent-browser` for UI navigation, clicking interactive `@eN` refs, form filling, screenshots, and E2E verification.
- Use `chromedevtools` only when inspecting deep DevTools performance traces, memory profiles, or raw CDP network internals.

## Browser checks

Scripted checks live in `scripts/e2e/` and share `scripts/e2e/lib.sh`. Run them after `npm run verify` (they serve the built `frontend/dist`). Every scoped UI check, scripted or ad hoc, must:

- **Watch for runtime errors from before the first navigation.** Start the session on `about:blank`, clear `agent-browser errors` and `agent-browser console`, then navigate. After each open, reload or view/sheet switch, call `assert_clean "<context>"`: any uncaught page error, unhandled rejection or `console.error` fails the run at once. Ad hoc: check `agent-browser errors --json` and `console --json` (`type: "error"`) after each step.
- **Clean up on success and failure.** Never start a server or browser without teardown. The scripts start their own temporary server (free port, throwaway database, own process group) and kill it from an `EXIT` trap along with every browser session. Don't point them at the `npm run dev` server on `weather-starter.localhost:1355` (it may be the user's, on their real database). To reuse a server you started yourself, set `E2E_BASE_URL`. Afterwards no process from the check may still hold a port.