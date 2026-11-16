# Diagnostics: the lightning layer at storm volume

- **Slug**: lightning-strike-grouping
- **Run**: 2026-11-16, about 17:00–17:30 SGT
- **Build**: `npm run verify` passed; production `frontend/dist` served by a temporary server (free port, throwaway database, torn down afterwards), never the `npm run dev` server
- **Tools**: agent-browser 0.42.0 (timings, long tasks, frame gaps, DOM and heap); chrome-devtools-mcp, run `--isolated --headless --no-performance-crux --no-usage-statistics` (performance traces, plus CPU throttling as a phone stand-in)
- **Data**: one real `POST /api/lightning/refresh` through the temporary server (1 user-equivalent action, 2 upstream pages). The browser runs replayed that window, cut down to N strikes, with the timestamps shifted to "now".

## The real window

| Measure | Value |
|---|---|
| Strikes in the last hour | **37,242** (types C and G) |
| Inside the Singapore box (lat 1.15–1.48, lng 103.6–104.1) | **35,532 (95%)** |
| Extent | lat 0.96–1.65, lng 103.25–104.32 |
| Response size | **6,530,165 bytes**, uncompressed |
| Uncached server refresh | 1,093 ms (provider 1,092 ms, 2 pages, 2 requests, pacing 12 ms) |
| Cached server refresh (owner's log, 26,458 strikes) | 7 ms server, 4,639,164 bytes |

The earlier assumption that most strikes are out in the wider region (94% on 2026-11-12) does **not** hold for this storm. It was over the island, so cropping to Singapore wouldn't reduce the load.

## Browser results (agent-browser, desktop 1280×900, no throttling)

| N strikes | Card: longest task | Card: DOM nodes | JS heap | Fullscreen (both maps): longest task | Pan: longest task | Zoom: blocked total | 30 s age tick |
|---|---|---|---|---|---|---|---|
| 370 | 0 (no long task) | 1,790 | 22 MB | none | none | none | none |
| 5,000 | 180 ms | 20,310 | 45 MB | 178 ms (9,993 marks) | 96 ms | 958 ms | none |
| 15,000 | **1,231 ms** | 60,311 | 96 MB | **1,924 ms** (29,979 marks) | **3,383 ms** | 3,428 ms | 69 ms, frame gap 550 ms |
| 37,242 | **15,132 ms** | 149,278 | **203 MB** | **17,868 ms** (74,415 marks; 297,534 DOM nodes) | 653 ms (after the freeze) | browser stopped responding | 239 ms, frame gap 7.9 s |

The agent-browser daemon lost contact with the page during screenshots and zooms at 15K and 37K. That's consistent with the main thread being blocked.

## Chrome DevTools traces: where the longest task goes

| Run | Longest task | JS self-time inside it | HTML parsing |
|---|---|---|---|
| Desktop, 15K | 1,812 ms | `_listens` (Leaflet) **1,018 ms**, `createIcon` 679 ms | 545 ms |
| Phone stand-in (4× CPU), 5K | 1,202 ms | `set innerHTML` 814 ms, `_listens` 225 ms | 441 ms |
| Phone stand-in (4× CPU), 15K | **8,544 ms** | `_listens` **4,898 ms**, `set innerHTML` 2,996 ms | 2,330 ms |

React rendering, style recalculation, layout and paint each take a few tens of ms at most. The DevTools "DOMSize" insight fires in every run. Traces: `trace-desktop-15k.json.gz`, `trace-phone4x-5k.json.gz`, `trace-phone4x-15k.json.gz` in the session scratchpad (not committed).

## Root cause

1. **Quadratic listener registration in Leaflet.** Adding a `L.Marker` calls `map.on(...)` for its `zoomanim`, `zoom` and `viewreset` handlers (`node_modules/leaflet/dist/leaflet-src.js:7797`, and `getEvents`). `Evented._on` first calls `_listens` (`leaflet-src.js:516`, `655-677`), which **scans every listener already registered for that event** to reject duplicates. Adding N markers therefore costs about N²/2 comparisons per event type. The measurements fit: 3× more strikes (5K→15K) costs about 7–10× more, and 2.5× more (15K→37K) costs about 8× more. Removing markers (toggling off, closing fullscreen, re-icon on an age step) goes through the same scan in `off`.
2. **One HTML parse per marker.** `L.DivIcon.createIcon` sets `div.innerHTML = options.html` for every marker (`leaflet-src.js:11086`), so 37K bolts mean 37K HTML parses of the SVG string, even though the 12 icons are shared. On a phone-class CPU this alone is about 3 s at 15K.
3. **Doubled by fullscreen.** The card map's layer stays mounted under fullscreen (`MapCard.tsx:36-66`), so opening fullscreen adds a second N-marker pass. At 37K that's 17.9 s.
4. **Not the cause:** the network or server (7 ms cached, 1.1 s uncached), JSON parse (≤45 ms locally for 6.2 MB), and React reconciliation.

## The built-in timing record under-reports

Spec 007's `[lightning] refresh timing` record logged `drawMs: 141` at 37K and `drawMs: 75` at 15K, while the page was blocked for 15.1 s and 1.8 s. The record fires from a `requestAnimationFrame` that runs **before** the Leaflet layer-adding work finishes, so it misses almost all of the drawing cost. Any success metric based on `drawMs` needs a fixed instrument (for example, time to the first frame after the markers are added, or long-task totals).

## What this means for the concept

- Cost scales with **how many Leaflet layers exist**, quadratically. It doesn't scale with what's visible, with bytes, or with React. Viewport culling helps only to the extent that it caps the layer count. Strikes here sit over the island, so they're mostly in view anyway.
- Remedies that work are the ones that bound the number of `L.Marker`s: grouping (Option B), or drawing many strikes as one layer (canvas, Option D). Option A's "cheaper per strike" tweaks can't beat N². Option C's Singapore crop wouldn't shrink this storm.
- A rough budget from these runs: individual DOM markers stay under about 200 ms per pass up to about 5K on desktop. On a phone-class CPU, even 5K blocks for 1.2 s, so the bound is closer to about 1–2K. (That's a bound inferred from the measurements, not tested at 1–2K.)
- Payload remains a separate cost for mobile: 6.5 MB uncompressed per refresh. It wasn't measured on a throttled network.

## Not covered

- Real phones (only 4× CPU throttling on desktop Chrome), and throttled networks.
- Memory pressure or tab crashes on mobile with a 200+ MB heap.
- Gzip ratio for the 6.5 MB response.
- The real browser behaviour at 1–2K markers (the inferred safe bound).
