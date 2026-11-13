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
npm run reset                 # deletes backend/weather.db
npm run db:generate           # drizzle migration after editing backend/src/schema.ts
```

There is no ESLint or Prettier config (the packages are installed but nothing runs them). Restart `npm run dev` after changing `.env`, `.env.local` or `frontend/.env.local`. Run from the repo root: the DB path is relative to `process.cwd()`.

Do not commit `RealtimeWeatherReadingsacrossSingapore/` (untracked sample API dumps).

## Read before working on

- [Architecture](docs/architecture.md): one-process server, snapshot pattern, storage, frontend store, map. Read before changing backend, API or data flow.
- [Theming](docs/theming.md): the `--ink` and `rounded-card` mechanics. Read before touching colours, Tailwind classes or `index.css`.
- [Testing](docs/testing.md): vitest setup and its limits. Read before adding tests.

## Browser Automation Routing
- Use `agent-browser` for UI navigation, clicking interactive `@eN` refs, form filling, screenshots, and E2E verification.
- Use `chromedevtools` only when inspecting deep DevTools performance traces, memory profiles, or raw CDP network internals.