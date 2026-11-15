# Problem Definition: Lightning layer feels slow and reads as generic dots

- **Slug**: lightning-aggregation-and-icon
- **Created**: 2026-11-15
- **Inputs used**: research.md (no intake.md; intake was skipped), user input

The idea came in as two solutions: "aggregate strikes into ~100 m areas" and "use a lightning icon". This note works back to the problems underneath them. Research found that the first solution's stated cause ("it stores per lightning per lat,long") doesn't match the code. So the loading problem below is framed around the experience, not that cause.

## Problem Statement

When the dashboard owner asks for the latest lightning during a storm, they wait an amount of time they find too long before strikes appear. The delay is unmeasured, and the code suggests it comes from paced upstream requests rather than from data volume. Once the strikes do appear, they are plain circles. They don't read as lightning at a glance, and they don't feel part of the selected theme. This matters during storms, the moment the layer exists for.

## Affected Users & Stakeholders

- **Users**: the dashboard owner, the single user of a single-device app. During a storm they wait on "Loading lightning…" after turning the layer on or pressing Refresh, then read a map of plain dots. [source: research.md, Users & Demand; this is a stated observation, not a measured one]
- **Users**: other users or viewers. [NEEDS CLARIFICATION: is anyone besides the owner affected? Research found no other user signal.]
- **Stakeholders**: the project owner, who is also the decider, the maintainer and the guardian of the constitution. They care that the provider's rate limit holds, that the user-action-only fetch exception stays, and that themes stay legible on every basemap. [source: research.md, Data & Constraints; .specify/memory/constitution.md]
- **Stakeholders**: data.gov.sg / NEA, the upstream provider. Its shared request limit (6 req/10 s without a key) bounds how fast any refresh can be. [source: research.md, Prior Art; backend/src/providerHttp.ts]

## Goals

- During a storm, the owner sees the last hour's strikes soon enough after acting that the wait doesn't feel like a problem. The target is not yet set (see Open Questions).
- The owner understands where the wait comes from (upstream fetch, rate-limit back-off or drawing) before anyone commits to a fix, so effort goes at the real cause.
- Strikes are recognisable as lightning at a glance on every theme and basemap. They don't get confused with the thunderstorm condition shown on saved-location pins.
- Strike markers feel visually part of the selected theme, as the rest of the map already does.
- Everything the shipped feature promises stays true: the age fade, per-strike detail, the empty and unavailable states, no fetch on page load, and at most one upstream refresh per 2 minutes.

## Non-Goals

- Changing when lightning is fetched (on page load, background polling or auto-refresh). This is barred by FR-013 and the constitution's exception.
- Raising request volume to the provider beyond the current shared limit.
- Lightning alerts, notifications, history beyond 60 minutes, or distance-to-strike features beyond what exists. These were out of scope in spec 002.
- Strike density heatmaps as an analytical feature. Out of scope in spec 002 unless the owner reopens it explicitly.
- Changes to the per-location weather snapshot or the database.
- Restyling anything on the map other than the lightning strikes (pins, basemaps, controls).

## Success Metrics

- Time from user action to strikes drawn, measured during a real storm or a replay of a real window, split into server time and browser drawing time. (Baseline: unknown, never measured. [NEEDS CLARIFICATION: target, e.g. under N seconds])
- Upstream requests per refresh and how often the 10 s rate-limit back-off happens. (Baseline: 1–4 requests by design, with ~1.7 s spacing without a key; the real distribution is unknown)
- Strikes on screen in a busy window, and whether the map stays responsive when panning or zooming. (Baseline: 370 strikes seen once on 2026-11-12; responsiveness was not measured)
- Owner can name a strike marker as "lightning" without the popup, and can tell it apart from a thunderstorm pin, on all 6 themes. Qualitative self-check. (Baseline: not assessed)
- Spec 002's SC-006 still holds: the newest of three strikes of different ages can be identified. (Baseline: not recorded)
- No regression in spec 002 SC-004 and SC-005: distinct empty and unavailable states, and ≤1 upstream request per 2 minutes. (Baseline: met by the current tests)

## Cost of Inaction

The layer keeps working and meets its spec. Most of the time there is no lightning, so the cost shows up only during storms. Then the owner waits an unmeasured few seconds (more after a rate-limit back-off) and reads a map of generic dots that only the status strip and popups identify as lightning. Nothing breaks, and no data or rate-limit risk comes from doing nothing. The loss is perceived slowness and a weaker visual identity at the moment the feature matters most.

## Open Questions

- [NEEDS CLARIFICATION: Where does the time go: upstream pages, 429 back-off, or drawing in the browser? Measure before shaping.]
- [NEEDS CLARIFICATION: Is an API key configured? It roughly halves request spacing.]
- [NEEDS CLARIFICATION: What wait would feel acceptable (target seconds)?]
- [NEEDS CLARIFICATION: Is the aggregation goal fewer markers on screen (visual clutter) or a faster load? Does "100 m sq" mean 10 m × 10 m or 100 m × 100 m?]
- [NEEDS CLARIFICATION: How accurately does the NEA feed locate strikes? This bounds any meaningful area size.]
- [NEEDS CLARIFICATION: How many strikes were on screen when it felt slow, and at what zoom?]
- [NEEDS CLARIFICATION: Must strike markers stay visually distinct from the thunderstorm icon on location pins?]
- [NEEDS CLARIFICATION: Is anyone besides the owner a user of this map?]
