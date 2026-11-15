# Data Model: Themed Lightning Bolt Markers and Refresh Timing

Nothing is persisted. No schema, migration or `WeatherSnapshot` change. `LightningStrike` and `LightningObservation` (spec 002, `backend/src/lightning.ts`) are unchanged.

## Strike Mark (frontend, derived)

How one `LightningStrike` appears on the map. It's computed from the strike's age; it stores nothing.

| Field | Derivation | Rule |
|---|---|---|
| `step` | `floor(ageMinutes / 5)`, clamped 0–11 | ages over 60 min are not shown (`visibleStrikes`, unchanged) |
| `sizePx` | linear from 24 (step 0) to 14 (step 11), rounded | the hit box is the full size (FR-007) |
| `fillOpacity` | linear from 1.0 (step 0) to the floor (step 11) | floor default 0.25; a theme may raise it through CSS so its dark basemap still meets 3:1 |
| outline | always full opacity | carries 3:1 contrast on every theme (FR-004) |
| colours | CSS `var(--lightning)` fill, `var(--lightning-outline)` stroke | never a literal colour (Principle V) |

Icons are cached per `step`: at most 12 distinct `divIcon` objects whatever the strike count. A tick updates a marker only when its `step` changes.

## RequestStats (backend, in memory per call)

Optional accumulator passed to `ProviderRequester.getJson(url, stats?)`.

| Field | Type | Meaning |
|---|---|---|
| `requests` | integer ≥ 0 | HTTP attempts actually sent (a 429 retry counts as 2) |
| `pacingWaitMs` | number ≥ 0 | time spent waiting for a pacing slot |
| `retries` | integer ≥ 0 | 429 retries taken |
| `retryWaitMs` | number ≥ 0 | time spent in the retry delay |

## LightningTiming (backend, logged once per `getRecentLightning` call)

| Field | Type | Meaning |
|---|---|---|
| `served` | `'cache' \| 'shared' \| 'fetch'` | cache hit (under 2 min), joined an in-flight load, or fetched now |
| `totalMs` | number | from call start to return or throw |
| `providerMs` | number | wall time inside provider page fetches (0 unless `fetch`) |
| `pages` | integer | pages requested (0 unless `fetch`) |
| `requests`, `pacingWaitMs`, `retries`, `retryWaitMs` | from `RequestStats` | summed over pages |
| `strikes` | integer | strikes in the returned window |
| `outcome` | `'ok' \| 'empty' \| 'stale' \| 'error'` | `stale` means a previous window was served after a failure |
| `errorKind` | string, optional | `WeatherProviderError` class or message category only, never a URL or key |

Filled by the client into a sink object the route passes in (`getRecentLightning(now?, timing?)`). A fake client may leave it empty, and the route still reports its own `totalMs`.

## Browser Refresh Timing (frontend, console only)

One record per user-triggered `refreshLightningData` call.

| Field | Type | Meaning |
|---|---|---|
| `trigger` | `'toggle' \| 'refresh' \| 'prompt'` | which action started it |
| `served` | `'reused' \| 'network'` | `reused` = the store's own freshness check skipped the request |
| `totalMs` | number | action → strikes drawn (or → status shown, if nothing to draw) |
| `networkMs` | number | action → response received |
| `drawMs` | number | response → the frame after the layer committed |
| `server` | parsed `Server-Timing` | the backend's `served`, `providerMs`, `requests`, `pacingWaitMs`, `retries`, `retryWaitMs`, if present |
| `strikes` | integer | strikes drawn |
| `outcome` | `'ok' \| 'empty' \| 'unavailable'` | matches the status strip |

The state change is the existing `idle → loading → ok | empty | unavailable` flow, unchanged. Timing observes it and never changes it.
