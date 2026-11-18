# Contract: Locations API scoped per visitor

This changes the existing `/api/locations*` routes in `backend/src/routes/locations.ts`. The response bodies (`LocationRecord`, `{ locations: LocationRecord[] }`) are **unchanged**. Only who can see what changes.

## Request header

| Header | Required | Format | Invalid or missing |
|---|---|---|---|
| `X-Visitor-Key` | On every `/api/locations*` call from the app | `^[A-Za-z0-9_-]{43}$` | Treated as "no visitor" (see the table below). Never echoed, logged or reflected in an error. |

The server sends no CORS headers. A cross-origin page that tries to send `X-Visitor-Key` fails its preflight, so the request is never made (FR-009).

## Behaviour by route

| Route | Valid key, owns the row / known visitor | Valid key, not the owner / unknown visitor | No key or malformed key |
|---|---|---|---|
| `GET /api/locations` | 200, that visitor's locations, newest first (current order) | 200 `{ "locations": [] }` | 200 `{ "locations": [] }` |
| `POST /api/locations` | 201 / 409 / 422, as today. The duplicate check is within this visitor only. Creates the visitor if new. | (same; a new visitor is created) | **400** `{ "detail": "A visitor key is required" }` |
| `GET /api/locations/:id` | 200 | 404 `Location not found` | 404 `Location not found` |
| `POST /api/locations/:id/refresh` | 200 / 502, as today | 404 `Location not found` | 404 `Location not found` |
| `DELETE /api/locations/:id` | 204 | 404 `Location not found` | 404 `Location not found` |

- The 404 for "someone else's row" has exactly the same status and body as for a missing id (FR-004).
- A valid key on any of these routes counts as "use" for retention (data-model, R6).
- The per-device limit on `POST /api/locations` and `POST .../refresh` is unchanged (FR-014). It runs before the route, so a 429 doesn't reveal anything about ownership.

## Unchanged

- `POST /api/lightning/refresh`, `POST /api/rain/refresh`, `POST /api/logs` and `GET /health` ignore `X-Visitor-Key`.
- `POST /api/logs` metadata must never contain the key. `logInteraction` doesn't send the header.

## Owner claim script (not an HTTP route)

`npm run claim-legacy -- <visitorKey> [--remote]`

- The command never loads `.env`.
- With `TURSO_*` exported, it refuses unless `--remote` is given.
- With `--remote`, it refuses unless `TURSO_*` is exported.
- Both checks run before any database is opened. The 2026-11-17 incident showed why: a test run that loaded `.env` reached production.

| Input | Effect | Output (stdout) |
|---|---|---|
| A valid 43-character key, with database settings in the environment | Moves every `visitor_id IS NULL` location to this visitor, skipping coordinates already in the visitor's list | `claimed <n>, skipped <m> (already in list)` |
| Run again | No NULL rows are left | `claimed 0, skipped 0` |
| A malformed key | Nothing is changed. Exits with status 1. | `visitor key must be 43 base64url characters` |
| Turso exported without `--remote`, or `--remote` without Turso | No database is opened. Exits with status 1. | A one-line refusal |

It never prints the key, its hash, coordinates or the database URL.
