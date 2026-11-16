# Concept: A lightning layer that stays usable at storm volume

- **Slug**: lightning-strike-grouping
- **Created**: 2026-11-16
- **Recommended option**: Option B: group dense strikes, show single bolts up close

## Options

### Option A: Make the per-strike layer cheaper (no grouping)
- **Sketch**: Every strike is still its own bolt, exactly as today. The work goes into doing less of it:
  - only strikes in or near the current view are on the map;
  - the card map stops drawing its strikes while fullscreen is open, so they aren't drawn twice;
  - the refresh response is compressed;
  - the 30-second age update stops touching strikes that haven't changed;
  - the strike count gets a thousands separator ("26,458").

  A replay of a real storm-scale window becomes the test case. Users see the same picture as today, just without the freeze, at least while zoomed in.
- **Appetite**: small to medium (one to two weeks). It's uncertain because the browser-side split is unmeasured.
- **Trade-offs**:
  - Wins: keeps every per-strike behaviour that specs 002 and 007 require (per-strike popup, age fade, visible overlaps, FR-006, SC-006), adds no dependency, and has the lowest design risk.
  - Sacrifices: no help when the user zooms out to the region. All 26K strikes are then in view, so culling saves nothing, and 26K overlapping bolts can't be read anyway. The "where and how recently" goal fails at storm volume even if the map stops freezing.
  - Compression shrinks the transfer (about 4.6 MB, ratio unmeasured), but the browser still parses all 26K strikes.
  - Risks: whether React and Leaflet can hold 26K markers smoothly at all is unknown. If they can't, A leads straight into B.
- **Rabbit holes**: viewport culling that redraws on every pan; tuning per-device thresholds; taking React out of the marker path, which overlaps with B.

### Option B: Group dense strikes, show single bolts up close (recommended)
- **Sketch**: When many strikes crowd an area, they appear as one themed group mark showing how many there are and how recent the newest one is. Zooming in breaks groups apart until single bolts with their popups appear, as today. At normal volumes (hundreds of strikes), users see what they see today. The rest of the package:
  - the grouping keeps the payload and the parse bounded at storm volume, not just the drawing;
  - the hygiene fixes from A (no double drawing in fullscreen, compression, a readable count);
  - the storm-scale replay as the test case.
- **Appetite**: medium (two to four weeks).
- **Trade-offs**:
  - Wins: meets every goal in problem.md. The map stays responsive at any volume because what's drawn is bounded by groups, not strikes. "Where and how recently" stays readable when zoomed out, with recency carried by the group mark. Normal volume is unchanged, and the storm case becomes testable.
  - Sacrifices: at storm volume and low zoom, single-strike popups and visible overlaps give way to groups. This reverses a decision made twice before (specs 002 and 007; `lightning-aggregation-and-icon` Option C) on new evidence: 72× the volume.
  - It needs a new visual, a themed group mark that reads well on all 6 themes and doesn't look like a location pin.
  - Possibly a new dependency, depending on the owner's answer.
  - Risks: theme-variable colouring of group marks (Principle V); legibility of the count and recency on small marks; marks visibly jumping between groups on each 30-second update.
- **Rabbit holes**:
  - Building a home-grown clustering algorithm instead of using a proven one.
  - Choosing group sizes per zoom level.
  - Deciding which strikes are shared between the Hero's "near you" check and the map.
  - Server-side versus browser-side grouping, which drives payload size and how zoom-in detail is fetched without breaking the lightning fetch rules (Principle I).
  - Animating groups as they split.
  - Sliding into the density heatmap that spec 002 ruled out of scope.

### Option C: Cap or narrow what's shown, plus a summary
- **Sketch**: At storm volume, the map shows only the newest strikes (a fixed cap) or only those within a set distance of Singapore. The status strip says "26,458 strikes in the region, showing the newest 2,000 near Singapore". Users get a responsive map and an honest count, but no regional picture.
- **Appetite**: small (days).
- **Trade-offs**:
  - Wins: the quickest route to "no freeze" and the smallest change to today's look.
  - Sacrifices: hides most of a regional storm, including where it's heading. The picture then depends on an arbitrary cap or radius, and the Hero and the map might disagree.
  - Risks: users read the map as complete when it isn't. Spec 002 deliberately kept regional strikes (94% of the sample). Without grouping or culling, the cap may still freeze the map on phones.
- **Rabbit holes**: choosing the cap or radius; explaining why a strike seen earlier has vanished.

### Option D: Draw every strike on one canvas (no grouping)
- **Sketch**: This comes from the owner's outside notes (see below). Every strike stays individual, but they're drawn as pixels on a single canvas instead of 26K page elements. Users keep per-strike positions, recency and popups (by hit-testing the nearest strike). Themes are kept by reading the theme's lightning colours and redrawing when the theme changes. Spec 002's circle version already read `--lightning` in code on theme change.
- **Appetite**: medium (two to three weeks), mostly to keep the bolt shape and the outline and fade rules from spec 007 on canvas.
- **Trade-offs**:
  - Wins: likely the biggest single drawing speed-up, it keeps every strike, and it adds no grouping concept for users.
  - Sacrifices: spec 007 rejected canvas for theme fit. That reason is weaker than recorded if a redraw on theme change is acceptable, but it's still a reversal.
  - The bolt shape needs custom canvas drawing (Leaflet's canvas only draws circles and paths).
  - It doesn't fix readability: 26K overlapping strikes zoomed out are still a smear.
  - It doesn't shrink the 4.6 MB payload or its parse.
- **Rabbit holes**: custom bolt drawing with outline, fade and high-DPI scaling; hit-testing and popups on canvas; keyboard and accessibility parity; it can turn into a WebGL renderer.

### Do nothing
- The owner and future users switch the layer off during big storms, which is when they want it most. The public mobile release takes on a known freeze. This is ruled out by problem.md's Cost of Inaction, but kept here for comparison.

## Outside Input Reviewed (owner's notes from Gemini, 2026-11-16)

The owner pasted AI-generated notes. They're treated as unverified suggestions, not evidence. The claim that the UI freezes "above ~2,000 nodes" is uncited, and so is the "`drawMs` and `networkMs` spikes" claim: no browser timing has been captured yet.

| Suggestion | Verdict for this concept | Why |
|---|---|---|
| Canvas or WebGL rendering instead of DOM/SVG markers | **Kept**, as Option D and as a way to draw B's single bolts | It speeds up drawing. It doesn't fix the zoomed-out readability that B's groups address, so it's a rendering choice for the spec rather than a competing concept. |
| Spatial clustering by zoom (Supercluster, or geohash/H3 grid buckets on the server) | **Kept**, this is Option B | Matches B. The client-versus-server and library-versus-grid choice stays a spec decision. |
| Viewport culling | **Kept**, in A and inside B | It helps when zoomed in, and it's free with clustering libraries. |
| A background job that pre-fetches and aggregates (stale-while-revalidate) | **Rejected** | The constitution's Principle I lightning exception allows fetching only on user action, with a 2-minute shared cache. A background job would break that and spend the shared rate budget. The server already answers in 7 ms from cache, so there's nothing to gain. Aggregating when a user's request comes in is still fine. |
| Incremental deltas since the last update | **Deferred** | Built on a wrong premise: lightning isn't polled, it refreshes only on user action, at most every 2 minutes. It needs per-client state and gap handling. Compression plus grouping is the cheaper way to shrink the payload. Revisit only if the transfer stays large after those. |
| Web Worker for parsing and clustering | **Deferred** | Worth it only if a trace shows parsing or clustering as long main-thread tasks. Server-side grouping would make it unnecessary. |

## Recommendation

**Option B.** It is the only option that meets both goals at storm volume. A fixes the freeze only while zoomed in, and leaves 26K unreadable bolts once zoomed out. D (canvas) fixes the drawing cost, but zoomed out it's still a smear, and the 4.6 MB payload is untouched. C fixes the freeze by hiding most of the storm. Canvas stays open as the way B draws its single bolts, if the replay trace shows DOM drawing is still costly once groups bound the count. B bounds what's drawn, keeps the picture readable at every zoom, and leaves normal-volume behaviour as specs 002 and 007 defined it. A's cheap hygiene fixes are folded into B, since they help at any volume:
- no double drawing in fullscreen;
- a compressed response;
- a readable count;
- a storm-scale replay as the test case.

B lines up with the success metrics as follows:
- **No long tasks during pan and zoom in a 26K replay**: what's drawn is bounded.
- **Visible-time and bytes-per-refresh baselines**: they become measurable and can shrink.
- **Owner can name the busiest area and the most recent activity**: group counts and recency make this possible.
- **No regression at about 370 strikes**: single bolts there are unchanged.

One prerequisite is cheap and comes first: capture the browser `[lightning] refresh timing` record or a Performance trace on the replay. That confirms where the time goes and sets the baseline for B's success metrics.

**Update after diagnostics (2026-11-16, see diagnostics.md):**
- **Root cause:** the freeze comes from the **number of Leaflet markers**, which costs about N² because of listener registration, plus one HTML parse per marker. It is not React, the network or the bytes. That rules out Option A, since per-strike tweaks can't beat N², and Option C, since this storm was 95% over Singapore, so a crop wouldn't shrink it.
- **Recommendation:** B still stands, because it bounds the marker count and keeps the storm readable. D (one canvas layer) is now a strong partner for drawing B's single bolts, or a fallback.
- **Budget:** about ≤1–2K DOM markers for phone-class CPUs, inferred from the measurements.
- **Timing record:** `drawMs` must be fixed before any success metric relies on it.

## Out of Scope (for the recommended option)

- Changing when or how often lightning is fetched: only on user action, the 2-minute shared cache, the shared data.gov.sg rate budget (constitution Principle I's lightning exception). This rules out a background pre-fetch job.
- Incremental delta updates between browser and server, and a WebGL renderer (deferred, see Outside Input Reviewed).
- A density heatmap or shaded-area layer (spec 002 non-goal).
- Lightning history, storm tracking or trends, alerts and notifications.
- Restyling single bolts, pins, basemaps or map controls, beyond telling a group mark apart from both bolts and pins.
- Performance work on other layers or the general page load.
- Changing what counts as "near" for the Hero (10 km), beyond keeping it consistent with what the map shows.

## Assumptions to Validate

- ~~The freeze is mostly browser work (rendering and DOM) and not only download and parse.~~ **Confirmed** by diagnostics.md: it's browser work, specifically Leaflet adding markers (about N²) and parsing each marker's HTML.
- A themed group mark can carry count and recency legibly on all 6 themes and stay distinct from location pins and single bolts. Check during specification with the theme tokens.
- Storm-scale windows happen often enough to justify a medium appetite. Unknown: lightning isn't stored. [problem.md open question]
- The owner accepts that, at storm volume and low zoom, per-strike popups give way to groups (it reverses specs 002 and 007's per-strike rule).
- A proven clustering approach (with or without a dependency) fits the theme-variable rule. Whether a new dependency is acceptable is still the owner's call.
- A real storm window, such as the 26,458-strike one, can be captured and replayed as a fixture. `LIGHTNING_FIXTURE=busy` (370) is far too small.
- Compression gives a meaningful cut to the 4.6 MB transfer. The ratio is unmeasured.
- Once groups bound the count, DOM-drawn bolts are fast enough. If the replay trace says otherwise, B's single bolts move to canvas (Option D's technique), which needs the owner to accept reversing spec 007's canvas rejection.
- The outside notes' "freezes above ~2,000 nodes" threshold is unverified. Find the real threshold on the replay, on desktop and on a mid-range phone, because it decides when grouping kicks in.
