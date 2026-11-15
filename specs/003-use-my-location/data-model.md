# Data Model: Use My Location

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

No persisted entity changes. A geolocated location is an ordinary **Saved location** (existing table: `latitude`, `longitude`, snapshot with `area`). The entities below exist only in the browser for one attempt.

## DetectedPosition

The browser's answer to one press. It is never stored on its own. It either becomes a saved location's coordinates or is dropped.

| Field | Type | Notes |
|---|---|---|
| `latitude` | number | From `GeolocationCoordinates.latitude`, unrounded |
| `longitude` | number | From `GeolocationCoordinates.longitude`, unrounded |
| `accuracyM` | number | Radius in metres. Shown nowhere in v1; available to the manual accuracy check (R3) |

## GeolocateFailure

The adapter's rejection, normalised from `GeolocationPositionError.code`.

| `reason` | Source |
|---|---|
| `denied` | code 1 `PERMISSION_DENIED` |
| `unavailable` | code 2 `POSITION_UNAVAILABLE`, or `navigator.geolocation` missing |
| `timeout` | code 3 `TIMEOUT` (10 s) |

## GeolocateOutcome

The result of classifying a position against the saved list (pure, `classifyPosition`).

| `kind` | Extra fields | Rule |
|---|---|---|
| `outside` | none | Outside lat 1.1–1.5, lon 103.6–104.1 (same box as the server). Checked first |
| `existing` | `location: Location` | Closest saved location within 100 m (`savedNear(…, 0.1)`) |
| `new` | `latitude`, `longitude` | Otherwise. Passed unchanged to `create` |

## Attempt state (component-local, `UseMyLocation`)

```text
idle ──press──▶ locating ──position──▶ classify ─┬─ outside  ──▶ message(outside)
  ▲                 │                             ├─ existing ──▶ select(id) ▶ message(already saved)
  │                 └─failure(reason)──▶ message(reason)        └─ new ──▶ adding ─┬─ ok   ──▶ idle (new location selected)
  │                                                                                └─ fail ──▶ message(create failed)
  └──────────── dismiss / next press / add form opens clears any message ─────────────────────────
```

- `locating` and `adding` disable the button (`aria-busy`). A press in either state is ignored (FR-004).
- Unmounting bumps the attempt id, so late results are dropped (R9).
- `message` holds `{ tone: 'info' | 'error', text }`: info for "already saved", error for the rest.

## Validation rules (from requirements)

- FR-006: bounds check before any request. The server's 422 remains the backstop.
- FR-007 / SC-004: 100 m great-circle radius, closest wins, an exact match counts.
- FR-009 / SC-006: log payloads for this source never contain `latitude`, `longitude` or any rounded form of them.
