# Decision: Group dense lightning strikes so the map stays usable during storms

- **Slug**: lightning-strike-grouping
- **Decided**: 2026-11-16
- **Verdict**: go (Option B)
- **Artifacts reviewed**: research.md | problem.md | concept.md | diagnostics.md (no intake.md; intake was skipped)

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | strong | Measured, not just reported: in the production build, the 37,242-strike window blocks the page for 15.1 s and opening fullscreen blocks it for another 17.9 s. Even 15K strikes blocks it for 1.2–1.8 s (8.5 s at 4× CPU). This happens during storms, exactly when lightning matters (diagnostics.md; problem.md). |
| Evidence strength | strong | A real captured window, replay runs at 370, 5K, 15K and 37K, and DevTools traces that name the root cause in Leaflet's source: listener registration that grows quadratically per `L.Marker` (`_listens`, `leaflet-src.js:655`) and one `innerHTML` parse per divIcon. Gaps are real phones, throttled networks and the exact safe marker count (diagnostics.md, Not covered). |
| Value vs. inaction | strong | Without a fix, the layer must be switched off during big storms. It's a known freeze before the public mobile release, and the cost grows about N² with storm size (problem.md, Cost of Inaction; diagnostics.md). |
| Feasibility / appetite | adequate | Medium appetite (2–4 weeks). A proven clustering library is now approved, which removes the home-grown-algorithm rabbit hole. The open risks are the themed group mark, consistent behaviour across zoom levels and the 30 s age update, and possibly a server-side part for payload size (concept.md, Option B). |
| Strategic fit | strong | Keeps the user-action-only lightning fetch and the shared rate budget (Principle I). Group marks can use the theme variables (Principle V). Supports the planned public mobile release. The background pre-fetch job was explicitly rejected (concept.md, Outside Input Reviewed). |
| Risk posture | adequate | The main risks are named, each with a check: per-strike popups give way to groups at low zoom (the owner accepted this by choosing B), group-mark legibility on 6 themes, the inferred phone budget of about 1–2K markers (untested), and the `drawMs` instrument under-reporting about 100×, which must be fixed before metrics rely on it. Canvas (Option D) is the fallback for single bolts. |

## Verdict & Rationale

**Go, for Option B: group dense strikes, show single bolts up close.** The owner chose B on 2026-11-16 and approved using a proven third-party clustering library. Problem validity and evidence are both strong: diagnostics turned "the map sort of hangs" into a measured, source-level root cause. That root cause directly favours B. The cost scales with the number of Leaflet markers, not with React, the network or what's visible. Per-strike tweaks (Option A) can't beat N². A Singapore crop (Option C) wouldn't shrink a storm that was 95% over the island. Canvas alone (Option D) fixes drawing but leaves 37K strikes unreadable when zoomed out. B bounds the marker count and keeps "where and how recently" readable at every zoom.

This reverses the per-strike-at-any-volume choice made in specs 002 and 007 (and `lightning-aggregation-and-icon` Option C). That reversal is justified by new evidence: 100× the volume those decisions assumed, with a measured freeze.

## If needs-clarification

- Not applicable.

## If go: Handoff to `/speckit-specify`

- **Problem**: During large storms (15K–37K strikes in an hour, mostly over Singapore), the lightning map blocks the page for seconds to tens of seconds, and fullscreen makes it worse. This happens exactly when users want to see where lightning is. Leaflet adds one marker per strike, and its cost grows about quadratically with the count.
- **Chosen approach**: Option B. When strikes crowd an area, show one themed group mark that tells how many strikes there are and how recent the newest is. Zooming in splits groups until single bolts with their popups appear, as today. Below a volume threshold, behaviour is unchanged from spec 007. Use a proven clustering library (owner-approved). Also included:
  - the card map's lightning layer stops drawing while fullscreen is open, so strikes aren't drawn twice;
  - the lightning refresh response is compressed;
  - the strike count gets a thousands separator ("37,242");
  - a storm-scale replay fixture (the captured 37,242-strike window, or an equivalent) so the case can be tested;
  - the refresh timing record is fixed so `drawMs` covers the full marker work.
- **In scope**: how strikes are drawn and grouped at every volume, in the card map and fullscreen, on all 6 themes; the group mark's look, count and recency; the hygiene items above.
- **Out of scope**: changing when or how often lightning is fetched (only on user action, the 2-minute shared cache, the shared rate budget), including any background pre-fetch job; incremental deltas; WebGL; a density heatmap; lightning history, alerts or trends; restyling single bolts, pins, basemaps or controls (beyond keeping group marks distinct); other layers' performance; changing the Hero's 10 km "near" rule (keep it consistent with the map).
- **Success metrics**: on the 37K replay, pan, zoom, layer toggle and fullscreen open or close cause no main-thread task over about 200 ms on desktop. Set a phone-class target (4× CPU) in the spec (baselines: load 15.1 s, fullscreen 17.9 s desktop; 8.5 s at 15K, 4× CPU). The 30 s age update has no visible stutter (baseline: up to a 7.9 s frame gap at 37K). Time from action to lightning visible is reported by a fixed timing record. Bytes per refresh go down from 6.5 MB uncompressed. The owner can name the busiest area and the most recent activity without opening a popup, on all 6 themes (qualitative). No regression at about 370 strikes (spec 002 SC-001, SC-004, SC-005, SC-007; spec 007 SC-004, SC-006).
- **Carried-forward open questions**:
  - Which library (Leaflet.markercluster, supercluster or similar), and does it fit the theme-variable rule and the bundle budget?
  - Group in the browser or on the server? This decides whether the 6.5 MB payload shrinks beyond compression without breaking the lightning fetch rules.
  - The volume or zoom threshold where grouping starts, and the phone-class marker budget (inferred at about 1–2K, untested).
  - How a group mark shows recency (colour, the age of the newest strike, or both), and how it stays distinct from location pins and single bolts.
  - How groups behave on the 30 s age update and on refresh without visibly jumping.
  - If single bolts drawn as DOM markers still exceed the budget once grouped, do they move to canvas (Option D's technique, reversing spec 007's canvas rejection)?
  - Do real phones and throttled networks match the 4× CPU stand-in? How often do 10K+ windows occur?
