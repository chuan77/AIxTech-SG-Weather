# Contract: `POST /api/temp-wind/refresh`

This endpoint is called only on an explicit user action. It is the endpoint named in the Principle I amendment (research R10). The frontend never calls it on page load. Like rain and lightning, it is a `POST` because it is an action, not a read made during page load.

## Request

- Method `POST`, path `/api/temp-wind/refresh`.
- No body and no query parameters.
- It does not use any saved place.

## 200 OK

The body is an `IslandConditionsObservation` ([data-model.md](../data-model.md)).

```json
{
  "stations": [
    { "id": "S108", "name": "Marina Barrage", "latitude": 1.2799, "longitude": 103.8703,
      "temperature_c": null, "wind_speed_knots": 8.2, "wind_direction_deg": 230 },
    { "id": "S109", "name": "Ang Mo Kio Avenue 5", "latitude": 1.3793, "longitude": 103.85,
      "temperature_c": 26.6, "wind_speed_knots": 8.2, "wind_direction_deg": 253 },
    { "id": "S199", "name": null, "latitude": 1.33, "longitude": 103.75,
      "temperature_c": null, "wind_speed_knots": 5.4, "wind_direction_deg": 241 },
    { "id": "S24", "name": "Changi Meteorological Station", "latitude": 1.3678, "longitude": 103.9823,
      "temperature_c": 27.9, "wind_speed_knots": null, "wind_direction_deg": null }
  ],
  "measures": { "temperature": "ok", "wind": "ok" },
  "temperature_at": "2026-11-19T13:33:00+08:00",
  "wind_at": "2026-11-19T13:34:00+08:00",
  "fetched_at": "2026-11-19T05:40:12.000Z",
  "stale": false
}
```

The coordinates for S108 and S199 above are illustrative.

- **One measure failed**: when `air-temperature` failed, the response is still 200, with `"measures": { "temperature": "unavailable", "wind": "ok" }`, `temperature_at: null`, and `temperature_c: null` for every station. The same applies the other way round for wind.
- **Stale copy**: `stale: true` means the previous observation is being served because every provider call failed. The status is still 200.
- **Cache**: within 2 minutes of the last fetch, the server returns the cached observation **without contacting data.gov.sg** (FR-010). A failed fetch is also remembered for 2 minutes. Concurrent callers share one load.
- **Timing header**: a `Server-Timing` header carries the timing numbers. It is for diagnostics only.
- **Size**: about 17 stations, or 2–3 KB of JSON, compressed by the existing middleware.

## 502 Bad Gateway

```json
{ "detail": "Temperature and wind data is currently unavailable" }
```

This is returned when every provider call fails, is refused (429), or returns no usable reading, and there is no earlier observation to serve. The message is fixed: provider text, URLs and keys are never echoed. A `Server-Timing` header is still sent.

## Other errors

Unexpected errors go to the app's existing error handler (500). The route takes no input, so it has no 4xx cases.

## Upstream calls behind it

These details are for planning and tests. They are not part of the public contract.

- `GET https://api-open.data.gov.sg/v2/real-time/api/air-temperature`
- `GET …/wind-speed`
- `GET …/wind-direction`

All three take no parameters, so each returns the latest complete reading. They go through the shared `ProviderRequester` with `priority: 'high'`, so they get the same pacing, 429 retry and `x-api-key` as every other call.

## Tests (Principle VI)

`backend/src/routes/tempWind.test.ts` builds the app with `createApp({ weatherClient: fake, tempWindClient: fake })` and a temporary SQLite database, and calls the route through Supertest. It covers:

- a 200 response with the shape above;
- a 200 where one measure is unavailable;
- a 200 with `stale: true`;
- a 502 with the fixed message and no provider text;
- the `Server-Timing` header on both 200 and 502;
- that `GET` is not routed;
- that saved-place routes still work while the fake client throws.
