# Problem Definition: Adding a Singapore location by its place name

- **Slug**: location-name-search
- **Created**: 2026-11-14
- **Inputs used**: research.md, user input (intake.md absent; research was run directly from user input)

## Problem Statement

A person who wants weather for a Singapore place they know by name, such as "Woodlands" or "Sembawang", can't add it without first finding its latitude and longitude somewhere else and typing both numbers in. People know places by name, but the dashboard only accepts coordinates. That gap sits in the first step of using the app, and it applies to any place the user cares about, not only where they are now. (Source: research.md, Users & Demand.)

## Affected Users & Stakeholders

- **Users**: people using the dashboard who want weather for one or more named Singapore places, such as home, work or a family member's town, and don't know the coordinates. Today they look the place up in a map app and copy the numbers across. — [source: research.md, Users & Demand; the coping behaviour is an ASSUMPTION there] [NEEDS CLARIFICATION: how many users there are and how often they add locations. The only demand signal is the owner's request and README roadmap item 3]
- **Stakeholders**:
  - **Project owner/developer**: decides scope and builds the feature. Bound by constitution Principles I–III. — [source: research.md, Data & Constraints]
  - **data.gov.sg (NEA)**: the upstream source of the forecast area names. Any extra load counts against the keyless limit of 6 requests per 10 s. — [source: research.md, Data & Constraints]

## Goals

- A user can add a location by naming a familiar Singapore place, without knowing or looking up its coordinates.
- The added location is the place the user meant. Its weather and label match that place.
- The user can see which place will be added before committing to it. — [source: user input "find and fill lat and long"] [NEEDS CLARIFICATION: whether a review step is required, or adding straight away is acceptable]
- Typing coordinates by hand keeps working for users who have them.
- Existing guarantees still hold: page loads don't call data.gov.sg (Principle I), refreshes are no less reliable, and the location still has to be inside Singapore.

## Non-Goals

- Places outside Singapore.
- Anything other than town names: estates, MRT stations, landmarks, street addresses, postal codes (owner decision, 2026-11-14).
- Third-party geocoding or place-search services.
- Weather finer-grained than the app gives today. The forecast still resolves to the nearest forecast area.
- Detecting the user's current position. That is covered by the separate, approved "use my location" assessment (spec 003).
- Renaming, reordering, deleting or importing saved locations.
- Changing how weather snapshots are fetched, stored or refreshed.
- Amending the constitution, unless shaping shows it can't be avoided and the owner agrees separately.

## Success Metrics

- **Steps to add a named place**: number of user actions, with no outside lookup, to add a place known by name. (baseline: open a separate map app, find the place, copy 2 numbers, type them into 2 fields, submit)
- **Name coverage**: share of a fixed test set of Singapore place names that lead to a saved location. The set is the town list (recommended: the ~47 NEA forecast-area names, including Sengkang, Punggol, Sembawang, Bishan and Woodlands). (baseline: 0%; names aren't accepted today)
- **Correct-place rate**: share of those additions whose displayed area label matches the named place, or the forecast area that contains it. (baseline: n/a)
- **Upstream calls per page load**: data.gov.sg calls made while serving a page load. (baseline: 0; target: still 0)
- **Refresh reliability**: share of create/refresh actions finishing with no 429 response. It must not drop after the change. (baseline: unknown, per nea-data-new-features)
- **Qualitative**: the owner can add "Woodlands" and "Sembawang" without opening another app.

## Cost of Inaction

Users keep looking up coordinates elsewhere and typing them in. Nothing breaks and no data is wrong, so this is friction, not failure. The same friction was judged real but low-severity in the "use my location" assessment. That feature, once built, will remove the friction only for the user's current position. Named places elsewhere (work, family, a weekend spot) will still need coordinates. With demand limited to the owner's own request, the measurable cost is small but not zero, and README roadmap item 3 stays open. (Sources: research.md, Market & Context and Evidence Against.)

## Owner Decisions

- **Scope (owner, 2026-11-14)**: this phase supports **town names only**, for example Sengkang, Punggol, Sembawang, Bishan and Woodlands. Estates, MRT stations, landmarks, street addresses and postal codes are out of scope. So no third-party place-data provider is involved, and the related licence, rate-limit and privacy questions drop out.

## Open Questions

Recommendations below are the researcher's and are **pending owner confirmation**.

1. ~~Which place names?~~ **Resolved**: town names only (see Owner Decisions).
2. [NEEDS CLARIFICATION: Review step or add straight away?] Recommended: **fill the coordinates for review** and have the user press Add, as the request says. The user sees what will be added, and it keeps one create path.
3. [NEEDS CLARIFICATION: Which list counts as "towns", and how is it obtained without breaking Principle I?] Recommended: treat the **NEA two-hour forecast area names** (~47) as the town list, since every saved location is already labelled by one of them. Get them without any new data.gov.sg call on page load. Shaping must confirm that the chosen source needs no constitution amendment.
4. [NEEDS CLARIFICATION: Live check that the area list includes the example towns.] Recommended: check one live `two-hr-forecast` response before specification. Note that the correct spelling is "Punggol", not "Punggole", so matching should tolerate case and small spelling slips.
5. ~~Third-party auth, rate-limit and licence terms~~: **moot**, no third party in this phase.
6. ~~Privacy of typed text sent off-machine~~: **mostly moot**, since search text stays local. Recommended: if it's logged, log only the chosen town name, not raw keystrokes.
7. [NEEDS CLARIFICATION: How does this relate to "use my location" (spec 003)?] Recommended: **keep them as separate features** with no dependency, each with its own spec. Both change the add-location form, so the second one built must fit beside the first.
8. [NEEDS CLARIFICATION: Demand beyond the owner?] Recommended: accept the owner's request plus README roadmap item 3 as the signal, as was done for spec 003, and record it as weak evidence.
