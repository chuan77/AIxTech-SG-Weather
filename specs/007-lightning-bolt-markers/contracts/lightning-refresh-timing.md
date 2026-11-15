# Contract: Lightning refresh timing

Extends `specs/002-lightning-map-layer/contracts/lightning-api.md`. The request, the JSON body and the status codes of `POST /api/lightning/refresh` are **unchanged**.

## Response header (new)

Every response, 200 or 502, carries a standard `Server-Timing` header:

```
Server-Timing: total;dur=3521, provider;dur=3480;desc="fetch", pacing;dur=1717, retry;dur=0, requests;desc="2", pages;desc="2"
```

| Metric | `dur` (ms) | `desc` |
|---|---|---|
| `total` | always | n/a |
| `provider` | when known | `cache`, `shared` or `fetch` |
| `pacing` | when known | n/a |
| `retry` | when known | n/a; also `retries;desc="N"` when N > 0 |
| `requests` | n/a | count |
| `pages` | n/a | count |

- With an injected fake client that fills no timing, only `total` is sent.
- Values are numbers or the fixed enums above. No URL, query, key or error text is ever included (FR-011).

## Server log record (new)

One `info` line per call to `SingaporeLightningClient.getRecentLightning`:

```json
{ "level": 30, "msg": "lightning refresh timing", "served": "fetch", "totalMs": 3521, "providerMs": 3480,
  "pages": 2, "requests": 2, "pacingWaitMs": 1717, "retries": 0, "retryWaitMs": 0,
  "strikes": 370, "outcome": "ok" }
```

On failure, `outcome` is `"stale"` or `"error"`, plus `errorKind`. The existing `warn` lines are unchanged.

## Browser console record (new)

One `console.info` per user-triggered refresh, never `console.error`:

```
[lightning] refresh timing { trigger: "refresh", served: "network", totalMs: 3890, networkMs: 3610,
  drawMs: 280, strikes: 370, outcome: "ok", server: { served: "fetch", providerMs: 3480, requests: 2,
  pacingWaitMs: 1717, retries: 0, retryWaitMs: 0 } }
```

A refresh skipped by the store's 2-minute freshness check logs `served: "reused"` with `networkMs: 0`. Nothing is added to the visible dashboard (FR-012).
