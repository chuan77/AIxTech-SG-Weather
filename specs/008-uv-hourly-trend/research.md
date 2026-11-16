# Research: Today's UV Trend in the UV Tile

Phase 0 for [plan.md](./plan.md). Each item records the decision, the rationale and the alternatives. All "NEEDS CLARIFICATION" items from the spec and the technical context are resolved here.

## R1. Guidance wording: what NEA and HealthHub actually say

- **Decision**: The guidance line uses only these published statements:
  - NEA: "The maximum UV radiation level typically occurs during the four-hour period between 11am and 3pm."
  - NEA: the UV index "is measured with a UVI sensor located in an open field at the Changi Meteorological Station."
  - HealthHub: sunscreen "with Sun Protection Factor (SPF) 30 or higher", applied "20 to 30 minutes before going into the sun".

  The tile **doesn't** say "protection is advised from UV 3". It marks UV 3 only as the start of the Moderate band, and the count reads "hours at UV 3+ (Moderate or higher)".
- **Rationale**: Both pages were read directly on 2026-11-15.
  - NEA's band table is an image only, and neither page states a UV level from which protection is advised.
  - The "from UV 3" figure in the assessment came from search summaries that attribute it to WHO.
  - Stating it as NEA or HealthHub advice would misattribute it, so the spec was amended (FR-007, FR-008, User Story 2).
  - The band boundaries themselves (Low 0–2, Moderate 3–5, …) already ship in `Tiles.tsx` `uvLabel` and aren't changed.
- **Alternatives considered**:
  - Cite WHO for "protect from 3". Rejected: WHO's page wasn't read, and the owner asked for Singapore bodies.
  - Omit the UV 3 marker entirely. Rejected: the count and marker are factual band statements and serve Goal 2.
- **Sources**:
  - https://www.nea.gov.sg/corporate-functions/weather/ultraviolet-index/uv-radiation-uv-index ("UV Radiation & UV Index", last updated 08 Apr 2026)
  - https://healthhub.sg/a-z/medications/sun-protection (HealthHub "Sunburn", last reviewed 12 Jan 2026)

## R2. What the UV data holds overnight and just after midnight

- **Decision**: The day shown is the record's own `date` field, not the refresh time. An overnight refresh therefore stores and shows the **previous day's** full list, labelled with that date (spec FR-011/FR-012).
- **Rationale**: Live probes on 2026-11-15 at 21:16 SGT (keyless, `api-open.data.gov.sg`) showed:
  - `uv` (latest, 21:16) → one record, `date: 2026-11-15`, `timestamp 19:00`, `updatedTimestamp 19:11:20`, 13 readings 07:00 → 19:00.
  - `uv?date=2026-11-14T23:30:00`, `…15T00:30:00` and `…15T06:30:00` → all return **2026-11-14's** 19:00 record (13 readings).
  - `uv?date=2026-11-15T07:05:00` → `date: 2026-11-15`, readings `[07:00 → 0]`, `updatedTimestamp 07:11:24`.

  So the list is never empty overnight. It is the previous day's until the first reading is published at about 07:11. Each hour's reading appears about 11 minutes after the hour. The original spec scenario ("before 07:00 → no readings yet today") would have mislabelled real data, so it was amended.
- **Alternatives considered**: Derive the day from `observed_at`. Rejected: wrong for every overnight refresh.

## R3. Where and at what size the hourly view fits

- **Decision** (revised by `/speckit-analyze` 2026-11-15): grid order Rainfall, UV, Air Quality. Rainfall and UV both span **two grid columns** at every width. Air Quality spans two on a phone and four at `lg`, whether its detail is open or closed:
  - phone (2 columns): Rainfall, UV and Air Quality each at full width
  - `lg` (4 columns): Rainfall (2) | UV (2), then Air Quality (4)
- **Rationale**:
  - Today the tile is one of two columns at phone width, about 150 px of content at 360 px. Thirteen slots there would be about 11 px each, too narrow for a number per slot (spec AS 1.2).
  - At full phone width (about 328 px) each slot gets about 25 px, which fits an 11 px number above a bar.
  - Air Quality is already `col-span-2` (and `lg:col-span-4` when its detail is open), so the first draft (Rainfall | Air Quality | UV) left gaps: Rainfall alone in half a row on a phone, and three empty columns over two rows at `lg`. The revised order has no gaps at either width, open or closed.
  - Trade-off: Rainfall becomes full width on a phone and two columns at `lg`, and closed Air Quality takes the full row at `lg`. No tile in the other grids changes.
- **Alternatives considered**:
  - Sparkline without numbers. Rejected: values only on hover fail spec AS 1.2 and are unreadable on touch.
  - A separate panel. Rejected: out of scope (decision).
  - Text-only (Option A). Kept as the fallback in FR-015 and doesn't apply at 360 px.

## R4. Bar colours without new theme tokens

- **Decision**: Each reported bar is filled from the theme's existing `--scale-uv` gradient, positioned so the bar shows the colour at its value: background size 2200% wide, with the x position set by `uvBarPosition` so the 1/22-wide slice is centred on value/11 (revised during implementation from 1100%, which caught Singapore Sky band gaps at bar edges).
- **Rationale**:
  - All six themes already define `--scale-uv` for the gauge.
  - Singapore Sky's version is hard-banded at the official cut-offs (2 / 5 / 7 / 10, `index.css` lines 442–478), so bars land exactly on their band colour. The others are smooth gradients, matching how their gauge already reads.
  - No per-band tokens are needed in six theme blocks, and no new contrast audit, because colour never carries meaning alone: every bar shows its number in ink (`text-white/…`), and the screen-reader list names value and band (WCAG 1.4.1).
- **Alternatives considered**: Five `--uv-*` tokens per theme. Rejected: 30 new values and contrast checks for no extra meaning.

## R5. Storage shape

- **Decision**: One new nullable JSON column `uv_hourly` on `locations`, holding `{ date, as_of, readings[] }`, generated as migration `0003_*`. Details in [data-model.md](./data-model.md).
- **Rationale**:
  - It follows the existing JSON-list columns (`forecast_periods`, `daily_forecast`).
  - It is nullable, so rows refreshed before the feature read as `null`. That enables FR-013's "appears after the next refresh" state with no backfill.
  - Readings are stored oldest first, so the frontend never re-sorts.
- **Alternatives considered**:
  - 13 numeric columns. Rejected: rigid, and it loses the hour labels.
  - Recompute from a separate table. Rejected: Principle I keeps one snapshot per location.

## R6. Telling "unavailable", "pre-feature" and "empty" apart

- **Decision**:
  - `uv_index == null && uv_hourly == null` → **Unavailable** (provider error, as today).
  - `uv_index != null && uv_hourly == null` → **pre-feature** snapshot (FR-013).
  - `uv_hourly.readings` empty → **no readings yet** (FR-012).
  - Otherwise → readings.
- **Rationale**: A failed `uv` fetch already yields `uv_index: null` through `fetchOptional`, and the new field comes from the same fetch, so the two always fail together. Pre-feature rows have a value but no list.
- **Alternatives considered**: A separate status field. Rejected: the two existing fields already encode it.

## R7. Direction, count and the "today" test

- **Decision**:
  - **Direction**: compare the latest numeric reading with the most recent earlier numeric reading, skipping missing hours: higher gives "Rising", lower "Falling", equal "Steady". It is shown only when the list's `date` equals the Singapore date *now*, at view time, through the existing 60-second `useNow` tick, and there are two or more readings.
  - **Count**: all numeric readings of 3 or more in the list.
  - **Previous-day test**: list `date` is not today's Singapore date, which gives a date label (e.g. "14 Nov") and no direction.
- **Rationale**: The spec fixed Rising/Steady/Falling (Assumptions). Comparing with *now* rather than the refresh time means a snapshot from yesterday afternoon, viewed this morning, is correctly labelled as yesterday's. `singaporeDate()` already exists in `sunTimes.ts`.
- **Alternatives considered**: A three-hour trend. Rejected: it hides real turns, and the spec accepts hour-to-hour flicker.
