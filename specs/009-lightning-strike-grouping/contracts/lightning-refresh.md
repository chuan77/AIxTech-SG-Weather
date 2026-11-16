# Contract: `POST /api/lightning/refresh` (and the storm fixture)

The endpoint, its behaviour and its JSON body are **unchanged** from spec 002 and spec 007. This feature changes only how the response is encoded on the wire, and adds a development fixture.

## Request

`POST /api/lightning/refresh` with no body (same CSRF and same-origin rules as today). It is sent only on an explicit user action (constitution Principle I exception).

## Response

- **Status**: 200 with a `LightningObservation`, or 502 with `{ error }` as today.
- **Body shape**: unchanged:

  ```json
  { "strikes": [{ "id": "…", "latitude": 1.37, "longitude": 103.81, "occurred_at": "…", "type": "C", "label": "Cloud to Cloud" }],
    "window_minutes": 60, "fetched_at": "…", "provider_updated_at": "…", "stale": false }
  ```

- **New**: `Content-Encoding: br` or `gzip` whenever the request's `Accept-Encoding` allows it and the body is over the middleware threshold (1 KB). `Vary: Accept-Encoding` is set. Clients that don't accept compression get the identity encoding as today.
- **Unchanged headers**: `Server-Timing` (spec 007) still lists `total`, `provider`, `pacing`, `retry`, `requests` and `pages`.
- **Size requirement (SC-005)**: at 37,242 strikes the encoded body is ≤ 1.5 MB (measured: about 545 KB gzip, about 335 KB brotli).

## Tests (Principle VI: Supertest with a fake client)

- With `Accept-Encoding: gzip` and a fake client returning ≥ 1,000 strikes, the response has `content-encoding: gzip`, and the decoded body equals the uncompressed body.
- Without `Accept-Encoding`, there's no `content-encoding` and the body is unchanged.
- `Server-Timing` is present in both cases.

## Development fixture `LIGHTNING_FIXTURE=storm`

| Aspect | Contract |
|---|---|
| Activation | `LIGHTNING_FIXTURE=storm` and `NODE_ENV !== 'production'`, otherwise ignored. Logs a `warn`: `LIGHTNING_FIXTURE=storm: serving the 2026-11-16 storm (37,242 strikes, development only)` |
| Source | `backend/fixtures/lightning-storm-2026-11-16.json.gz` (format in [data-model.md](../data-model.md#stormreplayfixture-new-development-and-tests)) |
| Behaviour | Returns a `LightningObservation` whose strikes are the capture, with every `occurred_at` shifted by `now − captured_at`, `fetched_at = now`, `stale: false` |
| Determinism | The same `now` gives identical output |
| Test | `backend/src/lightningFixture.test.ts`: 37,242 strikes, all inside `[now − 60 min, now + 5 min]`, newest first, unique ids, identical across two calls with the same `now` |
