# Implementation Plan: Today's UV Trend in the UV Tile

**Branch**: `008-uv-hourly-trend` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-uv-hourly-trend/spec.md`

## Summary

Keep the full hourly list from the `uv` response the app already fetches, and store it as one new nullable snapshot field, `uv_hourly` (`date`, `as_of`, readings oldest first). That adds no upstream call. The UV tile now spans two grid columns and shows:
- 13 hourly slots from 07:00 to 19:00, coloured from the theme's existing UV gauge;
- a UV 3 (Moderate) marker and NEA's 11 am – 3 pm usual-peak band;
- a "Rising / Steady / Falling · n h at UV 3+" line;
- guidance quoted from NEA and HealthHub, and "measured at Changi · as of".

All logic sits in a new pure module, `uvTrend.ts`.

Research corrected the spec in two places:
- Overnight, the data carries the **previous day's** list, so the day comes from the data itself (R2).
- Neither NEA nor HealthHub states a "protect from UV 3" level, so UV 3 is shown only as the start of Moderate (R1).

## Technical Context

**Language/Version**: TypeScript on Node (ESM), React 18

**Primary Dependencies**: Express, Drizzle ORM (sqlite-proxy over `node:sqlite`), Vite, Tailwind 3 (unchanged; no new packages)

**Storage**: SQLite `locations` table. One new nullable JSON text column, `uv_hourly`, added by generated migration `0003_*`.

**Testing**: vitest, run forked and not in parallel. Supertest for routes. The frontend is tested through the pure module `uvTrend.ts` only. agent-browser handles the on-demand browser checks.

**Target Platform**: a single Node process serving the backend and frontend. Desktop and phone-width browsers (360 px and up).

**Project Type**: web application in npm workspaces (`backend`, `frontend`)

**Performance Goals**: the refresh call count stays at its current value (12 per plan research, confirmed and pinned by T010) and refresh time is unchanged (FR-002, SC-003). The tile renders 13 slots, which costs nothing measurable.

**Constraints**:
- No provider calls on page load.
- Colours come from theme tokens only, reusing `--scale-uv` (R4).
- No horizontal scroll at 360 px in any of the 6 themes.
- No estimated or future UV values.

**Scale/Scope**: personal use, a handful of saved locations, 13 readings per snapshot.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I. Snapshot-only | ✅ | `uv_hourly` comes from the same `uv` call inside `getCurrentWeather`, on create or refresh only, and is stored in the snapshot. No new endpoint, no extra call, no amendment. |
| II. One process, relative API | ✅ | No new routes. The frontend reads the field from the existing `/api/locations` responses through the store. |
| III. Injectable provider | ✅ | Parsing lives in `SingaporeWeatherClient.fetchUvIndex`. Fakes injected via `createApp({ weatherClient })` just return the extra field. |
| IV. Testing within limits | ✅ | View logic (slots, bands, direction, count, states, today test) lives in pure `uvTrend.ts` with unit tests. Parsing is tested in `weather.test.ts`, and storage round trips in `routes/locations.test.ts`. |
| V. Theme-driven UI | ✅ | Bars reuse each theme's `--scale-uv`. Text and lines use `white/*` and `text-ink-muted`. The tile stays in `TileShell` (`rounded-card`). No new tokens or literal colours. The `apple` theme's palette is unchanged; only the grid span and order of the UV tile change, for every theme alike. |
| VI. Testing & quality gate | ✅ | No new route. The existing route tests get assertions for the new field. Lint and test gate commits; `npm run verify` before done. |

Re-check after design: still passing. No violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-uv-hourly-trend/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── schema.ts              # UvDay/UvReading types; WeatherSnapshot.uv_hourly; nullable json column uvHourly
│   ├── weather.ts             # UvPayload gains `date`; fetchUvIndex() also returns `hourly`; snapshot.uv_hourly; empty snapshots null
│   ├── weather.test.ts        # uv fixture with date + index; ordering, null values, empty list, failure isolation
│   ├── db.ts                  # map uv_hourly ↔ uvHourly; defaultWeather uv_hourly: null
│   └── routes/locations.test.ts  # fake snapshot includes uv_hourly; round trip; pre-feature row reads null
└── drizzle/0003_*.sql         # generated: ALTER TABLE locations ADD uv_hourly text

frontend/src/
├── types.ts                   # UvDay, UvReading; WeatherSnapshot.uv_hourly
└── components/
    ├── uvTrend.ts             # NEW pure: uvBandName(), uvTrendView(uvIndex, uvHourly, now), UV_GUIDANCE text
    ├── uvTrend.test.ts        # NEW
    └── Tiles.tsx              # uvLabel → uvBandName; UVTile renders hourly view + lines; OutdoorGrid order/span

frontend/src/index.css         # .uv-bar helper: background var(--scale-uv), size 2200% (no new tokens)

docs/architecture.md           # snapshot paragraph: uv_hourly from the same uv call; frontend paragraph: uvTrend.ts
docs/theming.md                # one line: UV hourly bars sample --scale-uv
```

**Structure Decision**: the existing `backend/` and `frontend/` workspaces. The new code follows the patterns already there: a JSON snapshot column like `forecast_periods`, a pure tile helper like `heatStress.ts` and `feelsLike.ts`, and `ScaleBar`'s use of `--scale-uv`.

## Design Notes

1. **Parsing (R2, data-model)**:
   - `fetchUvIndex()` returns `{ value, timestamp, hourly }`, where `hourly` is built from `records[0]` only.
   - The `fetchOptional('uv', …)` fallback becomes `{ value: null, timestamp: null, hourly: null }`, so a failure nulls both fields together (R6).
   - `uv.timestamp` still feeds `observed_at` as today.
2. **No date arithmetic on the backend**: `date` is copied from the provider. The frontend alone decides "today" against `now` (R7), using `singaporeDate()` from `sunTimes.ts` and the existing `useNow` tick.
3. **Band source of truth**: move the band boundaries from `Tiles.tsx` `uvLabel` into `uvTrend.ts` `uvBandName()`. `uvLabel` keeps returning "Unavailable" for missing values. `outdoorSummary.ts` `uvBand` (hero, 6+) is **not** touched (FR-014).
4. **Bar colour (R4)**: an `.uv-bar` class in `index.css`:
   - `background-image: var(--scale-uv); background-size: 2200% 100%;`
   - inline `background-position-x` from `uvBarPosition(value)`, which centres the 1/22-wide slice on `value / 11` and keeps it inside the gauge. (Revised during implementation: a 1/11 slice at `value / 11` caught Singapore Sky's 2 px band gaps at a bar's edge.)
   - The inline style carries a position, not a colour, so Principle V holds.
5. **Layout (R3)**: in `OutdoorGrid`, order Rainfall, UV, Air Quality. Rainfall and UV get `col-span-2`; Air Quality gets `col-span-2 lg:col-span-4` whether open or closed, so neither width leaves empty cells (contracts/ui.md Placement). The FR-015 fallback hides the hourly view below 340 px with a hand-written `.uv-hourly` media rule in `index.css`, keeping the text lines. (Tailwind's `min-[340px]:` variant isn't generated in this project, because the `md` screen is `raw`.)
6. **Wording (R1)**: the guidance and source strings live as constants in `uvTrend.ts`, so tests pin them and a wording change touches one place.
7. **Docs**: update `docs/architecture.md` (snapshot and frontend paragraphs) and `docs/theming.md` (one line on `.uv-bar`) in the same change, per the Development Workflow.
8. **Browser check**: run the quickstart §3–4 states with agent-browser and a stubbed `GET /api/locations`. A reusable `scripts/e2e/uv-trend.sh` is optional, for `/speckit-tasks` to decide.

## Complexity Tracking

No constitution violations.
