# Contract: Locations API

Relative paths under `/api`. Errors are JSON `{ "detail": string }`. Shapes match `LocationRecord` in `backend/src/db.ts` and `Location` in `frontend/src/types.ts`.

`Location`: `{ id, latitude, longitude, created_at, weather: WeatherSnapshot }` (see [data-model.md](../data-model.md)).

## GET /locations

Reads stored data only; never calls the weather provider.

- **200**: `{ "locations": Location[] }`, newest first (`created_at` desc, then `id` desc). Empty list when none are saved.
- **500**: storage failure; no stored data is modified.

## POST /locations

Body: `{ "latitude": number, "longitude": number }`.

- **201**: `Location`. If the first weather refresh succeeded, `weather` is the fresh snapshot. If it failed for any reason, the location is still saved and returned with the default snapshot (`condition: "Not refreshed"`) (FR-011).
- **409**: `{ "detail": "Location already exists" }` for an existing coordinate pair, including a concurrent duplicate (FR-002).
- **422**: non-numeric/missing coordinates, or coordinates outside lat 1.1-1.5 / lon 103.6-104.1 (FR-003). Nothing is saved.
- **500**: save failed; nothing is saved (single-statement insert).

## GET /locations/:locationId

- **200**: `Location`. **404**: not found.

## DELETE /locations/:locationId

- **204**: row and snapshot removed permanently (FR-009). **404**: not found or invalid id.

## POST /locations/:locationId/refresh

Explicit refresh; replaces the stored snapshot.

- **200**: updated `Location`. **404**: not found. **502**: weather provider failed; stored snapshot unchanged.

## UI contract

- On load, the sidebar lists `locations` in the returned order and selects the first (FR-005–007); empty list shows the add-location empty state (FR-008).
- A failed load or save shows the error message in the sidebar and leaves the existing list untouched (FR-010).
