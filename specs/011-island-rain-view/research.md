# Phase 0 Research: Island-wide Rain on the Map

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-17

Every unknown in the plan's Technical Context is resolved below. Each item gives a Decision, its Rationale and the Alternatives considered.

## Gate 1: live 15-minute data check (PASSED 2026-11-17)

The gate was run once at 08:24–08:25 SGT, without an API key, four requests spaced 2 s apart, from outside the app. The raw responses were kept only in the session scratchpad and never committed.

| Request | Result |
|---|---|
| `GET …/rainfall` (no `date`) | 200, 12 KB, **1 reading**, timestamp 08:15, 86 stations |
| `GET …/rainfall?date=2026-11-17T08:24:10` | 200, identical to the latest reading (08:15) |
| `GET …/rainfall?date=2026-11-17T08:14:10` | 200, 1 reading at 08:10 |
| `GET …/rainfall?date=2026-11-17` | 200, 74 KB, **25 readings, newest first** (08:20 → 06:20), 87 stations, `paginationToken` present |

Findings:

1. **One request covers the window.** A request with today's date returns the newest 25 five-minute readings, about two hours, newest first, so the last 15 minutes are always on the first page. Pagination is never needed. This beats the 1–3 requests the gate allowed for.
2. **The newest period fills in gradually.** At 08:25 the 08:20 reading held **3 of 87** stations. It still held 3 after a recheck 45 s later. The plain "latest" call skips that period and returns 08:15 (86 stations). So the newest *usable* reading lags real time by about 10 minutes.
3. Station objects carry `location` (as the skill recorded), not the `labelLocation` in the OpenAPI spec.
4. Values were all `0`, typed as integers, because the morning was dry. Wet values were not observed, so the parser must coerce with `Number()`.
5. One station listed in `stations` was absent from the 08:15 reading, which confirms that "no reading" is a normal case.
6. The `paginationToken` decodes to `date=rainfall_2026-11-16,timestamp=2026-11-16T22:20:00.000Z`, a UTC cursor. It isn't used, but it shows that the data is partitioned by UTC date.

## R1. How to fetch the 15-minute window

- **Decision**: one `GET /v2/real-time/api/rainfall?date=<SGT date>` request, using the first page only.
  - If the usable periods found reach back before 00:00 SGT, make **one** extra request for the previous SGT date (the same rule lightning uses).
  - Most fetches therefore take 1 request, and at most 2.
- **Rationale**: Gate 1 finding 1. Every request goes through the shared `ProviderRequester` (884 ms spacing on the Development key), so 1–2 requests cost about 0.9–1.8 s of pacing.
- **Alternatives considered**:
  - Three point-in-time `date=…THH:mm:ss` calls: three times the cost, and each one still returns only the latest complete reading.
  - The latest call plus two point-in-time calls: the same cost, more code.
  - Keeping readings across fetches: excluded by FR-010 and the decision.

## R2. Which periods count, and how the window is anchored

- **Decision**:
  - A reading (period) is **usable** when its row count is at least 80% of the largest row count among the readings returned.
  - Starting from the newest reading, skip any that are not usable. The first usable one is the **anchor** `T`.
  - The window is the three five-minute periods ending at `T`, `T−5` and `T−10`.
  - A station's total is the sum of its values in those three readings.
  - `periods_covered` (0–3) counts how many of the three periods it appears in with a numeric value.
  - A period missing entirely from the response counts as not covered for every station.
  - A reading timestamp is treated as the **end** of its 5-minute total, so the window runs from `T−15 min` (exclusive) to `T` (inclusive).
- **Rationale**: Gate 1 finding 2. Using the incomplete newest period would mark about 84 stations as "partial" for no real reason. The 80% rule is relative, not a fixed count, because the number of listed stations varies (86–88). Duplicated timestamps are collapsed before counting (spec Edge Cases), so no rain is counted twice.
- **Alternatives considered**:
  - Always using the newest reading: wrong for the reason above.
  - Anchoring on a separate "latest" call: costs an extra request.
  - A fixed threshold such as 60 stations: brittle if the network changes.

## R3. Freshness and when to call readings "out of date" (spec update needed)

- **Decision**: show the anchor time `T` as "Rain to 08:15 · 10 min ago". Label the readings **out of date** when `T` is more than **20 minutes** old at the time of display, or when the server served a stale copy after a failure (`stale: true`).
- **Rationale**: spec FR-005 and SC-003 say "older than one 5-minute interval plus the shared cache window" (7 minutes). Gate 1 found that the newest *complete* reading is normally about 10 minutes old already, so the spec's rule would flag healthy data as out of date nearly all the time. 20 minutes is the usual lag (about 10 minutes) plus one interval (5) plus the cache window (2), plus a 3-minute margin. Anything older means at least one full publication cycle was missed. **The plan updates spec FR-005, SC-003 and US3 scenario 4 to match**; see the Clarifications note in spec.md. The goal of never presenting old data as current is unchanged.
- **Alternatives considered**:
  - Keeping 7 minutes: always flags.
  - Using the incomplete newest period to look fresher: misleading.
  - Showing only the age with no out-of-date label: that loses the clear warning US3 asks for.

## R4. Heaviness levels for a 15-minute total

- **Decision**:
  - Dry: 0 mm.
  - **Light**: more than 0 and under 0.6 mm in 15 minutes (under 2.5 mm/h).
  - **Moderate**: 0.6 to under 2.5 mm (2.5–10 mm/h).
  - **Heavy**: 2.5 mm or more (10 mm/h or more).

  The gauges report in 0.2 mm steps ("TB1" tipping bucket), so in practice light is 0.2–0.4 mm, moderate 0.6–2.4 mm and heavy 2.6 mm and up. The rule compares totals, not step counts. The key shows each range in mm and as an hourly rate.
- **Rationale**: these are the widely used rain-rate bands, as used by WMO and the UK Met Office (light under 2.5, moderate 2.5–10, heavy over 10 mm/h), scaled to 15 minutes. Exact thresholds are a presentation choice that Gate 2 (the mock-up) confirms. They live in one pure, tested `.ts` module, so they're easy to change.
- **Alternatives considered**:
  - NEA's own intensity wording: no published thresholds were found in this session.
  - A fourth "very heavy" level (50 mm/h or more): rare, and it adds clutter at 375 px. It can be added after the mock-up if wanted.
  - A continuous colour scale: fails "not colour alone" and is harder to read.

## R5. Server cache, shared loads and fallback

- **Decision**: a `SingaporeRainClient` modelled on `SingaporeLightningClient`.
  - One in-memory island rain snapshot is cached for **2 minutes**.
  - Callers who arrive while a load is in flight share that load.
  - On a provider failure it serves the previous snapshot with `stale: true`, or throws `WeatherProviderError`, which the route turns into a 502.
  - Nothing goes to SQLite.
  - It is injectable through `createApp({ rainClient })`.
- **Rationale**: these are FR-009, FR-010, FR-011 and the constitution's lightning-exception terms, which the owner accepted for rain. Reusing a proven pattern is the main cost-saving in Option B. Rain readings change every 5 minutes, so the constitution's minimum of 2 minutes rarely hides new data.
- **Alternatives considered**:
  - Tying the cache to the 5-minute publication cycle: saves little and makes the code more complex.
  - A shared generic "island layer" client for both lightning and rain: refactors lightning, which is out of scope.

## R6. Sharing the request budget with saved-location refreshes and lightning (OQ9)

- **Decision**: no new queueing rule. Rain uses the one `ProviderRequester` built in `createApp`, as lightning does, and requests run first-come, first-served at the existing pacing.
- **Rationale**:
  - A rain fetch adds 1 slot (2 near midnight), about 0.9–1.8 s, to anything queued behind it.
  - A saved-location refresh (about 12 calls, 9.8–10.9 s) running at the same time can finish at most about 1.8 s later. That stays inside the accepted 10–15 s (SC-006).
  - Because the rain cache is shared, at most one rain fetch happens every 2 minutes, however many viewers there are.
  - A priority queue would make the paced queue more complex for a launch of fewer than 5 users.
- **Alternatives considered**:
  - Giving saved-location refresh priority over rain: adds code for no measured need. Revisit if SC-006 fails.
  - A separate pacing stream: breaks the per-key limit (the nea decision requires one stream).

## R7. How stations are drawn, and telling levels apart without relying on colour

- **Decision**:
  - Draw about 88 Leaflet `divIcon` markers in their own pane, **below the lightning pane and above the basemap**, so lightning bolts and location pins stay on top.
  - Each level differs in **size and shape** as well as colour:
    - dry: a small hollow ring;
    - light: a small filled drop;
    - moderate: a medium drop;
    - heavy: a large drop with a thick outline;
    - no reading: a dashed ring with a "–";
    - partial: the level's normal symbol plus a small notch badge.
  - Tapping a station opens a popup with its name, total, level and period, or a partial or missing note.
  - There is no grouping: 88 points is two orders of magnitude below the lightning storm volume that needed it (spec 009).
- **Rationale**: FR-016 and SC-007 (no colour-only distinction, legible at 375 px). Constitution V means colours come from new per-theme variables (`--rain-light`, `--rain-moderate`, `--rain-heavy`, `--rain-outline`, `--rain-missing`, `--rain-dry`). Each theme must meet 3:1 against its basemap for the symbols, the same rule as `--lightning-outline`. Pure helpers (`rainHelpers.ts`) decide level, symbol class, popup text and status text, so they can be tested without a DOM (Principle IV).
- **Alternatives considered**:
  - Number labels on every marker: clutter at 375 px. The value goes in the popup instead.
  - Rendering on a canvas: unnecessary at this scale.
  - Reusing the lightning group code: no crowding problem to solve.

## R8. Controls, status line and key on the card map and full-screen map

- **Decision**:
  - A **Rain** switch, styled like the Lightning switch, sits next to the Lightning control on both maps. When rain is on, a refresh button appears.
  - A rain status strip sits on its own line, stacked above the lightning strip when both are on. Its states:
    - idle: "Show latest rain";
    - loading;
    - ok: "Rain at N stations";
    - empty: "No rain in the last 15 minutes";
    - unavailable;
    - out of date.
  - A small **key** button opens the heaviness legend.
  - The on/off choice is stored in `localStorage` under `weather-starter.rain.enabled`. It defaults to **off** (FR-007), unlike lightning, which defaults on.
  - A remembered "on" shows the idle prompt and never fetches on load.
  - The final layout at 375 px is settled by Gate 2.
- **Rationale**: the spec's US4 and US5 and constitution II (all state in `store.tsx`). The design copies the lightning control's interaction rules (prompt state, in-flight guard, client-side 2-minute freshness check), so users learn one pattern. Stacking the strips avoids touching the lightning control's behaviour (out of scope).
- **Alternatives considered**:
  - One combined "Layers" menu: friendlier at 375 px, but it changes how lightning is turned on (out of scope). Note it as a Gate 2 option if the mock-up looks crowded.
  - Defaulting rain on, as lightning does: the decision says off until the user asks.

## R9. Attribution (OQ8)

- **Decision**: show "Rainfall: NEA via data.gov.sg" in the rain key and the station popup. Before release, check the wording against the data.gov.sg licence (Singapore Open Data Licence). The check is a task, not a gate.
- **Rationale**: FR-017. data.gov.sg publishes under an open licence that requires attribution, but the exact wording was not fetched in this session.
- **Alternatives considered**: the Leaflet attribution row. It is already crowded on phones, and the map's own attribution belongs to the basemap.
- **Check (2026-11-17, T050)**: data.gov.sg publishes its data under the **Singapore Open Data Licence version 1.0** (data.gov.sg/open-data-licence). Its attribution pattern is a "Contains information from <dataset> … made available under the terms of the Singapore Open Data Licence version 1.0" statement with a link to the licence (agency examples: MPA, MAS; search results, not fetched). The key now shows "Contains information from Rainfall across Singapore (NEA), accessed from data.gov.sg, made available under the Singapore Open Data Licence version 1.0", with that phrase linked. Station popups keep the short "Rainfall: NEA via data.gov.sg".

## R10. Constitution amendment (FR-018)

- **Decision**: amend Principle I to list rain as a second named island-wide exception (`POST /api/rain/refresh`), on exactly the lightning terms: user action only, never on page load, not stored in SQLite or any `WeatherSnapshot`, a server cache of at least 2 minutes, and degrading to "unavailable".
  - This is a **MINOR** bump (1.4.0 → 1.5.0), because it materially expands guidance.
  - Build on the current working copy, which already has the owner's uncommitted one-word edit to Principle I ("fetched when").
  - Update the Sync Impact Report and `docs/architecture.md` in the same change.
- **Rationale**: the owner accepted it on 2026-11-17 (decision.md). The current text says "Any further exception requires its own amendment."
- **Alternatives considered**:
  - A generic "any island-wide layer" clause: broader than what was approved.
  - A PATCH bump: understates the change.

## R11. Development fixture for the mock-up and browser checks

- **Decision**: add `RAIN_FIXTURE=demo` (development only, ignored in production, like `LIGHTNING_FIXTURE`). It serves deterministic readings at real station positions: a band of scattered showers at every level, several dry stations, two with no reading and two partial. The fixture data is a small hand-made JSON of station ids and positions, not a copy of `RealtimeWeatherReadingsacrossSingapore/`. Browser checks stub `POST /api/rain/refresh` instead.
- **Rationale**: Gate 2 needs a realistic mock-up on a dry day, the e2e checks must never call data.gov.sg, and the pattern already exists.
- **Alternatives considered**: mocking only in a throwaway HTML page. That is fine for Gate 2's first look, but it doesn't help later browser checks.

## Context7 / library check

No new library is introduced. The work uses Express 4, React 18, Leaflet 1.9, Tailwind 3 and vitest, all at versions already in the repo, and nothing touches fast-moving library APIs such as Drizzle, which isn't used here. Per `CLAUDE.md`, no Context7 query was needed.
