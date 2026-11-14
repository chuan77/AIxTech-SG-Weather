# Research: Town Name Search

**Feature**: [spec.md](spec.md) | **Date**: 2026-11-14

Planning started with no NEEDS CLARIFICATION markers left in Technical Context. The items below settle the checks that the spec's Assumptions section handed to planning, plus the design choices that follow from them.

## R1. Town list contents (live check)

- **Decision**: the town list is the 47 `area_metadata` entries of the NEA two-hour forecast. They were captured live on 2026-11-14 (`update_timestamp` 2026-11-14T14:10:59+08:00) from `GET https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast` (keyless, `code: 0`). Names and coordinates are copied exactly as NEA gives them.
- **Result**: all five owner examples are present: Woodlands (1.432, 103.786528), Sembawang (1.445, 103.818495), Sengkang (1.384, 103.891443), Punggol (1.401, 103.904) and Bishan (1.350772, 103.839).
- **Full list** (name, lat, lon): Ang Mo Kio 1.375 103.839 · Bedok 1.321 103.924 · Bishan 1.350772 103.839 · Boon Lay 1.304 103.701 · Bukit Batok 1.353 103.754 · Bukit Merah 1.277 103.819 · Bukit Panjang 1.362 103.77195 · Bukit Timah 1.325 103.791 · Central Water Catchment 1.38 103.805 · Changi 1.357 103.987 · Choa Chu Kang 1.377 103.745 · City 1.292 103.844 · Clementi 1.315 103.76 · Geylang 1.318 103.884 · Hougang 1.361218 103.886 · Jalan Bahar 1.347 103.67 · Jurong East 1.326 103.737 · Jurong Island 1.266 103.699 · Jurong West 1.34039 103.705 · Kallang 1.312 103.862 · Lim Chu Kang 1.423 103.717332 · Mandai 1.419 103.812 · Marine Parade 1.297 103.891 · Novena 1.327 103.826 · Pasir Ris 1.37 103.948 · Paya Lebar 1.358 103.914 · Pioneer 1.315 103.675 · Pulau Tekong 1.403 104.053 · Pulau Ubin 1.404 103.96 · Punggol 1.401 103.904 · Queenstown 1.291 103.78576 · Seletar 1.404 103.869 · Sembawang 1.445 103.818495 · Sengkang 1.384 103.891443 · Sentosa 1.243 103.832 · Serangoon 1.357 103.865 · Southern Islands 1.208 103.842 · Sungei Kadut 1.413 103.756 · Tampines 1.345 103.944 · Tanglin 1.308 103.813 · Tengah 1.374 103.715 · Toa Payoh 1.334304 103.856327 · Tuas 1.294947 103.635 · Western Islands 1.205926 103.746 · Western Water Catchment 1.405 103.689 · Woodlands 1.432 103.786528 · Yishun 1.418 103.839
- **Rationale**: this is the same source the server uses to label every snapshot, so the town the user picks and the label they see come from one list.
- **Alternatives considered**: URA planning areas (55) or HDB towns (26). Both are rejected because their names don't line up 1:1 with the forecast labels, which would break FR-007.

## R2. Singapore bounds check

- **Decision**: no change to the bounds check (lat 1.1–1.5, lon 103.6–104.1).
- **Result**: all 47 reference points pass, checked by script against the live response. The extremes are Western Islands (lat 1.205926), Sembawang (lat 1.445), Tuas (lon 103.635) and Pulau Tekong (lon 104.053).
- **Guard**: a unit test asserts every list entry is inside the bounds, so a future list edit can't add a town the server would reject.

## R3. Picked town is labelled as itself (FR-007)

- **Finding**: `nearestAreaName` in `backend/src/weather.ts` picks the area with the smallest squared lat/lon distance. At a town's own reference point that distance is 0. No two of the 47 points are identical (Bishan and Ang Mo Kio share a longitude but not a latitude), so the result is unique. The snapshot label (`weather.area`) is that name, and `SidebarCard`/`Hero` show it.
- **Decision**: no backend change. Add a backend test in `backend/src/weather.test.ts`: a two-hour forecast payload with several real areas and a location at Bishan's exact point gets `area: 'Bishan'`. A frontend unit test asserts the list has unique coordinates, which keeps the "distance 0 is unique" precondition true.
- **Alternatives considered**: sending the town name to the server and storing it as the label. Rejected because it adds a schema and API change for no gain, since the existing derivation already gives the same name.

## R4. Where the list lives (Principles I and II)

- **Decision**: a static TypeScript module in the frontend (`frontend/src/components/towns.ts`). It is bundled with the app and needs no endpoint.
- **Rationale**: no data.gov.sg call on page load or search (FR-012, SC-006), and no new `/api/*` route (so no new Supertest coverage is needed under Principle VI). It's also available offline and on first run, before any location exists.
- **Alternatives considered**:
  - A backend `GET /api/towns` serving the same static list. Rejected: it adds a route, tests and a network round trip just to read a constant.
  - A list captured from live responses. Rejected: this is concept Option C, which leaves the list empty on first run.
- **Drift**: if NEA changes its areas, the list is updated by hand. The source and capture date are recorded in a comment at the top of the module.

## R5. Licence

- **Decision**: keep the fixed copy, with an attribution comment in `towns.ts`: "Contains information from the NEA two-hour weather forecast accessed on 2026-11-14 from data.gov.sg, made available under the Singapore Open Data Licence v1.0."
- **Rationale**: data.gov.sg datasets are published under the Singapore Open Data Licence, which allows copying and redistribution with attribution. Confidence is medium: this is from general knowledge of the licence and the terms page wasn't re-read in this session. The app already displays and stores this same data in every snapshot.

## R6. Matching algorithm (FR-002, FR-003, FR-004)

- **Decision**: a pure function `searchTowns(query, towns, limit = 8)`.
  1. **Normalise**: lower-case, trim, and collapse whitespace. A *compact* form also has spaces removed ("angmokio").
  2. **Empty query** after normalising → `[]`.
  3. **Score each town** and keep the best (lowest) tier:
     - Tier 0: exact name match, normal or compact.
     - Tier 1: the name starts with the query, normal or compact.
     - Tier 2: any word of the name starts with the query ("water" → Central Water Catchment, Western Water Catchment).
     - Tier 3 (near match, only for queries of 3+ characters): the edit distance between the compact query and some prefix of the compact name, of length query±1, is ≤ 1. Each word is checked the same way. This catches "punggole" → Punggol (extra letter), "tampnes" → Tampines (missing letter) and "sembawnag"-type swaps, which count as distance 2 and so do *not* match.
  4. **Sort** by tier, then alphabetically, and cut to `limit`.
- **Rationale**: this is predictable, has no dependency, and runs in well under 1 ms for 47 items, which meets SC-005. The 3-character floor stops a 1–2 letter query from fuzzily matching most of the list.
- **Alternatives considered**:
  - A fuzzy-search library such as Fuse.js. Rejected: a new dependency for 47 strings, and its scoring is harder to explain or test against SC-004.
  - Damerau (transposition-aware) distance. Deferred: the spec only asks for one wrong, missing or extra letter.

## R7. Combobox interaction and accessibility (FR-014)

- **Decision**: follow the WAI-ARIA 1.2 combobox pattern with a listbox popup:
  - The input has `role="combobox"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`.
  - The list has `role="listbox"`, with options as `role="option"` and `aria-selected`.
  - A polite live region announces the match count or "No matching town".
  - **Keys**: ↓/↑ move the active option, Enter picks it, and Escape closes the list. While the list is open, Enter on an active option MUST NOT submit the form.
- **Rationale**: this is the standard pattern for a type-ahead list, and it needs no library.
- **Alternatives considered**: a native `<datalist>`. Rejected: it can't do custom matching (fuzzy tier), styling for the themes is inconsistent across browsers, and there is no "no match" state.

## R8. Logging (FR-015)

- **Decision**: when a town is picked, log `location_town_picked` with `{ town: <NEA name> }`. The search text is never logged. The existing `location_create_submitted` event keeps logging the coordinates it sends. For a picked town these are a public area reference point, not the user's position, so no privacy change is needed.
- **Alternatives considered**: adding `town` to the create payload so it shows in create logs. Rejected because it changes the API payload for logging alone.

## R9. Picked-town state (FR-010)

- **Decision**: the form keeps a `pickedTown` value. It is set on pick and cleared when the user types in the town field again, edits either coordinate, cancels or adds. The "chosen town" indicator shows only while `pickedTown` is set and both fields still equal its coordinates.
- **Rationale**: the form can never show a town that doesn't match the coordinates.
