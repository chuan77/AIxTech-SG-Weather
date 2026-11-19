---
title: Configuration
description: Environment variables read by the server, scripts and frontend.
---

The backend loads `.env` from the repo root through `dotenv/config`. `.env.example` lists the common variables. Restart `npm run dev` after any change.

## Backend

| Variable | Default | Read by | Purpose |
| --- | --- | --- | --- |
| `WEATHER_API_KEY` | unset | `server.ts`, `routes/locations.ts`, `routes/lightning.ts`, `routes/rain.ts` | Sent as `x-api-key` to data.gov.sg for higher rate limits. Optional. With a key, requests are paced for 12 per 10 s; without, for 6 per 10 s, so a refresh is slower. |
| `WEATHER_API_RATE_LIMIT` | unset | `providerHttp.ts` | Requests per 10 s that the key allows, for a tier other than Development (for example `30` for a Production key). Invalid values are ignored. |
| `DATABASE_PATH` | `backend/weather.db` | `dbConfig.ts`, `drizzle.config.ts`, `scripts/reset.mjs` | SQLite file location, relative to the working directory. Local mode only. |
| `TURSO_DATABASE_URL` | unset | `dbConfig.ts` | Hosted Turso database (`libsql://…`). Set it together with `TURSO_AUTH_TOKEN` to use Turso instead of the local file. Ignored by tests and e2e checks. |
| `TURSO_AUTH_TOKEN` | unset | `dbConfig.ts` | Secret token for that database. Never logged. |
| `DATABASE_REQUIRE_REMOTE` | unset | `dbConfig.ts` | `true` makes starting without Turso an error. The container image sets it. |
| `HOST` | `127.0.0.1` | `listenConfig.ts` | Listen address. The container image sets `0.0.0.0`. |
| `PORT` | `3000` | `listenConfig.ts` | Listen port. Portless sets this in development; the container and Vercel use `3000`. |
| `RATE_LIMITS` | unset | `server.ts` | `on` turns on per-device limits: 30 weather fetches (adding or refreshing a place) per 10 minutes and 60 `/api/logs` events per minute, answering `429` with `Retry-After`. The container image sets it; local dev and e2e leave it off. |
| `TRUST_PROXY` | unset | `server.ts` | Number of proxy hops to trust for the client address (Express `trust proxy`). The container image sets `1` for Vercel. |
| `NODE_ENV` | unset | `server.ts`, `logger.ts` | `production` serves `frontend/dist` and disables the lightning and rain fixtures. `test` skips frontend serving and request logging. |
| `LOG_LEVEL` | `info` (`silent` in tests) | `logger.ts` | pino log level. |
| `LOG_FILE_PATH` | `backend/logs/app.log` | `logger.ts` | Second log destination alongside stdout. The container image sets `/tmp/lepak-weather.log`. |
| `LIGHTNING_FIXTURE` | unset | `server.ts` | `demo` serves three fake strikes instead of calling data.gov.sg. Ignored when `NODE_ENV=production`. |
| `TEMP_WIND_FIXTURE` | unset | `server.ts` | `demo` serves 17 fake temperature and wind stations (every wind level and calm, wind only, temperature only, no reading, unnamed, speed without direction) instead of calling data.gov.sg. Ignored when `NODE_ENV=production`. |
| `RAIN_FIXTURE` | unset | `server.ts` | `demo` serves 20 fake rain stations (every level, partial and missing) instead of calling data.gov.sg. Ignored when `NODE_ENV=production`. |

## Dev server

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORTLESS_PORT` | `1355` | Port of the Portless proxy in the `.localhost` URL. |
| `PORTLESS_HTTPS` | `0` | Set to `1` to serve the dev URL over HTTPS. |
| `WEATHER_STARTER_URL` | `http://127.0.0.1:3000` | Base URL checked by `npm run doctor`. |

## Frontend

Set in `frontend/.env.local`. Vite only exposes variables prefixed with `VITE_`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_CARTO_API_KEY` | unset | Appended to CARTO basemap tile URLs. Without it the map uses CARTO's keyless subdomain tiles. In development Vite inlines it from `frontend/.env.local`. In production the server reads it from its own environment at runtime and puts it in `index.html` as `<meta name="carto-api-key">`, which `components/map/cartoKey.ts` prefers. |
