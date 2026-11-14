---
title: Data flow
description: The snapshot pattern for locations and the on-demand path for lightning.
sidebar:
  order: 2
---

The dashboard never calls data.gov.sg on page load. Each saved location holds one `WeatherSnapshot` in SQLite, and that snapshot only changes when the location is created or refreshed.

## Page load

```mermaid
sequenceDiagram
  participant UI as React store
  participant API as Express
  participant DB as SQLite

  UI->>API: GET /api/locations
  API->>DB: SELECT * FROM locations ORDER BY created_at DESC, id DESC
  DB-->>API: rows
  API-->>UI: { locations: Location[] }
  Note over UI: Selects the first location.<br/>Map pins and tiles render from this data.
```

No weather call happens here. A location that has never been refreshed carries the default snapshot (`condition: "Not refreshed"`, `source: "not-refreshed"`, all readings `null`), which the UI shows as `--°`.

## Creating a location

```mermaid
sequenceDiagram
  participant UI as React store
  participant API as POST /api/locations
  participant DB as SQLite
  participant WX as SingaporeWeatherClient
  participant DG as data.gov.sg

  UI->>API: { latitude, longitude }
  alt not numbers, or outside lat 1.1-1.5 / lon 103.6-104.1
    API-->>UI: 422
  end
  API->>DB: duplicate check, then INSERT with default snapshot
  alt same coordinates already saved (pre-check or unique index race)
    API-->>UI: 409 Location already exists
  end
  API->>WX: getCurrentWeather(lat, lon)
  WX->>DG: 12 requests through the shared requester, ~884 ms apart (about 10 s)
  DG-->>WX: forecasts, readings, air quality, WBGT
  WX-->>API: WeatherSnapshot
  API->>DB: UPDATE snapshot columns
  API-->>UI: 201 Location (with snapshot)
  Note over API,UI: If the weather step throws, the row is kept<br/>and 201 returns the default snapshot.
  UI->>API: GET /api/locations (reload list)
```

The insert comes first so a saved location survives any upstream failure.

## Refreshing a location

```mermaid
sequenceDiagram
  participant UI as React store
  participant API as POST /api/locations/:id/refresh
  participant DB as SQLite
  participant WX as SingaporeWeatherClient

  UI->>API: refresh(id)
  API->>DB: SELECT location
  alt not found
    API-->>UI: 404
  end
  API->>WX: getCurrentWeather(lat, lon)
  WX-->>API: WeatherSnapshot
  API->>DB: UPDATE snapshot columns (overwrite)
  API-->>UI: 200 Location
  UI->>API: GET /api/locations (reload list)
```

Each refresh overwrites the previous snapshot. There is no history table.

:::note[When does refresh return 502?]
The route maps a thrown `WeatherProviderError` to `502`. In practice `SingaporeWeatherClient` catches the failure of each upstream call and substitutes `null` values, so a refresh during an outage usually returns `200` with `condition: "Unavailable"` and empty readings. The `502` path is reached by custom or fake clients that throw.
:::

## Lightning (the exception)

Lightning is island-wide, not tied to a location, and is fetched only on an explicit user action: turning the layer on, pressing its refresh button, or clicking the idle prompt.

```mermaid
sequenceDiagram
  participant UI as React store (lightning slice)
  participant API as POST /api/lightning/refresh
  participant LC as SingaporeLightningClient
  participant DG as data.gov.sg

  UI->>UI: Skip if a request is in flight<br/>or data is under 2 minutes old
  UI->>API: refreshLightning()
  API->>LC: getRecentLightning()
  alt cache under 2 minutes old
    LC-->>API: cached window (trimmed to 60 min)
  else cache expired
    LC->>DG: weather?api=lightning&date=today (up to 3 pages, then 1 page of yesterday if needed)
    alt success
      DG-->>LC: records
      LC-->>API: fresh observation (stale: false)
    else failure, earlier window cached
      LC-->>API: previous window, stale: true
    else failure, nothing cached
      LC-->>API: throws WeatherProviderError
      API-->>UI: 502 Lightning data is currently unavailable
    end
  end
  API-->>UI: LightningObservation
```

Nothing from lightning is written to SQLite or to any `WeatherSnapshot`. Concurrent requests share one in-flight upstream fetch. On the client, strikes keep fading and drop off after 60 minutes on a 30-second timer with no further network calls.

## Frontend interaction logging

Store actions call `logInteraction(event, metadata)`, which posts to `POST /api/logs` with `keepalive: true` and ignores failures. The server validates the event name against `^[a-z][a-z0-9_.:-]{1,63}$` and writes it to the pino log with `source: "frontend"`. Events include `location_create_submitted`, `location_created`, `location_refresh_clicked`, `location_deleted`, `lightning_toggled`, `lightning_refreshed` and `map_expanded`.
