# Problem Definition: Adding "where I am" as a saved location

- **Slug**: use-my-location
- **Created**: 2026-11-12
- **Inputs used**: intake.md, research.md

## Problem Statement

A person who wants weather for where they currently are in Singapore must find and type their own latitude and longitude, because that is the only way to add a location today. The effort and required knowledge sit in the very first step of using the dashboard. (Source: research.md, Users & Demand.)

Clarification (user, 2026-11-12): "location" means the position of the person accessing the weather app, as supplied by their web browser. Research now shows this is feasible in Chrome on plain-HTTP `*.localhost` (see research.md, Feasibility).

The original idea was framed as a solution ("a button that detects position…"). The underlying need is to get the weather for one's current place without knowing coordinates. How much that need matters is unproven (see Open Questions).

## Affected Users & Stakeholders

- **Users**: People viewing the dashboard who want weather for their current position and don't know their coordinates. Their number and frequency are unknown. — [NEEDS CLARIFICATION: no demand signal recorded; research.md rates it low confidence]
- **Stakeholders**:
  - Repo owner / idea submitter — raised the idea and decides priority. [NEEDS CLARIFICATION: confirm]
  - Developers working in the dashboard — bound by the project constitution (Principles I, II, IV), which constrains how data may be fetched and tested.

## Goals

- A user can get weather for their current whereabouts without knowing or typing coordinates.
- The result is a location the user can recognise as "where I am" (the nearest Singapore forecast area), not a bare coordinate pair.
- Repeating the action does not clutter the saved list with near-identical entries. [NEEDS CLARIFICATION: confirm this is a goal; research.md notes dedupe is exact-match only]
- Works in the developer's local environment (plain HTTP on localhost) without requiring HTTPS setup. [NEEDS CLARIFICATION: research.md flags that the dev hostname `weather-starter.localhost:1355` is not bare `localhost`, and secure-context treatment is unverified]

## Non-Goals

- Continuous or background location tracking, or automatic refresh as the user moves. [ASSUMPTION: implied by "button", not stated by the submitter]
- Supporting users outside Singapore, or non-Singapore weather providers (the app is Singapore-only).
- Reordering, renaming, or bulk import/export of locations (already out of scope in spec 001).
- Access over HTTPS or from non-localhost origins such as a LAN IP. [NEEDS CLARIFICATION: stated requirement covers localhost only; confirm others are excluded]
- Any solution design: where the button lives, which API is used, and where matching runs belong to the shape stage.

## Success Metrics

- Task effort: the number of steps and the knowledge needed to add the current location, compared with typing coordinates. (Baseline: today requires two typed numeric fields and prior knowledge of coordinates; target not set.) Qualitative.
- Completion: share of "use my location" attempts that end in a saved, refreshed location rather than an error or abandonment. (Baseline: n/a. No usage logging exists for this; `POST /api/logs` records interactions, but whether it could measure this is unknown.) [NEEDS CLARIFICATION]
- Correctness: the saved location's displayed area matches the user's actual nearest forecast area. (Baseline: n/a.) Verifiable by test with fixed coordinates.
- Clutter: number of near-duplicate locations created by repeated use. (Baseline: unbounded, since dedupe is exact-coordinate only.)
- No target values are set. [NEEDS CLARIFICATION: owner to say what "worth it" means]

## Cost of Inaction

Users keep typing or pasting coordinates. This is friction, not a failure: nothing breaks, no data is wrong, and no compliance or reliability risk is involved. Because no demand evidence exists, the real cost is unknown and may be low. For a Singapore-only app of this size, a typed or pasted coordinate may serve nearly as well (research.md, Evidence Against).

## Open Questions

- [NEEDS CLARIFICATION: Is there demand beyond the submitter, and what triggered the idea? (intake and research)]
- [NEEDS CLARIFICATION: What should "adds the nearest forecast area" mean for the saved entry: the user's exact position or the area's canonical position? The current model stores coordinates and derives the area. (research.md)]
- [NEEDS CLARIFICATION: Which origins must work, in which browsers? `weather-starter.localhost:1355` and LAN access are unverified. (research.md)]
- [NEEDS CLARIFICATION: How should the experience behave if permission is denied, the position is unavailable, or the user is outside Singapore or far from any area? (intake)]
- [NEEDS CLARIFICATION: Privacy expectations for storing and logging precise coordinates. (research.md)]
- [NEEDS CLARIFICATION: How does this compare in priority with other work, e.g. the in-progress lightning map layer? (intake)]
- [NEEDS CLARIFICATION: Which success targets would make this worth building? (above)]
