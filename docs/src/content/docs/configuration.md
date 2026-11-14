---
title: Configuration
description: Environment variables read by the server, scripts and frontend.
---

The backend loads `.env` from the repo root through `dotenv/config`. `.env.example` lists the common variables. Restart `npm run dev` after any change.

## Backend

| Variable | Default | Read by | Purpose |
| --- | --- | --- | --- |
| `WEATHER_API_KEY` | unset | `server.ts`, `routes/locations.ts`, `routes/lightning.ts` | Sent as `x-api-key` to data.gov.sg for higher rate limits. Optional. With a key, requests are paced for 12 per 10 s; without, for 6 per 10 s, so a refresh is slower. |
| `WEATHER_API_RATE_LIMIT` | unset | `providerHttp.ts` | Requests per 10 s that the key allows, for a tier other than Development (for example `30` for a Production key). Invalid values are ignored. |
| `DATABASE_PATH` | `backend/weather.db` | `db.ts`, `drizzle.config.ts`, `scripts/reset.mjs` | SQLite file location, relative to the working directory. |
| `PORT` | `3000` | `server.ts` | Listen port on `127.0.0.1`. Portless sets this in development. |
| `NODE_ENV` | unset | `server.ts`, `logger.ts` | `production` serves `frontend/dist` and disables the lightning fixture. `test` skips frontend serving and request logging. |
| `LOG_LEVEL` | `info` (`silent` in tests) | `logger.ts` | pino log level. |
| `LOG_FILE_PATH` | `backend/logs/app.log` | `logger.ts` | Second log destination alongside stdout. |
| `LIGHTNING_FIXTURE` | unset | `server.ts` | `demo` serves three fake strikes instead of calling data.gov.sg. Ignored when `NODE_ENV=production`. |

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
| `VITE_CARTO_API_KEY` | unset | Appended to CARTO basemap tile URLs. Without it the map uses CARTO's keyless subdomain tiles. |
