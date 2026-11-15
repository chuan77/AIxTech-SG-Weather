# Idea Research: Faster lightning layer (area aggregation) and a themed bolt icon

- **Slug**: lightning-aggregation-and-icon
- **Created**: 2026-11-15
- **Evidence confidence (overall)**: medium (the code-path evidence is high; nobody has timed the slowness, so there are no measurements)

Idea as stated: on the shipped `specs/002-lightning-map-layer` feature, (a) loading takes a while "as it stores per lightning per lat,long", so aggregate strikes into ~100 m areas; (b) replace the circle markers with a lightning icon that follows the selected theme.

No `intake.md` exists for this slug. This note works from the user's request.

## Users & Demand

- The only signal is one stated observation from the project owner: loading "takes a while". There's no timing, strike count or network trace behind it. [source: user request, 2026-11-15] (confidence: low, stated rather than observed)
- The icon request is a stated aesthetic preference. No usability finding says circles are misread. The spec's SC-006 (≥90% of users can identify the newest strike) has no recorded result. [source: specs/002-lightning-map-layer/spec.md SC-006] (confidence: low)
- This is a single-user, single-device app, so "demand" means the owner's own experience. [source: spec.md Assumptions] (confidence: high)

## Prior Art

**Internal: how loading works today (this contradicts the idea's premise)**

- Strikes are **not stored** per lat/long. Nothing goes to SQLite. The backend holds one 60-minute window in memory for 2 minutes (`FRESH_MS = 120_000`) and shares any request already in flight. [source: backend/src/lightning.ts] (confidence: high)
- The load cost is **upstream pagination plus pacing**. Each refresh asks for today's records 25 at a time (~50 min per page). It follows `paginationToken` for up to 3 pages, plus 1 page of the previous SGT date in the first hour after midnight. That means 1 to 4 sequential requests. [source: backend/src/lightning.ts `fetchRecords`, specs/002-lightning-map-layer/research.md §2] (confidence: high)
- All provider calls share one `ProviderRequester`. It spaces request starts at `ceil(10000/limit)+50` ms: **~1,717 ms without an API key** (6 req/10 s) and ~884 ms with one (12 req/10 s). Each request has an 8 s timeout, and an HTTP 429 gets one retry after 10 s. A 2-page refresh without a key therefore spends ≥1.7 s on pacing alone, and a 429 adds 10 s. If location refreshes run at the same time, they queue on the same requester. [source: backend/src/providerHttp.ts] (confidence: high for the mechanism; the real latency is unmeasured)
- Aggregating strikes after they are fetched happens **after** all of this, so it cannot shorten the network part. ASSUMPTION drawn from the code above (confidence: high)
- Rendering: one react-leaflet `CircleMarker` (an SVG path) per visible strike in a dedicated pane, re-rendered every 30 s. The map uses the default SVG renderer (no `preferCanvas`). [source: frontend/src/components/map/LightningLayer.tsx, WeatherMap.tsx] (confidence: high)
- Volume seen: 370 strikes in one window on 2026-11-12, of which only 22 were inside Singapore. The rest were in the wider region. [source: specs/002-lightning-map-layer/research.md §4] (confidence: high for that one sample)
- During planning, clustering was **considered and rejected** as "unnecessary at this scale" and an extra dependency. Overlapping strikes keep semi-transparent fills instead. [source: specs/002-lightning-map-layer/research.md §7] (confidence: high)
- "Strike density heatmaps" are listed as **out of scope** in the spec. Area aggregation moves toward that. [source: spec.md Assumptions] (confidence: high)

**Internal: themed icons already exist**

- `ThunderIcon` already exists, and the Hero colours it with `var(--lightning)` through `.hero-lightning svg`. [source: frontend/src/components/icons.tsx:179, frontend/src/index.css:139-141, Hero.tsx] (confidence: high)
- Every theme defines `--lightning`, and `LightningLayer` already reads it on theme change. The colours are Apple and Glass `#ffd21f`, Radar `#fff35c`, Sticker `#ff4d8d`, Memphis `#ff3d6e` and Singapore Sky `#ffe14a`. [source: frontend/src/index.css, docs/theming.md] (confidence: high)
- Location pins already render a React icon into `L.divIcon` through `renderToStaticMarkup`. That is a working in-repo pattern for HTML/SVG icon markers. [source: frontend/src/components/map/WeatherMap.tsx `makePinIcon`] (confidence: high)

**External**

- No external sources were fetched (see Sources). Comparable products such as lightning maps and weather apps were not checked. [UNVERIFIED — fetch skipped]

## Market & Context

- Cost of doing nothing: the layer works and meets its spec. Most of the time there is no lightning (spec.md edge cases call this "the most common case"), so the load cost and the visual look only matter during storms. [source: spec.md] (confidence: medium)
- Things that already reduce perceived wait: the 2-minute shared cache, the `loading` status strip, and keeping old strikes when a refresh fails. [source: lightning.ts, lightningHelpers.ts `statusMessage`] (confidence: high)

## Data & Constraints

- **Scale of a 100 m cell on this map.** Web-Mercator ground resolution at lat 1.3° is ≈156,543·cos(1.3°)/2^z m/px: **~76 m/px at the default zoom 11**, ~19 m/px at focus zoom 13, ~5 m/px at zoom 15. At default zoom a 100 m cell is about 1–2 px, well under the current 5–8 px marker radius. ASSUMPTION from the standard formula and `DEFAULT_ZOOM = 11` / `FOCUS_ZOOM = 13` [source: mapHelpers.ts, WeatherMap.tsx] (confidence: high for the arithmetic)
- **"100 m sq" is ambiguous.** 100 m² is a 10 m × 10 m cell; "100 m square" could mean 100 m × 100 m (10,000 m²). [NEEDS CLARIFICATION] (confidence: n/a)
- **Location accuracy of the source.** The NEA/data.gov.sg feed does not say how accurately it locates strikes. Lightning detection networks typically locate strikes to hundreds of metres or more, so a 100 m grid may be finer than the data's own precision. ASSUMPTION (confidence: low; not verified for this source)
- **Merge rate.** Strikes within a 60-minute window rarely fall within 100 m of each other across a ~370-strike regional spread, so a 100 m grid would probably merge few points. ASSUMPTION; never measured against a real window (confidence: low)
- **Strike shape.** Readings carry `type` (`C`/`G`), `text`, `datetime` and lat/lng strings. Aggregation would have to decide how a merged cell shows mixed types, the newest versus oldest time (which drives the fade, FR-006), and what the popup says (FR-007). [source: research.md §1, spec.md FR-006/FR-007] (confidence: high)
- **Icon rendering cost.** `divIcon` markers are HTML DOM nodes, which cost more per point than SVG paths. With hundreds of strikes, swapping circles for icons increases DOM work unless points are also reduced. ASSUMPTION based on general Leaflet behaviour (confidence: medium)
- **Theme and legibility constraint.** FR-015 requires the layer to stay legible on every basemap: voyager, dark_all and light_all. A thin bolt glyph at 5–8 px has less filled area than a circle and needs an outline to stay visible. [source: spec.md FR-015, themes.ts] (confidence: medium)
- **Constitution.** Lightning is the one allowed exception to snapshot-only fetching, via `POST /api/lightning/refresh` on user action. Any change must keep that, and "any further exception requires its own amendment". [source: .specify/memory/constitution.md] (confidence: high)
- **Testing constraint.** Frontend tests cover pure helpers only (no DOM). An aggregation function would be easy to unit-test; an icon's look would not be. [source: specs/002-lightning-map-layer/research.md §10] (confidence: high)

## Evidence Against the Idea

- **The aggregation half targets a cause the code does not show.** Strikes aren't stored per lat/long, and the visible delay is most likely 1–4 paced upstream requests (~1.7 s apart without a key, with a 10 s 429 back-off). Aggregation runs after the fetch and wouldn't shorten it. [source: lightning.ts, providerHttp.ts]
- **A 100 m cell would probably change little.** At the default zoom it is ~1–2 px, smaller than one marker. It may be finer than the source's location accuracy and would likely merge few strikes. [ASSUMPTION, see Data & Constraints]
- **It reopens a closed decision.** Clustering was rejected at planning, and density heatmaps are out of scope. [source: research.md §7, spec.md]
- **The icon may hurt clarity.** Location pins already show condition icons, and a thunderstorm pin uses the same `ThunderIcon` glyph. Bolt-shaped strike markers could be confused with "thunderstorm forecast at this saved place". [source: ConditionIcon.tsx and Hero.tsx import ThunderIcon; WeatherMap.tsx `makePinIcon`]
- **Icons cost more per point** than SVG circles, which works against the performance goal unless the point count also drops. [ASSUMPTION]
- **No measured problem.** There's no timing, profiling or count of strikes on screen when it felt slow. The slowness could be network, pacing, 429 back-off or rendering, and the fixes for each are different. [source: absence of data]

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Where does the time go? Measure `POST /api/lightning/refresh` server time (number of pages, any 429) versus time to draw markers in the browser, during a real storm.]
- [NEEDS CLARIFICATION: Is an API key configured? It halves request spacing (~1.7 s → ~0.9 s).]
- [NEEDS CLARIFICATION: Is "100 m sq" meant as 10 m × 10 m or 100 m × 100 m? Is the goal fewer markers on screen (visual) or a faster load (latency)?]
- [NEEDS CLARIFICATION: How accurately does the NEA lightning feed locate strikes? This bounds any sensible cell size.]
- [NEEDS CLARIFICATION: How many strikes were on screen when it felt slow, and at what zoom?]
- [NEEDS CLARIFICATION: Should a bolt icon be visually distinct from the thunderstorm condition icon on location pins?]
- [NEEDS CLARIFICATION: Should the icon keep the age fade (FR-006) through opacity, size, or both?]
- The real-strike shape was re-verified on 2026-11-12, but merge rate has never been measured against a real window.

## Sources

- specs/002-lightning-map-layer/spec.md, research.md (host: local repo, policy: n/a)
- backend/src/lightning.ts, backend/src/providerHttp.ts, backend/src/lightningFixture.ts (host: local repo, policy: n/a)
- frontend/src/components/map/LightningLayer.tsx, lightningHelpers.ts, WeatherMap.tsx, mapHelpers.ts; frontend/src/components/icons.tsx, Hero.tsx; frontend/src/index.css; frontend/src/theme/themes.ts; docs/theming.md (host: local repo, policy: n/a)
- .specify/memory/constitution.md (host: local repo, policy: n/a)
- https://api-open.data.gov.sg/v2/real-time/api/weather?api=lightning (host: api-open.data.gov.sg, policy: unrecognized host, not fetched [UNVERIFIED — fetch skipped]; live timing and accuracy left as gaps)
