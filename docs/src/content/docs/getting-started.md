---
title: Getting started
description: Install, run and explore Weather Starter locally.
---

## Requirements

- Node.js 22.13 or later. The backend uses the built-in `node:sqlite` module without the `--experimental-sqlite` flag. The docs site (Astro 7) needs Node 22.23.4 or later.
- npm (the repo is an npm workspace: `frontend`, `backend`, `docs`).

## Install and run

```bash
npm install
npm run dev
```

`npm run dev` runs `scripts/dev.mjs`, which starts `tsx watch backend/src/server.ts` under [Portless](https://www.npmjs.com/package/portless). Portless picks a free local port for the server and proxies a stable URL to it:

```text
http://weather-starter.localhost:1355
```

The backend restarts on source changes. The frontend hot-reloads through Vite middleware in the same process.

:::caution[Run from the repo root]
The SQLite path, log path and migrations folder are resolved from `process.cwd()`. Starting the server from inside `backend/` creates a second, empty database there.
:::

## Try it

1. Click **Add Location** in the sidebar and enter a Singapore coordinate, for example `1.35`, `103.85`.
2. The backend saves the location, fetches its weather from data.gov.sg and returns the stored snapshot.
3. Click **Refresh** under the hero to fetch a new snapshot.

The same steps from the command line:

```bash
curl -s -X POST http://weather-starter.localhost:1355/api/locations \
  -H "Content-Type: application/json" \
  -d '{"latitude": 1.35, "longitude": 103.85}'

curl -s -X POST http://weather-starter.localhost:1355/api/locations/1/refresh
```

## Commands

All commands run from the repo root.

| Command | What it does |
| --- | --- |
| `npm run dev` | Express + Vite through Portless |
| `npm test` | Vitest, backend and frontend `*.test.ts` |
| `npx vitest run <file> -t "<name>"` | One test file or one test |
| `npm run lint` | ESLint over the repo |
| `npm run build` | Type-check and build the frontend, compile the backend to `backend/dist` |
| `npm run start` | Run the compiled server with `NODE_ENV=production` |
| `npm run doctor` | Check `/health` and `/api/locations` on `WEATHER_STARTER_URL` (default `http://127.0.0.1:3000`) |
| `npm run reset` | Delete the SQLite database and its `-wal`/`-shm` files |
| `npm run db:generate` | Generate a Drizzle migration after editing `backend/src/schema.ts` |
| `npm run db:migrate` | Apply migrations with drizzle-kit (the server also migrates on start) |
| `npm run docs` | This documentation site on `http://localhost:4321` |

Restart `npm run dev` after changing `.env`, `.env.local` or `frontend/.env.local`. See [Configuration](/configuration/) for the variables.

## Repository layout

```text
backend/
  drizzle/             Generated SQL migrations (applied at startup)
  src/
    server.ts          createApp, Vite/static serving, /health, /api/logs
    routes/            locations.ts, lightning.ts (+ tests)
    weather.ts         SingaporeWeatherClient: builds a WeatherSnapshot
    lightning.ts       SingaporeLightningClient: cached lightning window
    lightningFixture.ts  Fake strikes for LIGHTNING_FIXTURE=demo
    providerHttp.ts    Shared data.gov.sg HTTP behaviour
    db.ts, schema.ts   SQLite via Drizzle
    logger.ts          pino to stdout and backend/logs/app.log
frontend/src/
  api.ts               fetch wrappers for /api/*
  state/store.tsx      The single store context
  components/          Sidebar, Hero, tiles, forecast strips
  components/map/      Leaflet map and lightning layer
  theme/               Theme registry and context
scripts/               dev, start, doctor, reset
docs/                  This site (Astro Starlight)
specs/                 Feature specs (spec-kit)
```
