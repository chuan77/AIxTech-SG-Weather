# Research: Lightning Strike Grouping for Storm-Scale Volumes

**Feature**: [spec.md](./spec.md) | **Date**: 2026-11-16

Inputs: the assessment in `.specify/assessments/lightning-strike-grouping/` (especially `diagnostics.md`) and benchmarks run on 2026-11-16 against the captured 37,242-strike window. That window is now saved at `backend/fixtures/lightning-storm-2026-11-16.json.gz`. The benchmarks used Node 26 on the owner's laptop.

## 0. Root cause (from diagnostics, the basis for every decision below)

Today each strike is one Leaflet `L.Marker` with a divIcon. Adding a marker calls `map.on()` for its `zoomanim`, `zoom` and `viewreset` handlers. `Evented._on` scans every existing listener of that type for duplicates (`leaflet-src.js:516`, `655-677`), so N markers cost about N²/2 comparisons. Each divIcon also parses its HTML through `innerHTML` (`leaflet-src.js:11086`). Measured: 15.1 s blocked at 37,242 strikes and 17.9 s more when opening fullscreen, because the card map's layer stays mounted. React, layout, paint, JSON and the network were minor.

**What follows**: the only effective fix is to bound the number of Leaflet markers that exist at once. Everything else is secondary.

## 1. Clustering approach

- **Decision**: `supercluster` **9.1.0** (published 2026-09-03; ESM; ships its own types; one dependency, `kdbush`), run **in the browser on the main thread**. It only computes groups. The app draws the results itself with plain Leaflet markers (see §2).
- **Rationale**:
  - **Fast enough**: indexing all 37,242 strikes took **27–40 ms**, and 7 `getClusters` queries took 4–8 ms (Node, warm). Even at 4× CPU slowdown (about 110–160 ms), that's inside SC-002's 500 ms.
  - **Bounded**: it returns at most one feature per cluster radius on screen, so the marker count depends on the viewport, not on the strike count (§3).
  - **Fits the theme rule**: it does no drawing, so it brings no CSS or colours of its own (Principle V).
  - **Recency for free**: `map`/`reduce` options carry the newest strike time per group, which gives FR-003's recency.
  - **Splitting**: `getClusterExpansionZoom` and `getLeaves` give FR-005's zoom-to-split and the list popup.
  - **Approved**: the owner approved a proven third-party library (decision.md).
- **Alternatives considered**:
  - **Leaflet.markercluster 1.5.3**. Its last release is from 2021. It still needs one `L.Marker` object per strike (37K objects, each with icon options), builds its cluster tree out of Leaflet objects, and brings its own cluster CSS and animations that would need overriding for every theme. Its chunked loading spreads the work rather than removing it.
  - **Grouping on the server** (a grid or H3 per zoom and bounding box). Every pan or zoom would need a new request to our backend: a new API surface, latency on every gesture, and more surface area near the Principle I lightning exception. It isn't needed, because the index is cheap in the browser and compression already shrinks the payload (§5).
  - **A Web Worker** for indexing. Unnecessary at 27–40 ms. Kept as a fallback if SC-002 fails on a real phone.
  - **Canvas or WebGL drawing (Option D)**. Not needed once the marker count is bounded. Kept as the fallback for single bolts if bounded DOM drawing misses SC-001 (quickstart §4 measures this).

## 2. Drawing: one imperative layer, diffed

- **Decision**: replace the per-strike react-leaflet `<Marker>`/`<Popup>` children with one `LightningLayer` that owns an `L.LayerGroup` in the existing `lightning` pane (z-index 450, below pins). On every data change, theme change, age tick and `moveend`/`zoomend`, it:
  1. asks the index for the marks in view, using the map bounds padded by 25%, at the current zoom;
  2. diffs them against the marks already on the map, by a stable key;
  3. removes only marks that went away, adds only new ones, and calls `setIcon` only where a mark's appearance changed (age step, count label or age label).

  Popups for single bolts and list popups for unsplittable groups are created **on click**, not up front. Markers keep `keyboard: false` and `riseOnHover: false` (FR-018). Icons come from a small cache keyed by `(kind, step, countLabel, ageLabel)`.
- **Rationale**: the N² cost then applies only to at most a few hundred marks. Diffing means a pan adds and removes only the edges. An age tick re-icons only marks whose step or label changed. React no longer reconciles thousands of elements.
- **Alternatives considered**:
  - **Keep react-leaflet `<Marker>` per visible mark.** It works at a few hundred marks, but React would re-render the list on every pan. Popups as React children would come back, and so would React's overhead.
  - **Clear and redraw all visible marks on every move.** Simpler, but every pan would pay for removing and re-adding everything (each with an O(N) `off` scan), and marks would flicker.

## 3. Cluster radius and zoom range

- **Decision** (revised 2026-11-16 during implementation, owner's choice): `radius: 40` px (first planned as 60), `minPoints: 2`, `minZoom: 0`, `maxZoom: 20` (the map's `maxZoom`, so groups still form at the deepest zoom). A group whose expansion zoom is above 20 is **unsplittable** and opens the list popup (FR-005). These are named constants in one pure module, so the quickstart can tune them.
- **Measured marks in view** (viewport padded 1.4× each way):

| Window | Viewport | z11 | z12 | z13 | z15 |
|---|---|---|---|---|---|
| Storm 37,242, r60 | card 900×320 | 188 | 274 | 305 | 301 |
| Storm 37,242, r60 | fullscreen 1280×900 | 296 | 603 | 939 | 1,191 |
| Storm 37,242, r60 | phone 390×800 | 177 | 260 | 302 | 336 |
| Storm 37,242, r40 | fullscreen 1280×900 | 521 | 1,079 | 1,858 | 2,354 |
| Busy 370, r60 | fullscreen 1280×900 | 213 (190 single) | 53 (all single) | 12 | 0 |

- **Rationale**: at r60 the worst case (desktop fullscreen at about z15) is about 1,200 marks. From diagnostics, 5,000 DOM markers cost 180 ms per full pass on desktop, and the cost falls with N², so about 1,200 costs well under 50 ms. Diffing makes most passes much smaller. Phone viewports stay at or under about 340 marks, inside the inferred 1–2K phone budget even with a full redraw at 4× slowdown. The busy fixture stays almost all single bolts at the default zoom (FR-007, SC-006). The deepest-zoom data has at most 3 strikes at an identical position (737 such positions), so list popups stay short.
- **Revision (implementation, 2026-11-16)**: on the busy fixture at the default zoom (z11), r60 grouped 99 of 370 strikes, r40 grouped 55 and r24 grouped 29. A 14–24 px bolt "truly overlaps" well under 60 px, so r60 grouped more than FR-007 intends. In the browser storm check (37,242 strikes, desktop), r60 gave a longest task of 89 ms with up to 618 marks, and r40 gave 81 ms with up to 1,100 marks. Both are well inside 200 ms. The owner chose **r40**. The phone check (T042) must confirm SC-002 at r40; if it fails, the fallback is r60.
- **Alternatives considered**: r24 groups the fewest normal-day strikes but roughly doubles storm marks again (untested in the browser). r60 has the most phone headroom but groups more spread-out strikes on normal days. r80 or more merges normal-day strikes even sooner.

## 4. Group mark design (FR-002, FR-003, FR-004)

- **Decision**: a circular mark, distinct from the pill-shaped location pins and the bare bolt. It has three parts:
  - **Core disc**: always the solid theme `--lightning`, never faded. It carries a small bolt glyph and the abbreviated count ("12", "980", "1.2k", "37k") in a new per-theme `--lightning-ink`.
  - **Age label**: a small tab under the disc in the same ink-on-lightning colours, reading "now", "2m" … "59m".
  - **Halo ring**: around the core, filled with `--lightning` at the same fading opacity formula as bolts (`--lightning-fill-floor` plus `--strike-fresh`), inside a constant `--lightning-outline` stroke.

  Recency therefore shows twice: the halo fades, and the label states the age in text, so it doesn't rely on colour. Mark size grows slightly in three bands by count (under 100, under 1,000, 1,000 and over): 28, 32 and 36 px as built. The first plan was 36/42/48 px, but at the 40 px radius those overlapped into a solid carpet in the storm screenshot.
- **Rationale**: the text never sits on a faded fill, so 4.5:1 only has to hold between `--lightning-ink` and `--lightning`, which is one pair per theme. The constant outline already gives 3:1 against each basemap (docs/theming.md). Being circular with a count, it can't be mistaken for a pin (pill with weather icon and °) or a single bolt.
- **Alternatives considered**: fading the whole mark, text included, breaks 4.5:1 at the old steps. Colour-only recency was rejected in clarification Q2.

## 5. Payload size (FR-013, SC-005)

- **Decision**: add the `compression` middleware (**1.8.2**, Express 4 compatible; gzip, and brotli when the client accepts it) in `createApp` before the routes. The `POST /api/lightning/refresh` JSON shape is **unchanged**.
- **Measured** on the 37,242 window: raw 6,377 KB → **gzip 545 KB**, **brotli 335 KB**. A compact array format would give 921 KB raw / 181 KB gzip.
- **Rationale**: gzip alone is well under the 1.5 MB cap (SC-005) with no contract change and no frontend parse change. Every strike reaches the browser, so counts, groups and the Hero's 10 km check stay exact (FR-013, FR-014). It also compresses the HTML, JS and CSS for free.
- **Alternatives considered**: a compact array format (another 3× smaller) would change the contract, the types and the tests for a gain the spec doesn't need. Revisit if a real phone on a mobile network struggles. Sending only groups from the server was rejected because the browser needs every strike for zoom-in and the Hero check.

## 6. Fullscreen and the hidden card map (FR-009)

- **Decision**: `WeatherMap` gets a `showLightning` prop that is passed to `LightningLayer`. `MapCard` passes `showLightning={!expanded}`, so the card map's layer is emptied while fullscreen is open and redrawn (bounded) when it closes.
- **Rationale**: removes the doubled pass that cost 17.9 s at 37K. Even bounded, two layers would double every update.

## 7. Selecting a group (FR-005, clarification Q1)

- **Decision**:
  - **Fullscreen** (`interactive`): selecting a group zooms to `min(expansionZoom, 20)` centred on the group, using `flyTo`, or `setView` without animation under reduced motion (same rule as `FocusSelected`). If the expansion zoom is over 20, the list popup opens instead: up to 20 newest leaves via `getLeaves`, then "and N more".
  - **Card map**: `LightningLayer` calls a new `onGroupSelect(view)` callback. `MapCard` stores `view = { center, zoom }` as the fullscreen initial view and expands.
  - A marker click doesn't bubble to the map, so the card's background-tap-to-expand doesn't double-fire.
- **Rationale**: this is how the existing `initialView` path works (`MapCard` → `MapFullscreen`), so no new state container is needed (Principle II).

## 8. Age tick and window expiry (FR-010)

- **Decision**: the index is rebuilt **only** when the set of in-window strikes changes. That happens on a new observation, or when a 30 s tick finds strikes that passed 60 minutes. Each indexed point carries its strike time, and each group keeps the time of its newest strike. On a tick with no expiry, nothing is re-indexed: marks recompute their step and age label from the current time, and the diff calls `setIcon` only where those changed.
- **Rationale**: a tick costs at most one rebuild (≤40 ms desktop) plus re-icons of a few hundred marks. It never regroups unchanged strikes (FR-010, edge case "without visibly jumping").

## 9. Refresh timing record (FR-017, SC-007)

- **Decision**: drawing time is reported by `LightningLayer` itself:
  1. it records the start when it begins applying a new observation;
  2. it applies the index rebuild and the marker diff synchronously;
  3. then a **double** `requestAnimationFrame` reports `reportDrawn(observation, { groups, bolts })` after the frame that shows the marks.

  The record gains `groups` and `bolts` counts.
- **Rationale**: spec 007's single rAF fired from an effect that ran before the per-strike layers were added. It logged 141 ms against a 15.1 s freeze. Measuring inside the code that adds the markers, through to the next painted frame, covers the real work. SC-007 checks it against a trace (quickstart §5).

## 10. Storm replay fixture (FR-016, clarification Q4)

- **Decision**: move the capture (first saved under this spec's `data/`, 252 KB; fields `latitude, longitude, occurred_at, type, label`; `captured_at` 2026-11-16T09:08:37Z) to `backend/fixtures/lightning-storm-2026-11-16.json.gz`. Add `createStormLightningClient()` in `lightningFixture.ts`. It reads the file once with `zlib.gunzipSync`, shifts every `occurred_at` by `now − captured_at`, builds strikes with the same id rule as `normaliseStrikes`, and returns a `LightningObservation`. Wire `LIGHTNING_FIXTURE=storm` in `server.ts` next to `demo` and `busy`, with the same `NODE_ENV !== 'production'` guard and a warning.
- **Browser checks against the production build** can't use the fixture (the production guard) and can't pass 6 MB through `agent-browser network route --body` (argv size). The e2e script instead generates an init script from the fixture that replaces `fetch` for `/api/lightning/refresh` only. This technique was proven in diagnostics.

## 11. Count formatting (FR-012)

- **Decision**: `statusMessage` formats the count with `Intl.NumberFormat('en-SG')`, giving "37,242 strikes in the last hour". Group counts use a pure `formatGroupCount`: below 1,000 as is, then "1.2k" (one decimal below 10k), then "37k".

## 12. Dependencies and versions

| Package | Version | Where | Why |
|---|---|---|---|
| `supercluster` | 9.1.0 (exact pin; brings `kdbush` ^4.1.0) | frontend `dependencies` | clustering index (§1) |
| `compression` | 1.8.2 | root `dependencies` (the backend runs from the root workspace) | gzip/brotli (§5) |
| `@types/compression` | latest 1.x matching | root `devDependencies` | types |

No version in this table is newer than two weeks. Neither package is in CLAUDE.md's "fast-moving library" list. The supercluster API above was checked against its 9.1.0 README (`load`, `getClusters`, `getLeaves`, `getClusterExpansionZoom`, `map`/`reduce`, `maxZoom` capped at 30).
