# Contract: Lightning API

## `POST /api/lightning/refresh`

Returns the last 60 minutes of lightning strikes for Singapore. Called by the frontend only on a user
action (turning the layer on, or pressing Refresh), never on page load. No request body. No
authentication; the optional server-side `WEATHER_API_KEY` is used upstream if set.

**Behaviour**: if the server holds a window fetched less than 2 minutes ago, it returns that window
without any upstream request. Otherwise it fetches, normalises and caches a new one. Concurrent calls
share one upstream fetch.

### 200 OK

```json
{
  "strikes": [
    {
      "id": "2026-11-11T21:38:00+08:00|1.3521|103.8198",
      "latitude": 1.3521,
      "longitude": 103.8198,
      "occurred_at": "2026-11-11T21:38:00+08:00",
      "type": "C",
      "label": "Cloud to Cloud"
    }
  ],
  "window_minutes": 60,
  "fetched_at": "2026-11-11T13:41:10.000Z",
  "provider_updated_at": "2026-11-11T21:42:02+08:00",
  "stale": false
}
```

- `strikes` is newest first and may be empty (the normal case; not an error).
- `stale: true` means the upstream refresh failed and a previous window (still trimmed to the last
  60 minutes at response time) is being returned.

### 502 Bad Gateway

Upstream failed and no earlier window exists to fall back on.

```json
{ "detail": "Lightning data is currently unavailable" }
```

The error shape matches the existing API (`{ detail }`). Provider messages and keys are never included.

### Other

- Any other method on this path returns Express's default 404.
- Unexpected server errors use the existing 500 handler (`{ detail: "Internal server error" }`).

## Server interface (injectable, Principle III)

```ts
interface LightningClient {
  /** Strikes from the 60 minutes before `now`, newest first. Throws WeatherProviderError on failure. */
  getRecentLightning(now?: Date): Promise<LightningObservation>;
}
createApp({ lightningClient?: LightningClient, ... })
```

## Frontend contract

`api.ts` exports `refreshLightning(): Promise<LightningObservation>`, a `POST` to the path above via
the shared `request` helper, with the same error handling as other calls. The store exposes
`lightning: { enabled, status, observation, setEnabled(boolean), refresh() }`; `setEnabled(true)`
and `refresh()` skip the request when `observation.fetched_at` is under 2 minutes old. `status` starts as `idle` (a "Show latest lightning" button that calls `refresh()`); nothing is requested on mount. On failure `status` becomes `unavailable` and the previous `observation` is kept.

## Upstream (for reference only)

`GET https://api-open.data.gov.sg/v2/real-time/api/weather?api=lightning&date=YYYY-MM-DD[&paginationToken=…]`.
See [research.md](./research.md) for pagination and window behaviour.
