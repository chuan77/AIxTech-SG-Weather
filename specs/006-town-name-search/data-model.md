# Data Model: Town Name Search

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

No database or API schema changes. There's no Drizzle migration, and `backend/src/schema.ts` and the `/api/*` payloads are unchanged.

## Town (new, static reference data)

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Exactly as NEA spells the forecast area ("Ang Mo Kio", "Punggol"). Unique (case-insensitive). |
| `latitude` | number | NEA `label_location.latitude`. Must satisfy 1.1 ≤ lat ≤ 1.5. |
| `longitude` | number | NEA `label_location.longitude`. Must satisfy 103.6 ≤ lon ≤ 104.1. |

- **Set**: the 47 entries in [research.md R1](research.md#r1-town-list-contents-live-check). The pair (`latitude`, `longitude`) is unique across the set (precondition for [R3](research.md#r3-picked-town-is-labelled-as-itself-fr-007)).
- **Lifetime**: bundled with the frontend. It's read-only at runtime and edited by hand only when NEA changes its areas.
- **Relationship**: none stored. A saved location created from a town is an ordinary `Location` at the town's coordinates. Its displayed label comes from the existing nearest-area derivation, which returns that town's name.

## TownMatch (new, transient)

The result of `searchTowns`. It is never stored.

| Field | Type | Meaning |
|-------|------|---------|
| `town` | Town | The matched town. |
| `tier` | 0 \| 1 \| 2 \| 3 | 0 exact, 1 name prefix, 2 word prefix, 3 near match (edit distance ≤ 1). Lower is better. |

Ordered by `tier`, then `town.name` alphabetically, with at most 8 entries (FR-004).

## Add-location form state (extended, component-local)

Existing fields `latitude`, `longitude`, `submitting` and `submitError` are unchanged. New fields:

| Field | Type | Meaning |
|-------|------|---------|
| `townQuery` | string | Text in the town field. |
| `matches` | TownMatch[] | Derived from `townQuery`. Not stored separately when it can be computed. |
| `activeIndex` | number \| -1 | Keyboard-highlighted option. |
| `listOpen` | boolean | Whether the listbox is shown. |
| `pickedTown` | Town \| null | Last picked town while the coordinates still match it. |

### State transitions

```text
idle ──type text──▶ searching (listOpen = query non-empty; matches = searchTowns(query))
searching ──↓/↑──▶ searching (activeIndex moves, wraps)
searching ──Enter on active / click option──▶ picked
          (latitude/longitude = town coords; townQuery = town.name; listOpen = false; log location_town_picked)
searching ──Escape / blur──▶ idle (listOpen = false; text kept)
picked ──type in town field──▶ searching (pickedTown = null)
picked ──edit latitude or longitude──▶ idle (pickedTown = null; townQuery kept)
any ──Cancel──▶ closed (all fields cleared, as today)
picked/idle ──Add──▶ existing create flow (on success the form closes and all fields clear)
```

## Validation (reused, unchanged)

- The server rejects coordinates outside Singapore (lat 1.1–1.5, lon 103.6–104.1) with 422. All 47 towns pass ([R2](research.md#r2-singapore-bounds-check)).
- The server rejects an exact lat/lon duplicate with 409 "Location already exists". A repeat pick of the same town hits this (spec User Story 3, scenario 2).
