---
title: Weather provider
description: How SingaporeWeatherClient turns 12 data.gov.sg calls into one WeatherSnapshot.
sidebar:
  order: 2
---

`backend/src/weather.ts` exports `SingaporeWeatherClient`. Its one public entry point used by the routes is:

```ts
getCurrentWeather(latitude: number, longitude: number): Promise<WeatherSnapshot>
```

The routes depend only on the `WeatherClient` interface (`routes/locations.ts`), so tests can pass any object with that method to `createApp({ weatherClient })`.

## Upstream calls

One refresh makes 12 requests. They are started together with `Promise.all`, but the shared `ProviderRequester` spaces them to fit the API key's rate limit (884 ms apart with a key), so a refresh takes about 10 seconds. See [Shared HTTP behaviour](#shared-http-behaviour).

```mermaid
flowchart LR
  GCW["getCurrentWeather(lat, lon)"]

  subgraph v2["api-open.data.gov.sg /v2/real-time/api/"]
    T2["two-hr-forecast"]
    AT["air-temperature"]
    RH["relative-humidity"]
    RF["rainfall"]
    WS["wind-speed"]
    WD["wind-direction"]
    UV["uv"]
    PSI["psi"]
    PM["pm25"]
    T24["twenty-four-hr-forecast"]
    WB["weather?api=wbgt"]
  end

  subgraph v1["api.data.gov.sg /v1/environment/"]
    D4["4-day-weather-forecast"]
  end

  GCW --> T2 -->|"nearest area"| C["condition, area,<br/>valid_period_text"]
  GCW --> AT & RH & RF & WS & WD -->|"nearest station<br/>with a value"| R["temperature, humidity,<br/>rainfall, wind"]
  GCW --> UV -->|"island-wide"| U["uv_index"]
  GCW --> PSI & PM -->|"nearest region"| AQ["PSI, PM2.5,<br/>PM10, O3, NO2, SO2, CO"]
  GCW --> T24 -->|"nearest region"| F24["forecast low/high,<br/>forecast_periods"]
  GCW --> D4 --> F4["daily_forecast"]
  GCW --> WB -->|"nearest station<br/>by km"| HS["wbgt_c, heat_stress_level,<br/>station, distance"]

  C & R & U & AQ & F24 & F4 & HS --> Snap[("WeatherSnapshot")]
```

| Field group | Endpoint | Matching |
| --- | --- | --- |
| `condition`, `area`, `valid_period_text` | `two-hr-forecast` | Nearest `area_metadata` label location |
| `temperature_c`, `humidity_percent`, `rainfall_mm`, `wind_*` | `air-temperature`, `relative-humidity`, `rainfall`, `wind-speed`, `wind-direction` | Nearest station that reported a numeric value in the latest reading |
| `uv_index` | `uv` | Island-wide |
| `psi_twenty_four_hourly`, pollutant fields, `air_quality_*` | `psi` | Nearest region from `regionMetadata` |
| `pm25_one_hourly` | `pm25` | Same region |
| `forecast_low_c`, `forecast_high_c` | `twenty-four-hr-forecast` | Island-wide general temperature |
| `forecast_periods` | `twenty-four-hr-forecast` | Nearest of the five fixed regions, falling back to `central` |
| `daily_forecast` | `4-day-weather-forecast` (legacy v1 host) | Island-wide |
| `wbgt_c`, `heat_stress_level`, `wbgt_station_name`, `wbgt_station_distance_km`, `wbgt_observed_at` | `weather?api=wbgt` | Nearest station with a numeric WBGT, by great-circle distance in km |

For most endpoints, "nearest" is the smallest squared difference in latitude and longitude. That is fine for ranking at Singapore's scale. WBGT is the exception: it uses a haversine distance in km (`distanceKm`), because the tile hides readings from stations more than 10 km away and needs a real distance. The backend stores the nearest station and its distance even when it is far; the cut-off is applied in the browser (see [Derived tiles](/frontend/derived-tiles/#heat-stress-componentsheatstressts)).

WBGT values arrive as strings (`"28.0"`) and are coerced with `Number()`; stations whose value is not numeric are skipped. `heat_stress_level` is NEA's label as published (`Low`, `Moderate`, `High`), not recomputed. `wbgt_observed_at` is the record's `datetime`.

The pollutant breakdown comes from the same `psi` response as the PSI value, so it adds no extra call.

`observed_at` is the latest timestamp across all sources that returned one.

## Partial failure

Every upstream call is wrapped in `fetchOptional`. If a call fails, the client logs `weather data source unavailable` with the endpoint name and uses a fallback (`null` values or an empty list). The other fields still fill in.

```mermaid
flowchart TD
  Call["fetchOptional(endpoint, fetch, fallback)"] --> Try{"request ok and<br/>payload code 0?"}
  Try -- yes --> Value["parsed value"]
  Try -- no --> Warn["logger.warn<br/>'weather data source unavailable'"] --> Fallback["fallback (nulls / [])"]
```

If the 2-hour forecast fails, the snapshot starts from an empty one with `condition: "Unavailable"`. As a result `getCurrentWeather` almost never throws. The location still updates, just with `null` readings.

## Shared HTTP behaviour

`backend/src/providerHttp.ts` holds `ProviderRequester`. data.gov.sg limits requests per API key, not per client, so `createApp` builds **one** requester and passes it to both default clients (`requester` option). Weather refreshes and lightning loads then share one queue and cannot together go over the limit.

```mermaid
flowchart LR
  W["SingaporeWeatherClient<br/>12 calls per refresh"] --> Q["one ProviderRequester<br/>(created in createApp)"]
  L["SingaporeLightningClient<br/>up to 4 calls per load"] --> Q
  Q -->|"starts spaced<br/>ceil(10000 / limit) + 50 ms"| DG[("data.gov.sg")]
```

- **Spacing:** request starts are at least `ceil(10000 / limit) + 50` ms apart, where `limit` is requests per 10 s: 12 with `WEATHER_API_KEY` (Development tier), 6 without, or `WEATHER_API_RATE_LIMIT` if set. That is 884 ms with a key and 1717 ms without.
- **Timeout:** 8 seconds per request via `AbortController`.
- **Rate limit:** on HTTP 429, wait 10 seconds (as the provider's error body asks), then retry once. A second 429 throws.
- **Overrides:** `requestIntervalMs` and `rateLimitRetryDelayMs` options replace the defaults. Tests set both to `0`.

A lightning load that starts during a refresh waits its turn in the queue, so it can take as long as the refresh (about 10 s).
- **Headers:** `Accept: application/json`, a `User-Agent` of `weather-starter/0.1 (educational project)`, and `x-api-key` when `WEATHER_API_KEY` is set.
- **Errors:** everything becomes a `WeatherProviderError` with a safe message: rate limit, rejected key (401/403), other HTTP status, or "Unable to reach weather provider".

## Adding a new reading

1. Add the field to `WeatherSnapshot` in `backend/src/schema.ts` and a column to the `locations` table.
2. Run `npm run db:generate` to create a migration in `backend/drizzle/`.
3. Map it in `weatherToColumns` and `rowToRecord` in `backend/src/db.ts`, and add it to `defaultWeather`.
4. Fetch it in `getCurrentWeather` inside `fetchOptional`, with a `null` fallback.
5. Add it to `frontend/src/types.ts` and render it, typically as a tile in `Tiles.tsx`.
6. Extend `backend/src/weather.test.ts` with a stubbed `fetch` response, and update the expected call count.

Each new endpoint adds one request interval (884 ms with a Development key) to every refresh.
