# Idea Research: Lightning strike grouping for a layer that stays fast at storm volume

- **Slug**: lightning-strike-grouping
- **Created**: 2026-11-16
- **Evidence confidence (overall)**: medium. The code-path evidence is high. Volume and server cost are now measured (26,458 strikes, 7 ms server, 4.6 MB response), but the browser side of the hang isn't profiled yet.

Idea as stated: the lightning layer showed "15520 strikes in the last hour" and the map nearly hung ("sort hang", read here as "sort of hangs"). The owner wants strikes grouped so the layer stays fast.

No `intake.md` exists for this slug. This note works from the owner's request and the screenshot attached to it.

## Users & Demand

- **Observed, not just stated:** the status strip read "15520 strikes in the last hour, Updated 4:49 pm" while the owner experienced the map as hanging. [source: owner screenshot, 2026-11-16] (confidence: high for the count; medium for "hang", since it wasn't measured)
- In the screenshot, no bolts are visible in the zoomed-in view. Either the strikes fell outside that viewport or they hadn't been drawn yet. Which one isn't known. [source: owner screenshot] (confidence: low)
- Who is affected: the owner today. Memory records a planned public mobile release on laptop and mobile, where a hang at this volume would hit low-end phones harder. [source: memory `public-mobile-release`; ASSUMPTION that phones fare worse] (confidence: medium)
- The demand is new evidence against an earlier decision. Grouping was rejected twice before: in spec 002 as "unnecessary at this scale" and in `lightning-aggregation-and-icon` as Option C. Both rejections assumed about 370 strikes. [source: specs/002-lightning-map-layer/research.md §7; .specify/assessments/lightning-aggregation-and-icon/decision.md] (confidence: high)

## Prior Art

**Internal: how the layer draws today**

- One react-leaflet `<Marker>` with an `L.divIcon` (a `<div>` holding an inline `<svg>`) and a child `<Popup>` for **every** visible strike, all in one pane. The design target was about 370. [source: frontend/src/components/map/LightningLayer.tsx; specs/007-lightning-bolt-markers/plan.md "smooth at ~370"] (confidence: high)
- At 15,520 strikes that means about 15.5K React elements, about 15.5K Leaflet layers and about 46K DOM nodes (wrapper `div`, inner `div`, `svg` and `path` per mark). [source: LightningLayer.tsx, strikeMarker.ts; the node count is derived] (confidence: high)
- **The card map stays mounted while the fullscreen map is open.** Both render `LightningLayer`, so fullscreen doubles this to about 31K markers. [source: frontend/src/components/map/MapCard.tsx:36-66] (confidence: high)
- Every 30 s (`useNow(30_000)`) the whole list goes through `visibleStrikes`, `formatStrikePopup` and React reconciliation for each strike. Icons are shared across 12 age steps, so Leaflet only re-icons strikes that crossed a step. React still diffs all 15.5K each time. [source: LightningLayer.tsx, useNow.ts] (confidence: high)
- The Hero's `nearestStrike` scans every strike for the selected place. That is a linear haversine pass, cheap next to drawing the DOM. [source: frontend/src/components/Hero.tsx:62, lightningHelpers.ts; "cheap" is an ASSUMPTION] (confidence: medium)
- Canvas drawing was **rejected** in spec 007 because canvas can't use the CSS theme variables, and a theme change would need a redraw. [source: specs/007-lightning-bolt-markers/research.md §1] (confidence: high)
- Tab stops (`keyboard: false`) and hover raise (`riseOnHover: false`) were already turned off with volume in mind. [source: specs/007 research.md §4; LightningLayer.tsx] (confidence: high)

**Internal: how the data arrives**

- The backend asks for up to 3 pages for today, plus 1 page for the previous date near midnight. It keeps every valid strike in WGS84 range, with **no geographic limit**, because 94% of the 2026-11-12 sample was outside Singapore. There's no maximum strike count. [source: backend/src/lightning.ts `MAX_PAGES_TODAY`, `normaliseStrikes`; specs/002 research.md] (confidence: high)
- So 15,520 came from at most 4 pages. Each upstream record must carry thousands of readings in a storm. Upstream request count isn't the bottleneck at this volume. The payload size and the drawing are. [source: lightning.ts; the inference is an ASSUMPTION] (confidence: medium)
- Estimated JSON size: each strike has `id` (datetime|lat|lng, about 50 chars), lat, lng, `occurred_at`, type and label, so about 170–200 bytes. At 15.5K that is **about 2.6–3.1 MB uncompressed** per refresh. The same timestamp appears twice per strike. [source: LightningStrike shape in lightning.ts; byte size is an ESTIMATE, not measured] (confidence: medium)
- Timing instruments already exist from spec 007. A `[lightning] refresh timing` console record splits `networkMs` and `drawMs`, the server logs `lightning refresh timing`, and there's a `Server-Timing` header. They can measure the 15K case directly. No record from the 4:49 pm storm was captured. [source: frontend/src/components/map/lightningTiming.ts; backend/src/lightning.ts `report`] (confidence: high)
- The test fixture `LIGHTNING_FIXTURE=busy` makes about 370 strikes. It is 42× smaller than the volume seen, so SC-004 ("smooth at 370") was never checked at storm scale. [source: backend/src/lightningFixture.ts; specs/007 tasks.md T003, T012] (confidence: high)

**External (background knowledge, not fetched; see Sources)**

- Leaflet.markercluster is the common Leaflet answer. It has `chunkedLoading` for adding markers without blocking, and its README claims it handles tens of thousands of markers. It adds a dependency and its own cluster styling. [UNVERIFIED: background knowledge, fetch skipped] (confidence: medium)
- Supercluster (Mapbox) does grid/KD-tree clustering in plain JS, often in a worker, and it handles hundreds of thousands of points. It isn't Leaflet-specific and needs a custom draw. [UNVERIFIED: background knowledge] (confidence: medium)
- Leaflet's own `preferCanvas` / `L.canvas()` renderer draws vector layers into one canvas and handles 10K+ circle markers far better than SVG or DOM icons. It only works for vector layers, not `divIcon` markers. [UNVERIFIED: Leaflet 1.9 docs, background knowledge] (confidence: medium)
- Lightning maps such as Blitzortung/LightningMaps and weather radar apps usually show storm-scale volume as density or recent-only points, not one icon per strike. [UNVERIFIED: background knowledge] (confidence: low)

## Market & Context

- Cost of doing nothing: during regional storms the map, and possibly the whole page because it all runs on one main thread, freezes exactly when lightning matters most. The "lightning near you" Hero verdict depends on the same data, but its scan is cheap. [source: screenshot; Hero.tsx; the main-thread effect is an ASSUMPTION] (confidence: medium)
- What the owner does today: turn the lightning layer off (`LightningControl`, remembered in localStorage) or wait. [source: lightningHelpers.ts `LIGHTNING_STORAGE_KEY`] (confidence: high)
- Most hours have no strikes ("the most common case" in spec 002), so the problem is rare but severe when it happens. [source: specs/002 spec.md edge cases] (confidence: medium)
- Most of the 15K strikes are probably outside Singapore (the earlier sample was 94% outside). For a Singapore dashboard, many marks may sit off screen in the default view while still costing DOM. [source: specs/002 research.md; applying it to this storm is an ASSUMPTION] (confidence: low)

## Data & Constraints

- **Diagnosed (2026-11-16, see diagnostics.md):** a real window of **37,242 strikes, 95% inside Singapore**, at **6.5 MB**. Replayed in the production build: the card map blocks the main thread for **15.1 s** at 37K and **1.2 s** at 15K, and opening fullscreen blocks for another 17.9 s at 37K. The DevTools traces put the time in **Leaflet's quadratic listener registration per `L.Marker`** (`Evented._listens`, `leaflet-src.js:655`) and **one `innerHTML` parse per divIcon**. React, layout, paint, the network and JSON parsing are minor. Spec 007's `drawMs` under-reports the cost about 100×. [source: diagnostics.md; leaflet-src.js] (confidence: high on desktop; medium for phones, which were simulated with 4× CPU throttling)

- **Measured (2026-11-16, owner's dev server log):** one `POST /api/lightning/refresh` served **26,458 strikes** from the 2-minute cache. Server time was `totalMs: 7`, the full request took `responseTime: 23` ms, and the response body was **`content-length: 4,639,164` bytes (about 4.6 MB, about 175 B per strike)**. There was no `content-encoding` even though the browser accepts gzip/br, and the backend has no compression middleware. So **the server and the provider are not the bottleneck on a cached refresh**. The wait and the hang are on the client: transfer of 4.6 MB, `JSON.parse`, React rendering about 26K `<Marker>`/`<Popup>` elements, and Leaflet adding about 26K DOM icons. [source: owner-pasted pino log lines "lightning refresh timing" and "request completed"; `grep compression backend/` → none] (confidence: high for the server side; the split across client stages is still unmeasured)
- The fetch that filled that cache (`served: "fetch"`, with `pages` and `providerMs`) wasn't in the pasted excerpt, so the uncached upstream cost at this volume is still unknown. [source: same log] (confidence: high that it's missing)
- Volumes seen: 370 (2026-11-12, of which 22 were in Singapore), **15,520** (2026-11-16 4:49 pm, screenshot) and **26,458** (2026-11-16, server log). The largest is about 72× the design volume. [sources: specs/002 research.md §4; owner screenshot; owner server log] (confidence: high)
- Constitution Principle V: theme colours come from CSS variables. Any grouped or canvas mark must still follow the active theme (`--lightning`, `--lightning-outline`), which is why canvas was rejected before. [source: specs/007 research.md §1; docs/theming.md] (confidence: high)
- Constitution Principle I (lightning exception): lightning is fetched only on user action, cached for 2 minutes and shared. Grouping on the server would keep to this. Changing *when* data is fetched would not. [source: specs/007 decision handoff; .specify/memory/constitution.md] (confidence: high)
- Spec 002/007 behaviour that grouping would touch: one popup per strike (label, time, minutes ago), the 12-step age fade showing recency (SC-006: the newest of three strikes can be identified), visible overlap of near-duplicates (FR-006), and the status-strip count. [source: specs/007 spec.md; LightningLayer.tsx] (confidence: high)
- Spec 002 lists "strike density heatmaps" as out of scope. A grid-style grouping comes close to that. [source: specs/002 spec.md Assumptions] (confidence: high)
- The status-strip text "15520 strikes" has no thousands separator. That's a small display gap seen at this volume. [source: screenshot; lightningHelpers.ts `statusMessage`] (confidence: high)

## Evidence Against the Idea

- **Grouping may not be the cheapest fix.** Several mitigations that don't group could remove most of the hang: draw only strikes inside the current view plus a margin; stop mounting the card map's layer while fullscreen is open (halves the cost); create Leaflet markers imperatively instead of 15.5K React `<Marker>`/`<Popup>` children; or cap the count, for example the newest N or Singapore plus a buffer. None of these has been measured. [source: code analysis above; their effectiveness is an ASSUMPTION] (confidence: medium)
- **The bottleneck is client-side, but not proven to be drawing alone.** The server log shows the backend answering in 7 ms. That leaves the 4.6 MB uncompressed transfer, the JSON parse, React rendering and Leaflet's DOM work, which haven't been split apart (no browser `[lightning] refresh timing` record or Performance trace yet). Grouping only on the client wouldn't shrink the 4.6 MB payload or its parse. [source: owner server log; lightningTiming.ts] (confidence: medium)
- **Grouping loses per-strike detail** the earlier specs care about: per-strike popups, age at a glance (SC-006) and visible overlaps (FR-006). Cluster badges replace "where and how recent" with "how many". [source: specs/007 spec.md] (confidence: high)
- **It was rejected twice, with reasons.** The extra dependency, theme-token fit and the heatmap being out of scope still hold. Only the volume premise has changed. [source: specs/002 research.md §7; lightning-aggregation-and-icon decision.md] (confidence: high)
- **One storm, one sample.** How often 10K+ windows happen is unknown. If it's rare, a cap or "too many to draw" fallback may be proportionate. [source: none; frequency not measured] (confidence: low)

## Gaps & Open Questions

- [PARTLY ANSWERED: the server takes 7 ms at 26,458 strikes (cached), so the time is client-side. Still open: the split between the 4.6 MB transfer, JSON parse, React render and Leaflet DOM. Capture the browser `[lightning] refresh timing` record (`networkMs`, `drawMs`) and a Performance trace.]
- [NEEDS CLARIFICATION: How long does an uncached `served: "fetch"` refresh take at this volume (`pages`, `providerMs`)?]
- [NEEDS CLARIFICATION: Was the hang in the card map, in fullscreen (both maps mounted), or both? On desktop or mobile?]
- [NEEDS CLARIFICATION: How many of the 15,520 were inside Singapore or the default map view? Is the regional spread worth showing at full detail?]
- [NEEDS CLARIFICATION: How often do 1K+ and 10K+ strike windows happen? There's no history (lightning isn't stored).]
- [NEEDS CLARIFICATION: What must survive grouping: per-strike popups, the age fade, exact positions at high zoom?]
- [NEEDS CLARIFICATION: Is a new dependency (markercluster, supercluster) acceptable, or must it be in-repo code as before?]
- [NEEDS CLARIFICATION: Can the raw upstream response for the 4:49 pm window be saved as a replay fixture? `LIGHTNING_FIXTURE=busy` is 42× too small to test this.]
- [PARTLY ANSWERED: the payload is 4,639,164 bytes uncompressed at 26,458 strikes. Still open: the gzip/br ratio, since no compression is enabled today.]

## Sources

- Owner-pasted notes generated by Gemini, 2026-11-16: suggestions for canvas/WebGL, Supercluster or H3, viewport culling, background pre-aggregation, deltas and a Web Worker. Treated as **unverified AI-generated input, not evidence**. Its numeric claims ("freezes above ~2,000 nodes", "`drawMs`/`networkMs` spikes") are uncited and not measured here. Reviewed in concept.md. (host: n/a, policy: n/a)
- Owner-pasted dev server log (pino), 2026-11-16: "lightning refresh timing" (served cache, 26,458 strikes, 7 ms) and "request completed" (content-length 4,639,164, 23 ms). Request headers in the log weren't copied into this note. (host: local, policy: n/a)
- Owner screenshot of the map, "15520 strikes in the last hour, Updated 4:49 pm" (host: local attachment, policy: n/a)
- frontend/src/components/map/LightningLayer.tsx, strikeMarker.ts, lightningHelpers.ts, lightningTiming.ts, useNow.ts, MapCard.tsx, WeatherMap.tsx; frontend/src/components/Hero.tsx (host: local repo, policy: n/a)
- backend/src/lightning.ts, backend/src/lightningFixture.ts (host: local repo, policy: n/a)
- specs/002-lightning-map-layer/research.md and spec.md; specs/007-lightning-bolt-markers/spec.md, plan.md, research.md, tasks.md (host: local repo, policy: n/a)
- .specify/assessments/lightning-aggregation-and-icon/research.md and decision.md (host: local repo, policy: n/a)
- https://github.com/Leaflet/Leaflet.markercluster (host: github.com, policy: allowlisted, but not fetched because the fetch tool can't pin or expose the connected peer, which the URL policy requires [UNVERIFIED: fetch skipped])
- https://github.com/mapbox/supercluster (host: github.com, policy: allowlisted, not fetched for the same reason [UNVERIFIED: fetch skipped])
- https://leafletjs.com/reference.html (host: leafletjs.com, policy: unrecognized host, not fetched [UNVERIFIED: fetch skipped])
