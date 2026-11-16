# Problem Definition: Seeing current conditions across Singapore, not just at saved locations

- **Slug**: station-reading-map-layers
- **Created**: 2026-11-16 (rewritten the same day after `research.md`; owner decisions from the first version kept)
- **Inputs used**: research.md | user input (owner decisions, 2026-11-16) | earlier evidence from `.specify/assessments/nea-data-new-features/` (Priority 4). No `intake.md`; intake was skipped.

## Problem Statement

People using this app can see current rain, temperature and wind only at the one station nearest each saved location. So they can't answer island-wide questions such as "where has it been raining in the last 15 minutes?" or "is it cooler or windier somewhere else?". This matters most on changeable or stormy days, when one nearby reading can't show where conditions differ. It matters now because the app is being released publicly as a replacement for a mobile weather app, and people switching to it will expect to see conditions across the island [source: owner, 2026-11-16; research.md "Users & Demand"].

## Affected Users & Stakeholders

- **Users**:
  - **People switching from the mobile weather app this app replaces.** They check conditions on a phone before going out or travelling across the island and expect an island-wide view (owner, 2026-11-16). Their main alternative today is NEA's free myENV app, which already has a rain overlay and heavy-rain alerts. App reviews say that overlay takes extra steps to reach [source: research.md "Prior Art", low confidence]. [NEEDS CLARIFICATION: which app does this replace, and roughly how many users are expected at launch?]
  - **The owner**, on laptop and mobile: today's only confirmed user and the decision-maker.
- **Stakeholders**:
  - **Owner (decision-maker)**: approves scope, the launch audience, any constitution exception and whether to get a Production API key.
  - **Constitution Principle I (Snapshot-Only Weather Data)**: the lightning exception is worded for lightning only and says "any further exception requires its own amendment". Island-wide readings beyond what a saved-location refresh already brings back would need a new amendment [source: research.md "Rules that apply"; `.specify/memory/constitution.md` §I].
  - **The shared data.gov.sg rate budget**: one Development key (12 requests per 10 s) shared by the weather and lightning clients through one paced queue. A saved-location refresh already takes about 10–11 s. A public release spreads that one key across every visitor, and the planned single-container host paces and caches per instance [source: research.md "Rate budget and timing"; `vercel-container-hosting/decision.md`].

## Goals

- **Rain**: users can tell at a glance where in Singapore it has rained over at least the last 15 minutes, and roughly how heavily. The owner decided that one 5-minute total is not enough.
- **Temperature and wind**: users can compare temperature and wind across the island, not only at saved locations.
- **Freshness and gaps**: users can tell how fresh each island-wide reading is, and when a station has no reading. They must never mistake stale or missing data for "no rain" or "calm". Research confirms that some listed stations regularly have no value [source: research.md "What the endpoints offer"].
- **Devices**: the island-wide view works on laptop and mobile, in the card map and the full-screen map, on every theme, down to 375 px phone width (owner, 2026-11-16).
- **No harm to what exists**: the saved-location experience and the lightning view stay as fast and as readable as they are today. This matters because all three draw on the same rate budget [source: research.md "Evidence Against the Idea"].
- **Reasons to switch**: what users get here must be clear next to what myENV's rain overlay already gives them. Measured readings at named stations, seen together with lightning and saved places, are one candidate [source: research.md "Market & Context"]. [NEEDS CLARIFICATION: owner to confirm that measured station readings, with gaps between stations, are acceptable as the answer to "where is it raining", given that radar-style coverage between stations is out of reach on this data source.]

## Non-Goals

- Readings other than rain, temperature and wind: humidity, UV, PSI and WBGT stay out (owner confirmed, 2026-11-16).
- Telling users whether rain is moving toward them, and any alerts or push notifications. Fifteen minutes of station totals can't show direction of travel reliably [source: research.md "Evidence Against the Idea"]. Alerts are a separate idea (nea research Priority 6).
- Forecasts, nowcasts or values estimated between stations (the AI/ML assessment covers these), and radar imagery, which the data.gov.sg real-time API does not provide [source: research.md "Market & Context"].
- History, trends or replay beyond what the last 15 minutes of rain needs (nea research Priority 9; conflicts with snapshot-only).
- Changing how the saved-location tiles or the lightning layer behave.
- Non-NEA data sources such as PUB flood levels or dengue clusters.
- Getting a Production API key or handling launch-scale traffic in general. These are decisions for the public release as a whole; this problem only has to fit within them (see Open Questions).

## Success Metrics

- **Rain, qualitative**: on a day with scattered showers, a user can name the areas where it has rained in the last 15 minutes using only this app (baseline: not possible; only the nearest station per saved location is shown).
- **Temperature and wind, qualitative**: a user can name the warmest or windiest part of the island from the app (baseline: not possible).
- **Freshness**: no island-wide reading shown is older than NEA's update interval for it plus the app's cache window, and the age shown matches the source timestamp.
  - Rain: NEA publishes every 5 minutes, confirmed across sources.
  - Temperature and wind: sources say 30 seconds, 1 minute or 5 minutes, still to be confirmed [source: research.md "How fresh the data is"].
  - Baseline: no island-wide view exists.
- **Coverage**: every station either shows a value or is clearly marked as having none (baseline: holds for tiles today; rainfall observed with 88 stations [source: research.md]).
- **Time to view** (owner still to confirm):
  - Turning the view on or off, or switching between rain, temperature and wind, when the data is already loaded: under 1 s. This matches lightning (spec 002 SC-002).
  - Getting fresh data: under 5 s on a phone connection, with a visible loading state and the previous readings kept on screen meanwhile.
  - Research puts the wait between paced requests alone at about 2.7–4.4 s for rain, temperature and wind together on the Development key, before network time. So 5 s is tight, and a rain-only scope would ease it [source: research.md "Rate budget and timing"].
- **Rate budget**: no increase in data.gov.sg 429 responses, and saved-location refresh stays within the accepted ~10–15 s (baseline: zero 429s across 5 overlapping runs, refresh 9.8–10.9 s, spec 005 T027 §4–§5).
- **Legibility**: on every theme at 375 px, rain, temperature and wind are readable without zooming, and tapping a station shows its value (baseline: not applicable).

## Cost of Inaction

The gap is a missing feature at launch, not a failure. People leaving a mobile weather app would find that this one only covers their saved spots. Because myENV is free and already shows a rain overlay, many would likely keep it open alongside this app, which undercuts the app's purpose as a replacement [source: research.md "Market & Context"; the user behaviour is an assumption]. Doing nothing adds no rate-limit risk, needs no constitution amendment and puts no load on the shared key. Meanwhile, every saved-location refresh keeps downloading all stations' readings and discarding all but the nearest one [source: research.md "Prior Art", `backend/src/weather.ts:391-424`].

## Owner Decisions (2026-11-16, kept from the first version)

- **Audience**: public users switching from a mobile weather app, not just the owner.
- **Scope**: rain, temperature and wind only.
- **Freshness**: as fresh as the NEA API allows.
- **Rain window**: at least 15 minutes of rainfall, not one 5-minute total.
- **Devices**: laptop and mobile, card map and full-screen map, every theme, 375 px.
- **Time to view**: the owner asked for a recommendation; the targets are under Success Metrics and await confirmation.

## Open Questions

1. [NEEDS CLARIFICATION: Which app does this replace, and how many users are expected at launch? This decides whether a Production key (30 per 10 s) is needed before any island-wide view ships, and it is a bigger constraint than this feature alone.]
2. [NEEDS CLARIFICATION: Rain first, or rain, temperature and wind equally? If the scope has to shrink to meet the time and rate targets, this sets the order. Research shows a rain-only scope costs about half the requests.]
3. [NEEDS CLARIFICATION: Confirm the time-to-view targets (under 1 s for a toggle, under 5 s for fresh data). Research says 5 s is tight for all three readings on the Development key.]
4. [NEEDS CLARIFICATION: Do "current conditions across the island" have to be fresher than the user's last saved-location refresh? If yes, a Principle I amendment like lightning's is needed. If no, it isn't, but readings are only as fresh as that refresh and cover a single moment, not 15 minutes.]
5. [NEEDS CLARIFICATION: Are measured station readings with gaps between them an acceptable answer to "where is it raining", next to myENV's radar-based overlay? (Goals, "Reasons to switch".)]
6. To verify before specification: a one-off live test of whether the station endpoints' documented `date` parameter can return enough recent 5-minute rain readings to cover 15 minutes. Also check page size and order, and whether the same works for temperature and wind [source: research.md "Gaps"].
7. To verify before specification: how often NEA updates temperature and wind (30 seconds, 1 minute or 5 minutes). This sets the freshness metric [source: research.md "How fresh the data is"].
8. Carried from research: check data.gov.sg licence and attribution terms for showing NEA data publicly.
9. Carried from nea decision.md: weather and lightning share one paced request queue, so any new demand on data.gov.sg has to fit that budget.
