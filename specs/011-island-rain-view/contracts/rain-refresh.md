# Contract: `POST /api/rain/refresh`

Explicit user action only. This is the endpoint named in the Principle I amendment (research R10). The frontend never calls it on page load. It is `POST` for the same reason lightning's is: it is an action, not a page-load read.

## Request

- Method `POST`, path `/api/rain/refresh`, no body, no query parameters.
- It does not use any saved location.

## 200 OK

The body is an `IslandRainObservation` ([data-model.md](../data-model.md)).

```json
{
  "stations": [
    { "id": "S111", "name": "Scotts Road", "latitude": 1.31055, "longitude": 103.8365,
      "total_mm": 1.4, "periods_covered": 3 },
    { "id": "S43", "name": "Kim Chuan Road", "latitude": 1.3399, "longitude": 103.8878,
      "total_mm": 0.2, "periods_covered": 2 },
    { "id": "S900", "name": "Example Station", "latitude": 1.35, "longitude": 103.7,
      "total_mm": null, "periods_covered": 0 }
  ],
  "window_minutes": 15,
  "window_start": "2026-11-17T08:00:00+08:00",
  "window_end": "2026-11-17T08:15:00+08:00",
  "periods_found": 3,
  "fetched_at": "2026-11-17T08:24:12.000Z",
  "stale": false
}
```

- `stale: true` means a previous snapshot is being served because the latest provider call failed. The status is still 200.
- Within 2 minutes of the last fetch, the server returns the cached snapshot **without contacting data.gov.sg** (FR-009).
- A `Server-Timing` header carries the `RainTiming` numbers (diagnostics only).
- The response is compressed by the existing `compression` middleware. 88 stations come to roughly 8 KB of JSON.

## 502 Bad Gateway

```json
{ "detail": "Rain data is currently unavailable" }
```

This is returned when the provider fails, refuses (429) or returns no usable period, and there is no earlier snapshot to serve. The message is fixed: provider text, URLs and keys are never echoed. A `Server-Timing` header is still sent.

## Other errors

Unexpected errors go to the app's existing error handler (500). This route has no 4xx cases, because it takes no input.

## Upstream calls behind it (for planning and tests, not part of the public contract)

- `GET https://api-open.data.gov.sg/v2/real-time/api/rainfall?date=<YYYY-MM-DD SGT>`, first page only. When the window reaches before 00:00 SGT, one more call is made for the previous date.
- Both go through the shared `ProviderRequester`: the same pacing, 429 retry and `x-api-key` as every other call.

## Tests (Principle VI)

`backend/src/routes/rain.test.ts` builds the app with `createApp({ weatherClient: fake, rainClient: fake })` and a temporary SQLite database, then calls the route through Supertest. It covers:
- a 200 response with the body shape above;
- a 200 with `stale: true`;
- a 502 with the fixed message and no provider text;
- the `Server-Timing` header being present;
- no saved-locations rows being written.
