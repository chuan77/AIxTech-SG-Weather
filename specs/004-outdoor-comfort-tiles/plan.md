# Implementation Plan: Outdoor Comfort Tiles

**Branch**: `004-outdoor-comfort-tiles` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-outdoor-comfort-tiles/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Step 1 of the `nea-data-new-features` assessment. Three readouts for the selected location:

1. **Feels like**: Steadman apparent temperature (non-radiation form, research R1), worked out in the frontend from the stored temperature, humidity and wind. It is rounded half-up to one decimal (R3), placed in one of five bands with clothing advice, and gets "Carry an umbrella" when the condition mentions rain, showers or thunder, or rainfall is above 0.1 mm (R4).
2. **Sunrise and sunset**: worked out in the frontend from the location's position and today's Singapore date, using the NOAA approximation (R5). The date rolls over through the existing `useNow` tick (R6).
3. **Air-quality detail**: five pollutant concentrations plus the reading time, taken from the `psi` response the backend already fetches (R7). They are stored as six new nullable snapshot columns (R8).

Nothing derived is stored. The number of upstream calls per refresh stays at 11.

## Technical Context

**Language/Version**: TypeScript on Node (ESM), React 18

**Primary Dependencies**: Express, Vite, Tailwind 3, Drizzle ORM over `node:sqlite`, react-leaflet (unchanged). No new dependencies.

**Storage**: SQLite `locations` table gets 6 nullable columns through a generated Drizzle migration (`backend/drizzle/0001_*.sql`)

**Testing**: vitest (node environment, forked, no file parallelism); backend tests use a fake `weatherClient` or a stubbed `fetch`; frontend tests cover pure `.ts` modules only

**Target Platform**: Desktop and mobile browsers; single Node process served via Portless in dev

**Project Type**: Web application (npm workspaces `backend` + `frontend` in one process)

**Performance Goals**: The new readouts render with the selected location, with no network wait. Refresh time is unchanged.

**Constraints**: Zero additional data.gov.sg calls (FR-012, SC-003); no calls on page load or selection (FR-014); every readout follows the theme (FR-016); no "Heat Stress" wording (FR-007)

**Scale/Scope**: Personal use, a handful of saved locations; 2 new pure modules, 3 UI readouts, 6 snapshot fields

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Snapshot-Only Weather Data | Pollutants arrive only with create or refresh, from a call already made. Feels like and sun times come from stored data and the clock. No page-load calls. | Pass |
| II. One Process, Relative API | No new endpoints or ports. Data reaches the UI through the existing `/api/locations` responses and `store.tsx`. | Pass |
| III. Injectable Weather Provider | The parsing change stays inside `SingaporeWeatherClient`. Tests use stubbed fetch and fake clients. No network in tests. | Pass |
| IV. Testing Within Real Limits | Feels-like and sun-time logic go in pure `.ts` modules with vitest tests. The backend parser is tested with fixtures. The forked, non-parallel config is unchanged. | Pass |
| V. Theme-Driven UI | New tiles use `TileShell` (`rounded-card`, `white` classes). No literal colours. `apple` stays unchanged apart from the added tiles. | Pass |
| Technical Constraints | Schema change in `schema.ts` plus a generated migration. No secrets added. `RealtimeWeatherReadingsacrossSingapore/` untouched. | Pass |
| Workflow | `docs/architecture.md` updated in the same change (new snapshot fields, derived readouts). `npm test` and the frontend build must pass. | Pass (planned) |

**Post-design re-check (after Phase 1)**: still passes. The design adds no endpoint, no state container, no external call and no stored derived value. No complexity tracking is needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-outdoor-comfort-tiles/
├── plan.md              # This file
├── research.md          # Phase 0: formula, rounding, rain wording, sun times, PSI keys, storage
├── data-model.md        # Phase 1: stored pollutant fields + derived FeelsLike / DaylightTimes
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── location-weather.md   # additive snapshot fields + UI readout contract
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
backend/
├── drizzle/
│   └── 0001_<generated>.sql        # NEW: ADD COLUMN x6 (via npm run db:generate)
└── src/
    ├── schema.ts                   # +6 nullable columns, +6 WeatherSnapshot fields
    ├── weather.ts                  # parse pollutants + reading time in fetchAirQuality; defaults null
    ├── weather.test.ts             # pollutant parsing, failure, unchanged call count
    ├── db.ts                       # defaultWeather + weatherToColumns/rowToLocation mapping
    └── routes/locations.test.ts    # response includes new fields, null for unrefreshed

frontend/src/
├── types.ts                        # +6 WeatherSnapshot fields
├── components/
│   ├── feelsLike.ts                # NEW pure: apparentTemperature, roundHalfUp1, band, umbrella, FeelsLike
│   ├── feelsLike.test.ts           # NEW
│   ├── sunTimes.ts                 # NEW pure: NOAA sunrise/sunset, SGT date, HH:MM formatting
│   ├── sunTimes.test.ts            # NEW
│   ├── Tiles.tsx                   # FeelsLikeTile, SunTile, expandable pollutant detail in AirQualityTile; grid order
│   └── Hero.tsx                    # TileGrid gets the location's latitude/longitude (today it receives only `weather`)
docs/
└── architecture.md                 # snapshot fields + derived readouts paragraph
```

**Structure Decision**: Use the existing two-workspace layout. The pure modules sit next to `format.ts` in `frontend/src/components/`, following the `map/mapHelpers.ts` pattern. The grid stays 2 columns on mobile and 4 on large screens. The Feels like tile spans 2 columns so the three rows fill evenly: Condition / Air quality / Wind (span 2); UV / Temperature / Rainfall / Humidity; Forecast high / Sun / Feels like (span 2).

## Risks & Notes

- **CO unit** (mg/m³) and the other pollutant units are not yet confirmed from an NEA primary source (R7). This must be checked before release (quickstart step 5).
- **Formula source**: two secondary sources agree on it, but the Bureau of Meteorology page itself was not reached (R1). Medium-high confidence.
- **Rain vocabulary** comes from general knowledge (R4). Tests pin it, so a change in NEA wording will show up.
- **Sun-time references** for the tests must be taken from a published table during implementation (R5). If the NOAA version misses by more than 2 minutes, switch to `suncalc`.

## Complexity Tracking

No constitution violations. Not needed.
