# Decision: Find a Singapore town by name when adding a location

- **Slug**: location-name-search
- **Decided**: 2026-11-14
- **Verdict**: go
- **Artifacts reviewed**: research.md, problem.md, concept.md (intake.md absent; research was run directly from user input)
- **Owner input**: scope limited to town names only (2026-11-14). "Go with B" (2026-11-14).

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | Real friction, cited: coordinates are the only way to add a location (`AddLocationForm.tsx`), and people know towns by name. Low severity: nothing breaks. |
| Evidence strength | adequate | Feasibility is strongly supported. The town list (`area_metadata`) is already parsed and the create path, bounds check and duplicate rejection already exist. README roadmap item 3 proposes the same thing. Demand is only the owner's stated want. It counts as adequate only because the owner is the decision-maker and has confirmed it, the same judgment call made for use-my-location. This is not new user evidence. |
| Value vs. inaction | adequate | Small appetite (days) against low-severity friction. Unlike "use my location", it helps for any town, not only the user's current position. The cost of inaction is small but not zero. |
| Feasibility / appetite | strong | Option B needs no network calls, no third party and no new endpoint to data.gov.sg. It reuses the existing add flow. |
| Strategic fit | strong | Principle I is untouched (nothing is fetched on page load or search). Principle II holds (no outside calls from the browser). No amendment is needed. It closes README roadmap item 3. |
| Risk posture | adequate | Risks are named with simple mitigations: list drift (rare, cheap to update), non-town entries, bounds for offshore areas, and fuzzy-matching scope creep. The licence for holding a copy of the NEA area list is still unverified (low risk for open data). |

## Verdict & Rationale

**Go, Option B: a town picker from a fixed town list.** The problem is real and the owner has confirmed both the scope (towns only) and the option. Option B moves every success metric without touching the constitution or the data.gov.sg rate budget, at a small appetite. The weak point is still demand evidence. As the scorecard shows, it is rated adequate only on the owner's confirmation, and that is stated here rather than hidden. The remaining unknowns are specification-level checks, not reasons to hold the build.

The owner's "go with B" is taken as accepting the concept's working assumptions, which are the pending recommendations in problem.md Q2–Q8: review before adding, NEA forecast areas as the town list, keeping it separate from spec 003, and logging only the chosen town. The owner should say so during `/speckit-specify` or `/speckit-clarify` if any of these is wrong.

## If go — Handoff to `/speckit-specify`

- **Problem**: A person using the Singapore weather dashboard can't add a town they know by name, such as Woodlands, Sembawang, Sengkang, Punggol or Bishan, without first finding its latitude and longitude elsewhere and typing both in.
- **Chosen approach**: Option B. The add-location form gets a town field. As the user types, matching town names appear, matched case-insensitively with small typo tolerance (for example, "punggole" finds Punggol). Picking a town fills the latitude and longitude fields with that town's reference point. The user reviews them and presses Add through the existing create flow. Manual coordinate entry stays. The town list is the set of NEA two-hour forecast area names and reference points, held by the app. Searching makes no call to data.gov.sg or any other service.
- **In scope**:
  - The town field and its matching list.
  - Filling the coordinates on pick.
  - A clear "no matching town" state.
  - The existing create path, bounds check and duplicate rejection, reused.
  - Logging only the chosen town name, if anything is logged.
- **Out of scope**:
  - Estates, MRT stations, landmarks, addresses and postal codes.
  - Third-party geocoding.
  - Places outside Singapore.
  - Fetching the town list from data.gov.sg at runtime.
  - Adding immediately on pick.
  - Removing manual entry.
  - "Use my location" (spec 003), and any joint form redesign with it.
  - Renaming, reordering, deleting or importing locations.
  - Weather finer-grained than the forecast area.
  - Constitution changes.
- **Success metrics** (no numeric targets set):
  - Steps to add a named town: baseline is an outside lookup plus two typed numbers.
  - Name coverage: share of the town list that can be found and added, from a 0% baseline. The target is all list entries, including the owner's five examples.
  - Correct-place rate: the saved location's label equals the picked town.
  - data.gov.sg calls per page load stay at 0.
  - Refresh reliability does not drop.
- **Carried-forward open questions**:
  - [NEEDS CLARIFICATION: Verify against one live `two-hr-forecast` response that the area list includes Sengkang, Punggol, Sembawang, Bishan and Woodlands, and record the exact list used.]
  - [NEEDS CLARIFICATION: Should non-residential areas ("Central Water Catchment", "Western Water Catchment", "Southern Islands", "Pulau Tekong", and similar) be in the list or left out?]
  - [NEEDS CLARIFICATION: Do all reference points pass the existing Singapore bounds check (lat 1.1–1.5, lon 103.6–104.1)? Check the offshore areas.]
  - [NEEDS CLARIFICATION: Confirm with a test that a location saved at a town's reference point is labelled as that same town.]
  - [NEEDS CLARIFICATION: How much typo tolerance, and is a short alias list allowed or none? Keep it small to avoid scope creep.]
  - [NEEDS CLARIFICATION: What happens when a picked town is already saved: the existing duplicate message, or select the existing entry?]
  - [NEEDS CLARIFICATION: Confirm that holding a fixed copy of the NEA area list is compatible with the Singapore Open Data Licence.]
  - Constraint to respect: frontend tests cover pure `.ts` modules only, so the matching logic must sit in a pure module to be testable.
