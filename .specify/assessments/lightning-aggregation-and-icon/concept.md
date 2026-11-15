# Concept: Themed lightning markers, with the wait measured before it is fixed

- **Slug**: lightning-aggregation-and-icon
- **Created**: 2026-11-15
- **Recommended option**: Option A (Measure the wait, and ship a themed bolt marker)

## Options

### Option A: Measure the wait, and ship a themed bolt marker

- **Sketch**: Strikes stop being plain circles and become a small bolt mark. It takes the active theme's existing lightning colour and has an outline so it stays visible on light and dark basemaps. Newer strikes still look stronger than older ones, and tapping one still shows its type and time. The bolt is drawn so it can't be mistaken for the thunderstorm condition icon on saved-location pins (for example by shape, framing or size). Alongside this, the owner gets a way to see how long a lightning refresh took and why: pages fetched, rate-limit back-off, and drawing time. The next decision on speed can then rest on numbers. Strikes aren't grouped.
- **Appetite**: small (days)
- **Trade-offs**: Delivers the visual goal (recognisable, themed) now, and turns "feels slow" into a measured baseline (research.md Gaps; problem.md Success Metrics). It deliberately makes no speed claim. If the wait turns out to be upstream pacing, this option alone won't shorten it. A per-strike bolt is a heavier map element than a circle, so a 370-strike window may draw more slowly than today (research.md, Data & Constraints), and the measurement shows whether that matters.
- **Rabbit holes**: getting the bolt legible at 5–8 px across 6 themes and 3 basemaps (FR-015); keeping the age fade readable on a thin glyph (FR-006, SC-006); keeping it distinct from the pin thunderstorm icon; drifting from measurement into a full observability feature.

### Option B: Cut the visible wait at its likely source, plus the bolt marker

- **Sketch**: Everything in Option A, plus work aimed at the wait the owner actually feels. The most recent strikes appear as soon as the first portion of the hour arrives, and older ones fill in after. The status strip says the hour is still filling, so a partial map isn't read as "that's all". The setup guidance also makes clear that an API key roughly halves the wait. The request limit and user-action-only fetching stay exactly as they are.
- **Appetite**: medium (1–2 weeks)
- **Trade-offs**: Goes at the cause research points to: 1–4 paced requests about 1.7 s apart without a key, plus a 10 s back-off on a rate limit (research.md, Prior Art). The newest strikes, the ones that matter during a storm, would show sooner. The cost is a new "partly loaded" state on top of idle, loading, empty, unavailable and ok, which touches the status rules (SC-004). It also builds on a cause that hasn't been measured yet. If drawing turns out to be the bottleneck, this part is wasted.
- **Rabbit holes**: how a partial window interacts with the 2-minute shared cache and the "stale on failure" rule; the "no lightning" message being wrong while the hour is still loading; the hour crossing SGT midnight across two dates; pressure to add background refresh, which is barred by FR-013 and the constitution.

### Option C: Group nearby strikes into areas (the original idea), plus the bolt marker

- **Sketch**: Strikes close together on the map collapse into one mark showing how many there are. The newest strike in the group sets how prominent it looks, and tapping shows the count and time range. Grouping is either a fixed ground size (the requested ~100 m) or depends on zoom, so it stays meaningful at the default zoom.
- **Appetite**: medium (1–2 weeks)
- **Trade-offs**: Reduces clutter on busy days and the number of marks to draw, which offsets the heavier bolt marks. It doesn't shorten the fetch, the most likely cause of the wait (research.md, Evidence Against). A fixed 100 m area is about 1–2 px at the default zoom and would likely merge few strikes. It may also be finer than the feed's location accuracy (research.md, Data & Constraints). A zoom-dependent grouping fixes that, but it reopens clustering, which planning rejected in spec 002 research §7, and moves toward the out-of-scope density heatmap. Merged marks also blur per-strike type and time detail (FR-007).
- **Rabbit holes**: choosing a meaningful area size without knowing the feed's accuracy; mixed strike types in one group; how fading works for a group; regrouping on every zoom; keyboard and screen-reader access to grouped marks; a new map dependency.

### Option D: Do nothing

- **Sketch**: Keep circles and the current loading behaviour.
- **Appetite**: none
- **Trade-offs**: No risk and no cost, and the spec is already met (problem.md, Cost of Inaction). The owner keeps the unmeasured wait and the generic dots during storms.
- **Rabbit holes**: none.

## Recommendation

**Option A.** It fully meets two goals: strikes recognisable as lightning on every theme, and markers that feel part of the theme. It also meets the goal of understanding the wait before fixing it, which problem.md made a precondition because the stated cause ("stored per lat/long") doesn't match the code. It keeps every promise the shipped feature makes and fits a small appetite.

Option B is the most likely follow-up. Pick it up only if A's measurement shows the wait is mostly upstream fetching and longer than the owner's target. Option C isn't recommended: the evidence suggests a 100 m area wouldn't speed loading or noticeably reduce markers. Revisit it only if the measurement shows drawing many strikes is the bottleneck.

## Out of Scope (for the recommended option)

- Grouping or aggregating strikes by area, and density heatmaps.
- Any change to how or when lightning is fetched: no progressive loading, no fetch on page load, no background or periodic refresh, no change to the 2-minute shared cache or the request limit.
- Lightning alerts, notifications, history beyond 60 minutes, new distance features.
- Restyling saved-location pins, basemaps or map controls.
- Changes to the per-location snapshot or the database.
- A general performance or observability dashboard: measurement covers the lightning refresh only.

## Assumptions to Validate

- A bolt mark at roughly today's marker size stays legible and distinguishable on all 6 themes and their basemaps, with an outline.
- The age fade stays readable on a bolt, so spec 002 SC-006 (identify the newest of three strikes) still holds.
- The bolt can be made clearly distinct from the thunderstorm condition icon on location pins.
- Drawing one bolt per strike stays responsive at a busy-day volume (~370 strikes, the one sample from 2026-11-12). If not, Option C becomes relevant.
- The owner accepts "measure first" for the speed concern rather than wanting a speed change in this round.
- Lightning in a real storm (or a replay of a real window) is available to take the baseline measurement; on most days there are no strikes.
