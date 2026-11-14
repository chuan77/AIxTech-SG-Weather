# Concept: Find a Singapore town by name when adding a location

- **Slug**: location-name-search
- **Created**: 2026-11-14
- **Recommended option**: Option B, "Town picker from a fixed town list"
- **Inputs used**: problem.md (with the owner's scope decision: town names only), research.md. Open-question recommendations 2–8 in problem.md are still pending owner confirmation, and this concept assumes they are accepted.

## Options

### Option A: Do nothing (rely on manual entry, and "use my location" once built)
- **Sketch**: no change. Users keep typing coordinates. When spec 003 ships, they can add their current position without coordinates. Every other named town still needs a lookup elsewhere.
- **Appetite**: none.
- **Trade-offs**: costs nothing and adds no risk. But it leaves the stated problem unsolved for any town other than where the user is now, the "steps to add a named place" metric doesn't move, and "name coverage" stays at 0%. Research rated the friction low-severity, so this is a real option, not a straw man.
- **Rabbit holes**: none.

### Option B: Town picker from a fixed town list (smallest thing that could work)
- **Sketch**: the add-location form gets a town field next to the latitude/longitude inputs. As the user types ("seng", "punggol", "bishan"), matching town names appear. Matching ignores case and small spelling slips. Picking a town fills both coordinate fields with that town's reference point. The user reviews them and presses Add as today. Manual coordinates still work. The town list is the set of NEA two-hour forecast area names and their reference points, held by the app itself, so searching never calls data.gov.sg or any other service. Because the filled point is the town's own reference point, the saved location's label is the town the user picked.
- **Appetite**: small (days).
- **Trade-offs**:
  - **Wins**: meets every goal in problem.md, with no network calls, no rate-limit exposure, no third party and no privacy surface. Principle I is untouched, since nothing is fetched on page load or search. The existing create path, bounds check and duplicate rejection are reused. Picking the same town twice gives the same point, so the existing exact-match duplicate rule catches it.
  - **Sacrifices**: the list is a snapshot. If NEA adds, renames or moves an area, the app's list falls behind until someone updates it. Some entries aren't residential towns ("Central Water Catchment", "Pulau Tekong", "Southern Islands"). A town that NEA doesn't name separately can't be found.
  - **Risks**: the list contents must be checked once against a live response (problem.md Q4).
- **Rabbit holes**:
  - Building a full fuzzy-search engine. Keep matching to case-insensitive prefix/substring plus a small typo tolerance; no ranking model.
  - Adding aliases and sub-areas ("Punggole", "Admiralty", "Tampines North"). This drifts toward the out-of-scope estate search. Limit to an explicitly short alias list or none.
  - Polishing keyboard and accessibility behaviour of the type-ahead list beyond a standard pattern.
  - Redesigning the whole add-location form to fit spec 003's button at the same time.

### Option C: Town picker from live NEA area data
- **Sketch**: same user experience as B, but the town list comes from NEA's latest forecast data rather than being held by the app. For example, it is captured whenever a location is created or refreshed, or fetched when the user opens the add form.
- **Appetite**: small to medium (days to a couple of weeks). [uncertain: depends on the constitution outcome]
- **Trade-offs**:
  - **Wins**: the list always matches NEA's current areas, so there is no drift.
  - **Sacrifices**: fetching on form open is a new island-wide data.gov.sg call outside the snapshot path. Principle I says this needs its own amendment, as lightning did. Capturing only during create/refresh avoids that, but on a fresh install the list is empty until the first location is added by coordinates, which defeats the goal for first-time users.
  - **Risks**: it adds load against the keyless 6-requests-per-10 s limit, and needs a degraded "town list unavailable" state.
- **Rabbit holes**: a constitution amendment, cache lifetime and storage decisions, empty-list first-run behaviour, and a mix of the two approaches (a held list topped up by live data) that is more complex than either.

## Recommendation

**Option B.** It is the only option that moves every metric in problem.md without touching Principle I or the data.gov.sg rate budget:

- Steps to add a named place drop to typing a few letters, picking and pressing Add.
- Name coverage reaches 100% of the town list.
- The correct-place rate is high because the filled point is the town's own reference point.
- Upstream calls per page load stay at 0, and refresh reliability is unchanged.

Its main weakness is list drift. NEA's forecast-area set is long-lived, so drift is likely rare and cheap to fix by updating the list (ASSUMPTION). Option C buys freshness at the cost of a constitution amendment or a broken first-run experience, which is a poor trade for a small-appetite, low-severity problem. Option A is acceptable if the owner judges the weak demand evidence insufficient, but the owner has asked for this, and B's small appetite makes the bet cheap.

## Out of Scope (for the recommended option)

- Estates, MRT stations, landmarks, street addresses and postal codes (owner decision, 2026-11-14).
- Third-party geocoding or place-search services.
- Places outside Singapore.
- Fetching the town list from data.gov.sg at runtime (that is Option C).
- Adding the location immediately on pick. The user reviews the filled coordinates and presses Add.
- Removing or hiding manual latitude/longitude entry.
- Detecting the user's position (spec 003), and any joint redesign of the form with it.
- Renaming, reordering, deleting or importing saved locations.
- Weather finer-grained than the nearest forecast area.
- Constitution amendments.

## Assumptions to Validate

- The live `two-hr-forecast` area list includes the owner's example towns: Sengkang, Punggol, Sembawang, Bishan and Woodlands. (problem.md Q4; not yet verified)
- A location saved at a town's reference point is labelled as that same town by the existing nearest-area matching. Expected, because the distance to its own point is zero; confirm with a test.
- The reference points all fall inside the existing Singapore bounds check (lat 1.1–1.5, lon 103.6–104.1). Offshore areas such as Pulau Tekong are the ones to check.
- NEA's area set changes rarely enough that a fixed list stays accurate. (ASSUMPTION; the change history is unknown)
- Including non-residential entries ("Central Water Catchment", "Southern Islands") in the list is acceptable to the owner, or they can be left out by a simple rule.
- Holding a fixed copy of NEA area names and reference points in the app is compatible with the data.gov.sg / Singapore Open Data Licence terms. (Unverified; expected to be fine for open data.)
- Case-insensitive matching with small typo tolerance is enough for users to find towns ("punggole" finds Punggol).
- The owner accepts the pending recommendations in problem.md Q2–Q8, especially the review-before-add step and keeping this separate from spec 003.
