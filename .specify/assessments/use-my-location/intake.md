# Idea Intake: "Use my location" button

- **Slug**: use-my-location
- **Created**: 2026-11-12
- **Source**: pasted text (repo context: weather_starter)
- **Type**: new-capability

## Idea (as captured)

> I want to implement a "Use my location" button that detects the user's position via the browser, finds the nearest Singapore forecast area, and adds it automatically. Works on localhost without HTTPS.

## Restated

Add a "Use my location" control that obtains the user's position from the browser, maps it to the nearest Singapore forecast area, and creates a saved location for that area without manual entry. It should function when the app is served from localhost over plain HTTP.

## Origin & Context

- **Raised by**: [NEEDS CLARIFICATION: who raised it — appears to be the repo owner/user]
- **Trigger**: [NEEDS CLARIFICATION: what prompted it — e.g. friction in the current add-location form]
- **Related repo context** (noted, not evaluated): locations are currently added via a form in `Sidebar`; creating a location stores coordinates and immediately refreshes a snapshot (`docs/architecture.md`); `backend/src/weather.ts` already matches the nearest forecast area/station by coordinates.

## First-Glance Unknowns

- [NEEDS CLARIFICATION: Behaviour of the browser Geolocation API on plain-HTTP localhost vs. non-localhost hosts (e.g. `weather-starter.localhost:1355` via Portless, LAN access)? "Works on localhost without HTTPS" needs a precise definition of which origins count.]
- [NEEDS CLARIFICATION: What happens when the user denies permission, geolocation is unavailable, or the position times out?]
- [NEEDS CLARIFICATION: What if the user is outside Singapore, or too far from any forecast area? Is there a distance cutoff?]
- [NEEDS CLARIFICATION: Should the saved location be named after the forecast area, or the user's actual coordinates (or both)? Which coordinates are stored — precise or area-level?]
- [NEEDS CLARIFICATION: How are duplicates handled if that area is already saved (the DB has a unique index; creation returns 409)?]
- [NEEDS CLARIFICATION: Is the position sent to the backend, or is nearest-area matching done client-side? Privacy expectations for precise coordinates?]
- [NEEDS CLARIFICATION: "Adds it automatically" — does it also select the new location and refresh its snapshot?]
- [NEEDS CLARIFICATION: Where should the button live (sidebar add form, empty state, elsewhere)?]
- [NEEDS CLARIFICATION: Success criteria and priority relative to other work (e.g. the in-progress lightning map layer).]
