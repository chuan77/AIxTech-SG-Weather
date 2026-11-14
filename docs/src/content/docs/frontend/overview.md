---
title: Frontend overview
description: Component tree, the single store context, and how the UI talks to the API.
sidebar:
  order: 1
---

React 18, Tailwind 3 and Leaflet, built by Vite. There is no router: one page, one layout.

## Component tree

```mermaid
flowchart TD
  main["main.tsx<br/>applyTheme(loadThemeId())"] --> App
  App --> ThemeProvider --> StoreProvider --> Layout

  Layout --> Sidebar
  Layout --> Hero
  Layout --> ThemeSelector

  Sidebar --> Search["Search input<br/>(filters by area/condition)"]
  Sidebar --> AddLocationForm
  Sidebar --> LoadError["Load error + Retry"]
  Sidebar --> SidebarCard["SidebarCard x N<br/>select, delete"]

  Hero --> Header["Area, temperature, H/L"]
  Hero --> HourlyStrip["HourlyStrip<br/>forecast_periods"]
  Hero --> TenDayForecast["TenDayForecast<br/>daily_forecast"]
  Hero --> MapCard
  Hero --> TileGrid
  Hero --> RefreshBtn["Refresh button"]

  MapCard --> WeatherMap
  MapCard --> LightningControl
  MapCard --> MapFullscreen["MapFullscreen (portal)"]
  WeatherMap --> LightningLayer

  TileGrid --> Tiles["Condition, Feels like, Heat stress, Air quality,<br/>Wind, UV, Temperature, Precipitation,<br/>Humidity, Averages, Sunrise/Sunset"]
```

`Hero` returns early with a "Select a location" message when nothing is selected, so the map card and tiles only appear once a location exists.

## The store

All server state lives in one React context, `frontend/src/state/store.tsx`, backed by the fetch wrappers in `frontend/src/api.ts`. Components read it with `useStore()` and `useSelectedLocation()`.

```mermaid
flowchart LR
  subgraph Store["StoreProvider (state/store.tsx)"]
    State["locations, selectedId,<br/>isAdding, isLoading,<br/>refreshingId, error, loadError"]
    LState["lightning: enabled, status,<br/>observation"]
    Actions["select, setAdding, create,<br/>remove, refresh, reload"]
    LActions["lightning.setEnabled,<br/>lightning.refresh"]
  end

  Components["Components"] -- "useStore()" --> State & Actions & LState & LActions
  Actions --> Api["api.ts"]
  LActions --> Api
  Api -- "fetch /api/*" --> Server[("Express")]
  Actions & LActions -. "logInteraction()" .-> Logs["POST /api/logs"]
  LState <-. "weather-starter.lightning.enabled" .-> LS[("localStorage")]
```

| Action | API calls | Then |
| --- | --- | --- |
| mount | `GET /api/locations` | Select the first location |
| `create(payload)` | `POST /api/locations`, then `GET /api/locations` | Select the new location, close the form |
| `refresh(id)` | `POST /api/locations/:id/refresh`, then `GET /api/locations` | `refreshingId` is set while it runs |
| `remove(id)` | `DELETE /api/locations/:id` | Removed locally, no reload |
| `reload()` | `GET /api/locations` | Used by the sidebar Retry button |

Behaviour worth knowing:

- **Selection:** `selectedId` is derived. If the stored id no longer exists, the first location is selected.
- **Home:** the first location in the list (the newest) is labelled "Home" in the sidebar and hero.
- **Failed load:** the list already on screen is kept, and `loadError` shows in the sidebar with a Retry button. A failed load never looks like an empty list.
- **Errors from `create` and `remove`** are rethrown so the form and card can show them inline.

## API client

`api.ts` sends JSON to relative `/api` paths, so the same build works behind Portless or in production with no configuration. A non-OK response throws `Error(detail)` using the server's `detail` message. `204` resolves to `null`.

`logInteraction(event, metadata)` posts to `/api/logs` with `keepalive: true` and swallows failures, so logging never affects the UI.

## Missing values

Readings are often `null`: a location that was never refreshed, a station that did not report, or a failed upstream call. Most tiles show `--` or `--°`. The newer derived tiles show a "No reading" state instead (see [Derived tiles](/frontend/derived-tiles/)).
