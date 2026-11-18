# Data Model: Private Saved Locations per Visitor

The decisions behind this model are in [research.md](research.md) (R3 to R7, R9). All schema changes go in `backend/src/schema.ts` and ship as one generated Drizzle migration (`npm run db:generate`).

## Visitor (new table `visitors`)

| Field | Type | Rules |
|---|---|---|
| `id` | integer, primary key, autoincrement | Internal only. Never sent to the browser. |
| `key_hash` | text, not null, **unique** | Lowercase hex SHA-256 of the 43-character browser key. The plaintext key is never stored. |
| `created_at` | text, not null | ISO `YYYY-MM-DDTHH:MM:SS`, the same format as `locations.created_at`. |
| `last_used_at` | text, not null | Same format. Set when the row is created. Bumped by a "use" when more than 1 hour old (R6). |

- **Created**: on the first successful `POST /api/locations` for a key, or by the owner's claim script. Never created by a read.
- **Use** (restarts the 90 days): any `/api/locations*` request carrying this key: list, get, create, refresh, delete.
- **Removed**: when `last_used_at` is more than 90 days ago, by the retention sweep. Its locations are deleted in the same batch, locations first.

## Saved location (table `locations`, changed)

| Change | Detail |
|---|---|
| **Add** `visitor_id` | integer, nullable, indexed through the unique index below. NULL means a pre-feature row that hasn't been claimed. No FK constraint (R4). |
| **Drop** index `locations_latitude_longitude_unique` | It enforced one place per coordinate across all visitors. |
| **Add** unique index `locations_visitor_latitude_longitude_unique` on `(visitor_id, latitude, longitude)` | Duplicate coordinates are refused within one visitor's list only (FR-005). NULL `visitor_id` rows don't collide with each other or with anyone's list. |

- All other columns, including the weather snapshot columns, are unchanged.
- `LocationRecord` (the API shape) is unchanged. `visitor_id` is never exposed.

## Visibility rules (all reads and writes)

| Operation | Rows it may touch |
|---|---|
| List | `visitor_id = <requester's visitor id>`. If there's no valid key or no visitor row, nothing. |
| Get, refresh, delete by id | Only if the row's `visitor_id` matches the requester's. Otherwise "not found". |
| Create | Inserted with the requester's `visitor_id`. The duplicate check and the unique index are scoped to that visitor. |
| Retention sweep | Visitors past 90 days, and their rows. Never rows with `visitor_id IS NULL`. |
| Claim script | Rows with `visitor_id IS NULL` only, moved to one visitor, skipping coordinate clashes. |

## State transitions

```text
Saved location:
  [pre-feature, visitor_id NULL] --claim script--> [owned by owner's visitor]
  [none] --create with key--> [owned by visitor] --delete--> [gone]
                                       \--visitor unused > 90 days--> [gone, swept]

Visitor:
  [none] --first create / claim--> [active] --use--> [active, last_used_at bumped]
                                        \--unused > 90 days--> [gone, swept with its locations]
```

## Browser-side value (not in the database)

| Key | Where | Format | Notes |
|---|---|---|---|
| `weather-starter.visitor.key` | `localStorage` (in-memory fallback, R8) | 43-character base64url, from 32 random bytes | Created on first need. Sent only as the `X-Visitor-Key` header. Never logged, never put in a URL. |
