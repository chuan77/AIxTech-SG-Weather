---
title: System overview
description: How the browser, the single Node process, SQLite and data.gov.sg fit together.
sidebar:
  order: 1
---

Weather Starter is one Node process. Express handles `/api/*` and, outside tests, also serves the React app: through Vite middleware in development, or as static files from `frontend/dist` in production.

## System architecture

```mermaid
flowchart TB
  Browser["Browser<br/>React 18 + Tailwind + Leaflet"]
  Portless["Portless proxy<br/>weather-starter.localhost:1355"]
  CARTO[("CARTO basemap tiles")]

  subgraph Node["Node process (backend/src/server.ts)"]
    direction TB
    Express["Express app<br/>createApp()"]
    Vite["Vite middleware (dev)<br/>or frontend/dist (prod)"]
    Locations["routes/locations.ts"]
    Lightning["routes/lightning.ts"]
    Logs["POST /api/logs"]
    WClient["SingaporeWeatherClient<br/>weather.ts"]
    LClient["SingaporeLightningClient<br/>lightning.ts<br/>2-minute memory cache"]
    Http["ProviderRequester<br/>providerHttp.ts<br/>one shared, rate-limited queue"]
    DB["db.ts<br/>Drizzle sqlite-proxy"]
    Logger["pino logger"]
  end

  SQLite[("SQLite<br/>backend/weather.db")]
  LogFile[("backend/logs/app.log")]
  DataGov[("data.gov.sg<br/>api-open / api")]

  Browser --> Portless --> Express
  Browser -. map tiles .-> CARTO
  Express --> Vite
  Express --> Locations
  Express --> Lightning
  Express --> Logs
  Locations --> DB --> SQLite
  Locations --> WClient --> Http
  Lightning --> LClient --> Http
  Http --> DataGov
  Logs --> Logger --> LogFile
```

In production there is no Portless: `npm run start` runs `backend/dist/server.js` with `NODE_ENV=production`, listening on `127.0.0.1:$PORT`.

## Design rules

These come from the project constitution (`.specify/memory/constitution.md`) and shape every change.

| Rule | What it means in the code |
| --- | --- |
| **Snapshot-only weather** | data.gov.sg is called only on location create or refresh. `GET /api/locations` reads SQLite only. Map pins come from that same data. |
| **Lightning exception** | `POST /api/lightning/refresh` may call data.gov.sg on a user action. Results are cached 2 minutes and never stored. |
| **One process, relative API** | The frontend calls `/api/*` only. All server state lives in `frontend/src/state/store.tsx`. There is no router. |
| **Injectable providers** | `createApp({ weatherClient, lightningClient })`. Tests inject fakes and never reach the network. |
| **Theme-driven UI** | Colours come from CSS variables through Tailwind's `white` alias, panels use `rounded-card`. |

## Request routing

```mermaid
flowchart TD
  Req["Incoming request"] --> PinoHttp["pino-http request log<br/>(skipped in tests)"]
  PinoHttp --> Json["express.json()"]
  Json --> Health{"GET /health?"}
  Health -- yes --> H200["200 {status: healthy}"]
  Health -- no --> Api{"/api/* route?"}
  Api -- yes --> Router["logs / locations / lightning router"]
  Api -- no --> Front{"serveFrontend?"}
  Front -- "dev" --> ViteMW["Vite middleware (SPA)"]
  Front -- "production" --> Static["express.static(frontend/dist)<br/>then index.html fallback"]
  Front -- "test" --> NotFound["Express 404"]
  Router -- "unhandled error" --> Err["error handler<br/>500 {detail: Internal server error}"]
```

## Startup sequence

1. `server.ts` imports `dotenv/config`, then the routers, which import `db.ts`.
2. `db.ts` opens SQLite with WAL mode and runs Drizzle migrations from `backend/drizzle/` using top-level `await`. If that fails it logs the cause and the process exits non-zero. The database file is never deleted or recreated.
3. `createApp()` builds the app. If `LIGHTNING_FIXTURE=demo` and not in production, it swaps in the fixture lightning client.
4. When run directly (not imported by tests), the app listens on `127.0.0.1:${PORT ?? 3000}`.
