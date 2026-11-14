# Contracts: Town Name Search

There are no HTTP contract changes: `POST /api/locations`, `GET /api/locations` and `POST /api/logs` keep their current shapes. This feature exposes two contracts inside the frontend and one UI contract.

## 1. Module `frontend/src/components/towns.ts`

```ts
export interface Town { name: string; latitude: number; longitude: number }
export const TOWNS: readonly Town[]   // 47 NEA two-hour forecast areas, alphabetical
```

Guarantees, enforced by unit tests:
- `TOWNS.length === 47`. Names are unique (case-insensitive) and coordinate pairs are unique.
- Every entry satisfies 1.1 ≤ latitude ≤ 1.5 and 103.6 ≤ longitude ≤ 104.1.
- It includes Woodlands, Sembawang, Sengkang, Punggol and Bishan with the coordinates in [research.md R1](../research.md#r1-town-list-contents-live-check).
- Pure data. No imports with side effects and no network access.

## 2. Module `frontend/src/components/townSearch.ts`

```ts
export interface TownMatch { town: Town; tier: 0 | 1 | 2 | 3 }
export function searchTowns(query: string, towns?: readonly Town[], limit?: number): TownMatch[]
// towns defaults to TOWNS; limit defaults to 8
```

Behaviour (see [research.md R6](../research.md#r6-matching-algorithm-fr-002-fr-003-fr-004)):

| Input | Expected |
|-------|----------|
| `''`, `'   '` | `[]` |
| `'bish'` | first result Bishan (tier 1) |
| `'BISHAN'`, `'  bishan '` | first result Bishan (tier 0) |
| `'angmokio'`, `'ang mo'` | Ang Mo Kio (tier 0 / tier 1) |
| `'water'` | Central Water Catchment, Western Water Catchment (tier 2) |
| `'islands'` | Southern Islands, Western Islands (tier 2), then Jurong Island (tier 3 near match) |
| `'punggole'` | Punggol within the first 3 (tier 3) |
| `'tampnes'` | Tampines within the first 3 (tier 3) |
| `'PUNGGOL'` | Punggol first (tier 0) |
| `'zzz'` | `[]` |
| `'b'` | ≤ 8 results, tiers 1–2 only (no fuzzy below 3 characters) |
| any | length ≤ `limit`; sorted by tier, then name |

Pure function: deterministic, no side effects, and it never throws for any string input.

## 3. UI contract: add-location form (`AddLocationForm.tsx`)

- A **Town** text field appears above the Latitude/Longitude pair, with the placeholder "Search a town, e.g. Sengkang".
- ARIA: the input is `role="combobox"` with `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` → listbox id, and `aria-activedescendant` → active option id. The popup is `role="listbox"` and each option is `role="option"` with `aria-selected`.
- A polite live region says "N towns found" or "No matching town" for non-empty input.
- **Keyboard**:
  - ↓/↑ move the active option, wrapping at the ends.
  - Enter picks the active option and does not submit the form while the list is open with an active option.
  - Escape closes the list.
  - Tab leaves the field normally.
- **Pick**: fills Latitude and Longitude with the town's coordinates, sets the field text to the town name, closes the list, shows "Town: <name>" as the chosen indicator, and logs `location_town_picked` `{ town }`. Nothing is saved until Add.
- **No match**: the "No matching town" text sits under the field, and the coordinate inputs stay enabled.
- **Clearing**: editing either coordinate or retyping in the town field clears the chosen indicator. Cancel clears everything, and so does a successful Add.
- **Theming**: uses only `white`-based Tailwind classes, with the listbox panel matching the form's existing input styles (Principle V). The `apple` theme's existing form appearance is unchanged apart from the added field.
- **Logging**: the search text is never sent to `/api/logs`.
