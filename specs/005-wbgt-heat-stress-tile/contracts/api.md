# Contracts: WBGT Heat-Stress Tile

No new endpoints. Existing routes change only by carrying five extra snapshot fields.

## `GET /api/locations`, `POST /api/locations`, `POST /api/locations/:id/refresh`

Each location's `weather` object gains:

```json
{
  "wbgt_c": 27.3,
  "heat_stress_level": "Low",
  "wbgt_station_name": "Upper Changi Road North",
  "wbgt_station_distance_km": 1.2,
  "wbgt_observed_at": "2026-11-14T11:45:00+08:00"
}
```

- Every field may be `null`. That happens when the location is unrefreshed, saved before this feature, the WBGT fetch failed, or no station has a numeric reading.
- `GET /api/locations` still reads only SQLite and makes no provider call (Principle I).
- A failed WBGT fetch MUST NOT change the status code of create or refresh. Both still return the rest of the snapshot.

## Upstream call (provider, via the shared `ProviderRequester`)

`GET {apiBase}/v2/real-time/api/weather?api=wbgt`, sent with `x-api-key` when a key is set. This brings a refresh to 12 calls. The shape is in [research.md R1](../research.md).

## Pacing contract (all provider calls in the process)

- One request stream for the weather and lightning clients together.
- Request starts are spaced at least `requestIntervalMs` apart, which is 884 ms with a key and 1717 ms without.
- On a 429, the requester waits `rateLimitRetryDelayMs` (10 s) and retries once. A second failure raises `WeatherProviderError` for that call only.
