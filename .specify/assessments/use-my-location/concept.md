# Concept: "Use my location" in the add-location flow

- **Slug**: use-my-location
- **Created**: 2026-11-12
- **Recommended option**: B — Browser location button, saved at the user's position

## Options

### Option A — Do nothing
- **Sketch**: Keep typing latitude/longitude into the add form. Optionally add a hint on where to find coordinates.
- **Appetite**: none (small if the hint is added)
- **Trade-offs**: Costs nothing and adds no privacy or permission surface. It leaves the friction in place, which research.md shows is real but low-severity and with no recorded demand beyond the submitter. It doesn't deliver the "where I am" goal.
- **Rabbit holes**: none.

### Option B — Browser location button, saved at the user's position (smallest thing that could work)
- **Sketch**: The add form gains a "Use my location" button. On click the browser asks the user for permission and returns their position; the app adds a saved location at that position, exactly as if they had typed the coordinates. The existing add flow does the rest: it checks the position is within Singapore, refreshes the weather snapshot, and shows the nearest forecast area as the location's label. Denied permission, unavailable position, timeout and outside-Singapore are shown as plain messages, and the user can still type coordinates.
- **Appetite**: small (days). The add path, bounds check and nearest-area derivation already exist (research.md, Prior Art).
- **Trade-offs**:
  - Wins: reuses the existing create path; no new provider calls and no new endpoint, so it is least likely to touch constitution Principle I. Meets the core goal of weather for "where I am" without knowing coordinates. Confirmed workable on plain-HTTP `*.localhost` in Chrome.
  - Sacrifices: the saved entry is the user's exact, possibly coarse, position, not a canonical forecast-area point. Because dedupe is exact-match only, repeated use can create near-duplicate entries. Stores precise coordinates (privacy). Frontend tests are limited to pure modules, so the click and permission flow itself can't be unit-tested.
- **Rabbit holes**: duplicate handling (what counts as "same place"); error and permission UX for each failure case; coarse desktop accuracy picking the wrong neighbouring area; Firefox/Safari differences; whether coordinates reach `/api/logs`.

### Option C — Snap to the forecast area (matches the original wording)
- **Sketch**: Same button and permission flow, but the saved location is the nearest forecast area itself, not the user's position. Using it twice from nearby places lands on the same entry, so the saved list holds areas, not raw positions. The area name is the primary label.
- **Appetite**: medium (weeks). The app today stores coordinates and only derives the area afterwards, so this changes what a "location" means and where the area list is read.
- **Trade-offs**:
  - Wins: matches the idea as worded ("finds the nearest forecast area, adds it automatically"); meaningful duplicate detection; coarse accuracy matters less because the result is area-level anyway; less precise location data is stored.
  - Sacrifices: more change to the data model and the add flow. It likely needs the area list made available to the add path, which must be squared with constitution Principle I (no provider calls during a page load) and may need an amendment. It also makes manual coordinate entry and area-snapped entries two different kinds of location.
- **Rabbit holes**: where the area list comes from and how fresh it is; reconciling coordinate-based and area-based locations; a distance cutoff near Singapore's edges; migration or display of existing saved locations; possible constitution amendment.

## Owner Decision

2026-11-12: the user chose **Option B** ("go for option B"). This confirms B over C, and the user directing the build is taken as the owner's stated demand. Near-duplicate handling was not answered and carries into specification.

## Recommendation

Proceed with **Option B**, and decide on Option C's snapping as a deliberate follow-up if duplicate clutter or accuracy proves a problem.

Option B is the smallest change that meets the clarified goal: the person using the app gets weather for where they are, without typing coordinates. It builds on code that already exists, needs no new data source, and stays clear of the constitution's main constraints. Option C matches the original wording better but changes what a location means, so its extra weeks are hard to justify while demand is unproven and low-severity (problem.md, Cost of Inaction).

Caveat for `/speckit-assess-decide`: demand evidence is thin, so "do nothing" (Option A) remains a legitimate outcome. If the owner wants the saved entry to be the forecast area itself, Option C is the honest fit and the decision should say so.

## Out of Scope (for the recommended option)

- Continuous or background location tracking, or auto-refresh as the user moves.
- Users outside Singapore, or any non-Singapore weather source.
- HTTPS setup, LAN-IP access, or other non-localhost origins.
- Reordering, renaming, import/export of saved locations.
- Snapping the saved entry to a forecast area's canonical point (Option C).
- Changes to constitution principles.

## Assumptions to Validate

- Chrome's behaviour on `weather-starter.localhost` also holds in Firefox and Safari (research.md: only Chrome verified).
- A real position request returns accuracy good enough to pick the right area for the typical user; desktop IP/Wi-Fi lookup may not.
- Saving the exact position, with possible near-duplicates, is acceptable (problem.md Open Question on exact vs. canonical position).
- Storing precise coordinates and any logging of them is acceptable to the owner.
- A distinct near-duplicate entry is acceptable for a first version, or a simple duplicate rule can be agreed in specification.
- The existing Singapore bounds check (lat 1.1–1.5, lon 103.6–104.1) is an adequate "outside Singapore" rule, even though it is coarse.
- There is enough real demand to justify even a small build (not yet evidenced).
