# Research: Themed Lightning Bolt Markers and Refresh Timing

Every finding comes from reading the code on 2026-11-15. Background evidence is in `.specify/assessments/lightning-aggregation-and-icon/research.md`.

## 1. How to draw a bolt per strike

- **Decision**: A react-leaflet `Marker` with an `L.divIcon` whose HTML is an inline SVG bolt, built as a string. This follows the pattern in `frontend/src/components/map/pinMarkup.ts` and `weatherGlyphMarkup` in `icons.tsx`. The markers stay in the existing `lightning` pane (z-index 450, below the marker pane at 600, so pins stay on top: FR-008).
- **Rationale**: CSS can style an inline SVG, so the colour comes from theme variables with no JavaScript colour reading (Principle V). The divIcon pattern is already proven here, and no dependency is added.
- **Alternatives**:
  - Keep `CircleMarker` and add a bolt-shaped SVG path through a custom Leaflet layer. Rejected: a custom renderer class is much more code, and fill/stroke would need JavaScript colour values again.
  - Canvas-drawn icons. Rejected: they can't take CSS variables, and theme changes need a redraw.
  - Reuse `ThunderIcon` as is. Rejected: it's a cloud plus bolt drawn as strokes, the same glyph the thunderstorm pins use (`ConditionIcon` maps `thunder` to it), so it would break FR-002.

## 2. Telling strikes apart from thunderstorm pins (FR-002)

- **Decision**: The strike mark is a **solid, filled bolt silhouette with no cloud and no chip**. It has a contrasting outline and sits centred on the strike's position. Pins remain labelled chips with a stroked cloud-and-bolt glyph and a dot below. A new `STRIKE_BOLT_PATH` is defined. It's a single closed bolt polygon, so it reads at 14–24 px.
- **Rationale**: Three differences together: filled versus stroked, bolt only versus cloud plus bolt, and a bare mark versus a labelled chip. Any one alone could be lost at small size. All three together hold up.

## 3. Theme colour and legibility (FR-003, FR-004, SC-003)

- **Observed**: `--lightning` is defined per theme (yellow on apple/glass/radar/singapore, pink/red on sticker/memphis). `LightningLayer` currently reads it through `getComputedStyle`, plus a **literal** outline `rgba(20, 25, 40, 0.85)` and a literal fallback `#ffd21f`. Yellow fill on the light basemaps (voyager, light_all) is roughly 1.3–1.5:1, so the dark outline alone carries the contrast there today.
- **Decision**: Add a per-theme variable **`--lightning-outline`** next to `--lightning` in every theme block. A dark ink goes on themes with a light basemap (apple, glass, sticker, memphis). On dark-basemap themes (radar, singapore) the outline is a dark separator and the bright fill carries the contrast, so pick values that pass 3:1 against `dark_all`. The SVG uses `fill: var(--lightning)` and `stroke: var(--lightning-outline)` in CSS, so a theme switch restyles every mark with no re-render and no data request (FR-003). The literal outline, the fallback colour and the `getComputedStyle` read are removed.
- **Legibility rule (FR-004 at every age)**: the **outline is never faded**; only the fill fades. The full-strength outline keeps 3:1 against the map on every theme whatever the fill opacity. On dark basemaps, the fill's lowest opacity is set so the fill still reaches 3:1 there (checked per theme in quickstart §3, and a per-theme floor is allowed).
- **Theming docs**: `docs/theming.md` gets a line for `--lightning-outline`, as the constitution's Development Workflow requires.

## 4. Showing age (FR-005, SC-002) without re-rendering hundreds of icons

- **Observed**: today, `strikeStyle()` maps age linearly to opacity 1.0 → 0.15 and radius 8 → 5 px, recomputed on a 30 s tick.
- **Decision**: Keep a linear age model but **quantise it into 12 five-minute steps**. Each step sets a box size (24 px newest down to 14 px oldest) and a fill opacity (1.0 down to the theme's floor, default 0.25). Icons are cached per step, so all strikes share at most 12 `divIcon` objects. A tick only calls `setIcon` on strikes that crossed a step, not on every strike.
- **Rationale**: SC-004 asks for smooth panning with 370 strikes. Rebuilding 370 icons every 30 s would cost far more than the circles do today. Five-minute steps are still clearly ordered for 2/30/55-minute strikes.
- **Alternatives**: continuous opacity via the `Marker` `opacity` prop. Rejected: it fades the outline too, which breaks the contrast rule in §3.

## 5. Touch, keyboard and overlap (FR-006, FR-007)

- **Decision**: The icon's hit box is the full box (14–24 px). That's at least the size of today's circles (10–16 px diameter plus stroke), so FR-007's "at least as easily" holds. The markers use `keyboard: false`, matching today's circles, which aren't in the Tab order. That keeps 370 strikes from becoming 370 Tab stops. `riseOnHover` is off so the stacking stays steady. Overlap stays visible because the fill is semi-transparent and every mark has an outline (FR-006).
- **Popup**: the existing `Popup` content (`formatStrikePopup`) is unchanged.

## 6. Where the wait goes: server timing (FR-010, FR-011)

- **Observed**: `ProviderRequester.getJson` queues for a pacing slot (`~1,717 ms` apart without a key), applies an 8 s timeout, and retries a 429 once after 10 s. It reports none of this. `SingaporeLightningClient` makes 1–4 page requests and has three ways to return: cache hit, shared in-flight request, and fresh load.
- **Decision**: `getJson(url, stats?)` gets an optional `RequestStats` accumulator. It adds the request count, time spent waiting for a pacing slot, 429 retries, and retry wait. `SingaporeLightningClient` builds one `LightningTiming` per call and logs it once at `info` (`msg: 'lightning refresh timing'`). It covers how the request was served (`cache` / `shared` / `fetch`), pages, requests, pacing wait, retries and retry wait, provider time, strike count and outcome. The route sends the same figures in a standard **`Server-Timing`** response header, so the browser can show the split next to its own numbers.
- **Rationale**: a stats object that callers can leave out keeps the location-refresh callers unchanged and adds no requests (FR-011). `Server-Timing` is a standard header shown by DevTools. It lets the browser console line hold the full breakdown without changing the JSON contract. No URL, header value or key is logged; only numbers and enums are.
- **Alternatives**: a `timing` field in the JSON body. Rejected: it widens the API contract for a diagnostic. Logging inside `ProviderRequester` itself. Rejected: it can't tell which feature a request belonged to.

## 7. Where the wait goes: browser timing (FR-010, FR-012)

- **Decision**: `refreshLightningData` in the store records `performance.now()` when the user acts, and again when the response arrives (it reads the `Server-Timing` header). `LightningLayer` reports "drawn" from a `requestAnimationFrame` after the commit that drew that observation. A pure module, `lightningTiming.ts`, turns these into one `console.info('[lightning] refresh timing', {...})` record. A store-side early return because the data is still fresh (under 2 minutes) logs a `served: 'reused'` record with no network time.
- **Rationale**: the spec's clarification (option A) puts timing only in developer diagnostics. `console.info` doesn't trip the e2e `assert_clean` check, which fails only on `console.error`. The formatting and header parsing are pure and testable under Principle IV.
- **Alternatives**: `logInteraction` to the server log. Rejected as the only channel: the drawing time exists only in the browser, though the console record can also be sent there later if wanted.

## 8. A busy window to test with

- **Observed**: `LIGHTNING_FIXTURE=demo` (dev only, ignored in production) serves 3 strikes. The e2e harness serves the production build, where fixtures are off.
- **Decision**: add `LIGHTNING_FIXTURE=busy`. It serves about 370 deterministic strikes across the region and the hour, with a few near-duplicates, so SC-004 and the drawing baseline can be checked by hand in dev. The browser check (`scripts/e2e/lightning-markers.sh`) stubs `POST /api/lightning/refresh` with agent-browser's network routing instead, so it works against the production build. To verify: if this agent-browser version can't route requests, the script runs against a dev server the script starts with `LIGHTNING_FIXTURE`, still with its own teardown.

## 9. Constitution touchpoints

- Principle I is untouched: no change to when or how often lightning is fetched, nothing is stored, and the 2-minute cache stays.
- Principle III: `createApp({ lightningClient })` injection is unchanged, and the fake client in tests can return timing-free observations.
- Principle V: the literal colours in `LightningLayer` are removed in favour of theme variables.
