# Implementation Plan: Lightning Strike Grouping for Storm-Scale Volumes

**Branch**: `009-lightning-strike-grouping` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-lightning-strike-grouping/spec.md`

## Summary

During large storms the lightning layer freezes the page: 15.1 s at 37,242 strikes, plus 17.9 s on opening fullscreen. The cause is that each strike is its own Leaflet marker, and Leaflet's cost of adding markers grows with N² (diagnostics.md).

The plan:
1. **Group in the browser** with `supercluster` 9.1.0. Indexing 37K strikes takes 27–40 ms.
2. **Draw only the marks in view** (groups and single bolts) through one imperative, diffed Leaflet layer. That bounds the work to a few hundred marks whatever the strike count (as built at a 40 px radius: about 500 on the card and 1,100 in desktop fullscreen at storm volume).
3. **Group marks**: circular, theme-coloured, with a count and an "Nm" age label, and a fading halo for recency.
4. **Zooming in splits groups**:
   - in fullscreen, a group zooms in until single bolts with popups appear;
   - in the card map, a group opens fullscreen on that spot;
   - a group that can't split at the deepest zoom lists its strikes.
5. **Smaller fixes**:
   - gzip/brotli `compression` on responses (6.4 MB → 545 KB, no contract change);
   - the card map's layer stays empty while fullscreen is open;
   - a thousands separator in the count;
   - the real storm committed as a 252 KB replay fixture (`LIGHTNING_FIXTURE=storm`);
   - a timing record that measures the actual drawing.

## Technical Context

**Language/Version**: TypeScript 5 on Node 26 (backend via `tsx`), React 18 + Vite 7 (frontend)

**Primary Dependencies**: Express 4, react-leaflet 4 / Leaflet 1.9.4, **new**: `supercluster` 9.1.0 (frontend; brings `kdbush` 4), **new**: `compression` 1.8.2 (+ `@types/compression`, root workspace)

**Storage**: none for lightning (Principle I: in-memory 2-minute server cache only). The new fixture file lives in `backend/fixtures/`, for development and tests.

**Testing**: vitest. Pure frontend modules in node (Principle IV); backend routes with Supertest and fake clients (Principle VI); agent-browser browser checks in `scripts/e2e/`; chrome-devtools-mcp traces for SC-002 and SC-007.

**Target Platform**: modern desktop and mobile browsers (public mobile release planned), one Node server

**Project Type**: web application (npm workspaces `frontend`, `backend`, one process)

**Performance Goals**: with the 37,242-strike replay, no main-thread task over 200 ms on desktop (SC-001) or over 500 ms at 4× CPU (SC-002); lightning visible within 2 s (SC-003); refresh at most 1.5 MB on the wire (SC-005); heap at most 100 MB (SC-008)

**Constraints**:
- lightning is fetched only on user action, with the 2-minute shared cache and the shared data.gov.sg rate budget, unchanged (FR-015);
- theme colours only through CSS variables, at WCAG AA (FR-004);
- the HTTP response shape is unchanged.

**Scale/Scope**: up to about 40K strikes per hour (37,242 observed); marks drawn per map bounded to about 340 (phone and card) or about 1,200 (desktop fullscreen, deep zoom)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I. Snapshot-only weather data, lightning exception | ✅ Pass | No change to when lightning is fetched, the 2-minute cache, or storage. Grouping and compression are browser-only and wire-only. The fixture is development-only behind `NODE_ENV !== 'production'`, like `demo` and `busy`. |
| II. One process, relative API | ✅ Pass | Same `/api/lightning/refresh`. `compression` is Express middleware in the same process. Lightning state stays in the single store; the group index is derived display state inside `LightningLayer`, not a second state container. |
| III. Injectable provider | ✅ Pass | `LightningClient` interface unchanged. The storm fixture is another `LightningClient`. |
| IV. Testing within real limits | ✅ Pass | All grouping logic (index options, mark building, labels, diffing, list popup rows) goes in the pure module `lightningGroups.ts`, tested in node with vitest. Leaflet/DOM glue stays thin. |
| V. Theme-driven UI | ✅ Pass (with work) | New per-theme token `--lightning-ink` in all 6 theme blocks, plus `.strike-group` CSS using `--lightning`, `--lightning-outline` and `--lightning-fill-floor`. Contrast ratios are recorded beside the values. `docs/theming.md` is updated. The `apple` reference design isn't otherwise changed. |
| VI. Testing and quality gate | ✅ Pass | The changed route behaviour (compression) gets Supertest coverage in `backend/src/routes/lightning.test.ts`. The fixture gets a test. `npm run verify` gates the work. |
| Technical constraints | ✅ Pass | No schema change. Two small dependencies, justified in research §1 and §5. No secrets. `RealtimeWeatherReadingsacrossSingapore/` isn't used; the fixture is a separate, trimmed, public-data file. |
| Workflow: docs updated in the same change | ✅ Planned | `docs/architecture.md` (lightning layer, compression, storm fixture) and `docs/theming.md` (`--lightning-ink`, group mark). |

**Post-design re-check (after Phase 1)**: still all pass. One deliberate reversal is recorded in the spec and the assessment: specs 002 and 007's "one mark per strike at any volume" becomes "group where crowded". That's a product decision, not a constitution deviation.

## Project Structure

### Documentation (this feature)

```text
specs/009-lightning-strike-grouping/
├── plan.md                    # this file
├── research.md                # Phase 0: decisions + benchmarks
├── data-model.md              # Phase 1: index, marks, diff, fixture
├── quickstart.md              # Phase 1: validation guide
├── contracts/
│   ├── lightning-refresh.md   # HTTP: unchanged body, compression, storm fixture
│   └── lightning-map-ui.md    # UI: DOM hooks, props, interactions, timing record
├── checklists/requirements.md
└── tasks.md                   # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── fixtures/
│   └── lightning-storm-2026-11-16.json.gz   # NEW: the 2026-11-16 capture
└── src/
    ├── server.ts               # + compression() before routes; + LIGHTNING_FIXTURE=storm
    ├── lightningFixture.ts     # + createStormLightningClient()
    ├── lightningFixture.test.ts# + storm fixture tests
    └── routes/lightning.test.ts# + compression tests (gzip / identity, Server-Timing kept)

frontend/src/
├── components/map/
│   ├── lightningGroups.ts      # NEW pure: index options, buildIndex, marksInView, formatGroupCount,
│   │                           #   ageLabel, sizeBand, diffMarks, listPopupRows, appearance keys
│   ├── lightningGroups.test.ts # NEW
│   ├── groupMarker.ts          # NEW pure: group mark HTML (count, age, size band) — no colours
│   ├── LightningLayer.tsx      # REWRITE: imperative diffed L.LayerGroup, on-demand popups,
│   │                           #   group select (zoom / list / onLightningGroupSelect), timing
│   ├── WeatherMap.tsx          # + showLightning, onLightningGroupSelect props
│   ├── MapCard.tsx             # + showLightning={!expanded}; group select → fullscreen view
│   ├── lightningHelpers.ts     # statusMessage uses Intl.NumberFormat('en-SG')
│   ├── lightningHelpers.test.ts# + "37,242 strikes…"
│   ├── lightningTiming.ts      # + groups, bolts on the record
│   └── lightningTiming.test.ts # + new fields
├── state/store.tsx             # reportDrawn(observation, { groups, bolts })
├── index.css                   # + --lightning-ink in 6 themes; + .strike-group styles
└── package.json                # + supercluster 9.1.0

scripts/e2e/lightning-grouping.sh   # NEW: storm replay browser check (SC-001, FR-009, SC-008)
docs/architecture.md, docs/theming.md   # updated
package.json                        # + compression, @types/compression
```

**Structure Decision**: the existing web-application layout (npm workspaces `frontend` and `backend` in one process). New logic goes into one pure, tested module (`lightningGroups.ts`) beside the existing pure map helpers. `LightningLayer.tsx` becomes thin glue between that module, Leaflet and the store.

## Design Notes (for /speckit-tasks)

- **Order of work**:
  1. Fixture and compression (backend, testable alone).
  2. `lightningGroups.ts` and its tests.
  3. Group mark markup and CSS tokens.
  4. The `LightningLayer` rewrite.
  5. `showLightning` and group-select wiring.
  6. The timing record.
  7. The count format.
  8. The e2e script.
  9. Docs.
- **Measure early**: once the `LightningLayer` rewrite draws the storm, run quickstart §4 and §5 before polishing visuals. If SC-001 or SC-002 fails with bounded marks, apply these fallbacks in order and stop when it passes:
  1. Clone a pre-parsed icon template instead of setting `innerHTML` for each mark.
  2. Lower the padding from 25% to 10%.
  3. Raise the radius to 80 px.
  4. Draw single bolts on canvas (Option D).
- **Reuse**: `strikeStep`, `strikeMarkup`, `STRIKE_STEPS` (`strikeMarker.ts`), `visibleStrikes`, `formatStrikePopup` and `nearestStrike` (`lightningHelpers.ts`, unchanged for the Hero), the `FocusSelected` reduced-motion rule, and the `initialView` path into `MapFullscreen`.
- **Spec 007 behaviour kept**:
  - the 12 cached bolt icons;
  - the age fade and outline rule;
  - `keyboard: false` and `riseOnHover: false`;
  - pane z-index 450;
  - the developer-console-only timing record.

## Complexity Tracking

No constitution violations to justify.
