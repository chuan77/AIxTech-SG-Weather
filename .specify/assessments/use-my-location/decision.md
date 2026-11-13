# Decision: "Use my location" in the add-location flow

- **Slug**: use-my-location
- **Decided**: 2026-11-12
- **Verdict**: go
- **Artifacts reviewed**: intake.md, research.md, problem.md, concept.md
- **History**: first pass was `needs-clarification` (evidence weak, value unknown, B-vs-C unconfirmed). Re-decided the same day after the owner said "go for option B".

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | Real friction, cited: the only way to add a location is typing latitude/longitude. Low severity. |
| Evidence strength | adequate | Feasibility is strongly supported (Chrome on plain-HTTP `*.localhost` observed; existing code read). Demand is still only the owner's own stated want and no usage data exists, so it was upgraded from weak only because the owner is the decision-maker and has now confirmed it. This is a judgment call, not new evidence. |
| Value vs. inaction | adequate | Small appetite (days) against low-severity friction. The owner has accepted that trade. No success targets set. |
| Feasibility / appetite | strong | Option B reuses the existing create path, bounds check and nearest-area derivation. |
| Strategic fit | adequate | Stays within constitution Principles I, II and IV; no amendment needed. |
| Risk posture | adequate | Risks identified (duplicates, coarse accuracy, permission denial, other browsers, coordinate privacy); mitigations to be settled in specification. |

## Verdict & Rationale

**Go, Option B.** The owner confirmed the option and the build. The remaining weakness is demand evidence, which is acknowledged above rather than glossed over. It is outweighed by the small appetite and by feasibility being verified. Open items are specification-level and don't block the handoff.

## If go — Handoff to `/speckit-specify`

- **Problem**: A person using the Singapore weather dashboard must type their own latitude and longitude to add where they are. The only way to get weather for their current position is to know their coordinates.
- **Chosen approach**: Option B. A "Use my location" button in the add-location flow asks the browser for the user's position (with permission) and adds a saved location at that position through the existing create flow. The nearest forecast area appears as the location's label. It works on plain-HTTP localhost.
- **In scope**: the button and permission flow; adding the position via the existing create path; clear messages for permission denied, position unavailable, timeout and outside Singapore; manual coordinate entry stays available.
- **Out of scope**: continuous tracking or auto-refresh; users outside Singapore; HTTPS setup, LAN-IP or other non-localhost origins; snapping to a forecast area's canonical point (Option C); reordering, renaming or import/export; constitution changes.
- **Success metrics** (no targets set): fewer steps and no coordinate knowledge needed to add the current location; share of attempts ending in a saved, refreshed location; displayed area matches the user's nearest area (testable with fixed coordinates); number of near-duplicate entries created by repeated use.
- **Owner answers (2026-11-12)**:
  - **Duplicates**: a simple duplicate rule is in scope. The rule itself (for example, treating positions within a small distance of an existing saved location as the same place) is to be defined in specification.
  - **Firefox and Safari**: accepted as-is. Behaviour there is not verified or supported for this version; the app should show a small, unobtrusive note that Firefox and Safari are not supported for this feature. Wording and placement are for specification.
  - **Singapore bounds**: the existing coarse bounding box (lat 1.1–1.5, lon 103.6–104.1) is good enough for this version.
  - **Privacy of coordinates**: the owner asked whether this is a security concern. Finding, from the code: the existing create flow logs `location_create_submitted` with the raw coordinates via `POST /api/logs`, which writes them to `backend/logs/app.log` (git-ignored) and stdout; the position is also stored in SQLite and returned by the unauthenticated `GET /api/locations`. For a local, single-user dev app this is a low risk: nothing leaves the machine and the log is not committed. It becomes a real concern if the app is shared or deployed, since the user's precise position would sit in plaintext logs and in an API with no authentication. Recommendation for specification: do not log precise coordinates for geolocation-created locations (log only the event and the resulting area, or round the position), and keep the browser permission prompt as the consent step. Owner to confirm.
- **Owner confirmations (2026-11-12, second round)**:
  - Logging recommendation **accepted**: do not log precise coordinates for geolocation-created locations (log the event and the resulting area, or a rounded position).
  - Simple duplicate rule **accepted** (detail left to specification).
  - Firefox/Safari unsupported-note in the UI **accepted**.
  - Coarse Singapore bounding box **accepted** for this version.
- **Carried-forward open questions**:
  - [NEEDS CLARIFICATION: Define the duplicate rule detail (distance threshold, and whether a repeat press selects the existing entry or shows a message). Left to specification.]
  - [NEEDS CLARIFICATION: Run a real position request in Chrome to check the accuracy returned on the owner's machine (not yet done).]
  - Constraint to respect: frontend tests cover pure `.ts` modules only, so any logic worth testing (duplicate rule, error mapping) must be extracted into one.
