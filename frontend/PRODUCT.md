# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: people in Singapore checking the weather for places they care about (home, work, a run, a trip out), usually on a phone and just before heading outdoors. They save a few locations and come back to glance at them.

Secondary: AIxTech programme participants and reviewers, who read the app and repo as a worked example of AI-assisted, spec-driven development. They are served best when the app is genuinely good for residents, not by showcase features built for them.

## Product Purpose

AIxTech SG Weather tracks saved Singapore locations, stores an official NEA weather snapshot for each, and shows them on a themed dashboard with a map.

Success: within seconds, a user can tell whether it is safe and comfortable to be outdoors at a saved place right now and later today: rain, lightning, heat stress, UV and temperature.

## Positioning

Official NEA data from data.gov.sg, captured per saved location as a stored snapshot rather than fetched on every view. The app is fast and keeps working when the upstream API is slow or rate-limited, and it says how old each reading is. Outdoor-decision signals (lightning layer, WBGT heat stress, feels-like, UV, sunrise/sunset) sit beside the forecast rather than in a separate tool.

## Operating Context

- Glanced at on a phone before going out, as well as on desktop. Phone layout is a first-class context.
- Locations are added by Singapore town name, by coordinates, or with "use my location" (browser geolocation).
- Weather is fetched only when a location is added or the user presses Refresh. Page loads read stored data, so "Updated <time>" is a core part of every reading.
- The lightning layer is island-wide, fetched only on explicit request, and may show as unavailable without affecting the rest of the app.

## Capabilities and Constraints

- Features delivered: persisted saved locations, lightning map layer, use my location, outdoor comfort tiles (feels-like, sunrise/sunset), NEA WBGT heat-stress tile, town-name search. Specs live in `specs/`.
- The project constitution (`.specify/memory/constitution.md`) is binding. In short: snapshot-only weather data, one process with relative `/api` calls, an injectable weather provider, offline tests, theme-driven UI, and a lint-plus-test quality gate.
- Stack: Express + React 18/Vite + Tailwind in one Node process, SQLite via Drizzle. One store context on the frontend, with no router.
- Data comes only from data.gov.sg / NEA real-time APIs. Readings can be null or missing per station; the UI must handle that honestly.
- Terminology: "location" (a saved place), "snapshot" (a stored weather reading), "Refresh" (fetching a new snapshot for one location).

## Brand Commitments

- Name: AIxTech SG Weather. Built on AI Singapore's `weather_starter` template.
- Theme system: several user-selectable themes (Apple, Glass, Radar, Sticker, Memphis, Singapore Sky; Singapore Sky's sky follows the selected location's storm, haze or heat state). `apple` is the default and the reference design. It follows Apple's current design language and changes only in deliberate theming work, never as a side effect. Every component must work in every theme.
- The data source (data.gov.sg / NEA) is credited in the UI.

## Evidence on Hand

- Real live data from data.gov.sg. Sample API responses are in `RealtimeWeatherReadingsacrossSingapore/` (local only, not committed).
- Feature specs and assessments: `specs/`, `.specify/assessments/`.
- There are no user testimonials, usage metrics or user research. Future work must not invent any.

## Product Principles

1. Answer "can I go outside?" first. Rain, lightning, heat and UV lead; everything else supports them.
2. Be honest about freshness. Every reading shows its time and source. Missing or stale data is labelled, not hidden or guessed.
3. Phones count as much as desktop. A user on the move must be able to read conditions, switch places and refresh with one thumb.
4. Theming is a feature, not a coat of paint. Every change has to work in every theme, and the default theme is protected.
5. Fetch only when asked. Weather updates come from deliberate user actions, so speed and reliability never depend on the upstream API.

## Accessibility & Inclusion

WCAG 2.1 AA is a hard requirement in every theme: text contrast, keyboard operation, visible focus, 44px touch targets on touch devices, and screen-reader labels for icon-only controls and live data updates.
