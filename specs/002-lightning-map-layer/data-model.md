# Data Model: Lightning Strikes on the Map

No database tables or migrations. All entities are transient (server memory) or per-browser (localStorage).

## LightningStrike

| Field | Type | Rules |
|---|---|---|
| `id` | string | `"{datetime}\|{latitude}\|{longitude}"`; used for de-duplication and React keys |
| `latitude` | number | finite, -90 to 90 (parsed from the provider's string) |
| `longitude` | number | finite, -180 to 180 |
| `occurred_at` | string (ISO 8601) | parseable; within `[now − 60 min, now + 5 min]` |
| `type` | string | provider code (for example `"C"`), or `"unknown"` |
| `label` | string | provider `text`, else `"Lightning"` |

Not associated with any saved `Location`. Invalid strikes are dropped individually (FR-010).

## LightningObservation (the observation window)

| Field | Type | Rules |
|---|---|---|
| `strikes` | `LightningStrike[]` | newest first; only strikes inside the 60-minute window; may be empty |
| `window_minutes` | number | always 60 |
| `fetched_at` | string (ISO) | when the server last obtained provider data successfully |
| `provider_updated_at` | string \| null | newest `updatedTimestamp` from the provider, if present |
| `stale` | boolean | true when the response is a cached window served because a refresh failed |

Shared by all viewers; held in a single in-memory slot on the server (2-minute TTL), and in the frontend store as the last received value.

## LightningDisplayState (frontend only, derived)

`status` is one of:

| Status | Condition |
|---|---|
| `idle` | enabled, no observation yet, no request made; shows a "Show latest lightning" button that triggers a refresh |
| `loading` | a request is in flight |
| `ok` | observation has at least one strike |
| `empty` | observation received with zero strikes |
| `unavailable` | last request failed; the previous observation, if any, is retained and its strikes stay drawn (still hiding any older than 60 minutes) with that observation's last-updated time |

Layer off means no markers and no status strip, regardless of status.

## LightningDisplayPreference

`localStorage["weather-starter.lightning.enabled"]` is `"true"` or `"false"`. Missing, unreadable or invalid means on (default). Never sent to the server.

## Age to style (pure function)

`ageMinutes = (now − occurred_at) / 60 000`, clamped to `[0, 60]`. `opacity = 1 − 0.85 × (age / 60)`; `radius = 8 − 3 × (age / 60)`. A strike with age above 60 is excluded before styling. Recomputed whenever the store's observation or a 30-second UI tick changes, so strikes keep fading without a network call and drop off at 60 minutes on the next render.

## State transitions

```
idle ──turn on / refresh──▶ loading ──success, n>0──▶ ok
                              │       └─success, n=0──▶ empty
                              └─failure───────────────▶ unavailable
ok|empty|unavailable ──refresh (data ≥ 2 min old)──▶ loading
ok|empty|unavailable ──turn on / refresh (data < 2 min old)──▶ unchanged (no request)
```
