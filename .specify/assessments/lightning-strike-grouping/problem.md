# Problem Definition: The lightning map freezes during large storms

- **Slug**: lightning-strike-grouping
- **Created**: 2026-11-16
- **Inputs used**: research.md, user input (no intake.md; intake was skipped)

The idea arrived as a solution ("group lightning strikes"). This note works back to the problem that grouping is meant to solve.

## Problem Statement

When a large regional storm produces thousands of strikes in an hour (15,520 and then 26,458 were seen on 2026-11-16, up to about 72× the volume the layer was designed and tested for), the dashboard's map becomes close to unusable. It hangs at exactly the moment people most want to see where the lightning is. Before a public mobile release, this matters more: it will reach users on weaker phones, and today's tests never cover that volume.

## Affected Users & Stakeholders

- **Users**:
  - **The owner (today's only user)**: experienced the map "sort of" hanging with the lightning layer on during a 15K-strike hour. [research.md, Users & Demand]
  - **Public users on laptops and phones (planned)**: the app is meant to replace a mobile weather app. They would hit the same freeze, probably worse on low-end phones. [memory `public-mobile-release`; research.md marks "worse on phones" as an ASSUMPTION] [NEEDS CLARIFICATION: when does the public release happen, and which devices are the minimum target?]
  - **People checking whether lightning is near a place**: the Hero's "lightning near you" verdict uses the same data. If the page freezes, they can't read the answer either. [research.md, Market & Context; whether a map freeze blocks the Hero is an ASSUMPTION]
- **Stakeholders**:
  - **The owner as product decider**: decides scope. Accepted volume, detail and dependency trade-offs on this layer twice before (specs 002 and 007, assessment `lightning-aggregation-and-icon`).
  - **Project constitution**: theme colours must come from CSS variables (Principle V). Lightning is fetched only on user action, cached for 2 minutes and shared (Principle I's lightning exception). Both limit what's acceptable. [research.md, Data & Constraints]
  - **data.gov.sg rate budget**: shared across all provider calls. Must not be used more. [research.md; lightning-aggregation-and-icon research]

## Goals

- During the largest storms seen, the map stays responsive to panning, zooming, toggling the layer and opening or closing fullscreen. The rest of the dashboard stays usable too.
- Users can still tell **where** lightning is happening and **how recently** at storm volume, and in particular whether it's near Singapore or their saved places.
- The layer behaves predictably across the whole range of volumes: an empty hour, a few strikes, hundreds, and 15K or more.
- The owner can find out where time goes at storm volume (fetching data or drawing it). A storm-scale case can be reproduced without waiting for a real storm.

## Non-Goals

- Changing **when** or **how often** lightning is fetched (only on user action, a 2-minute shared cache, the shared rate budget). [constitution Principle I exception; spec 007 decision]
- Storing lightning history, or analysing storm trends over time.
- Lightning alerts or notifications.
- Restyling the bolt marks, pins, basemaps or controls beyond what this problem needs.
- Improving the experience at normal volumes (up to hundreds of strikes), which already meets specs 002 and 007.
- Speeding up other layers or the general page load.

## Success Metrics

- With a replay of a 15,520-strike window, pan and zoom stay smooth in the card map and in fullscreen: no main-thread task over ~200 ms while interacting, on desktop and a mid-range phone. (baseline: the owner reports a hang; not measured) [NEEDS CLARIFICATION: confirm the long-task threshold and the reference phone]
- Time from pressing "Show latest lightning" or Refresh to lightning visible at 15K–26K strikes, split into network and drawing time by the existing `[lightning] refresh timing` record. (baseline: the server part is 7 ms on a cached refresh at 26,458 strikes; the browser part is unmeasured) [NEEDS CLARIFICATION: the target time]
- Bytes sent per lightning refresh at storm volume. (baseline: 4,639,164 bytes uncompressed at 26,458 strikes, measured 2026-11-16) [NEEDS CLARIFICATION: the target size, especially for mobile data]
- The lightning layer's periodic age update (every 30 s) causes no visible stutter at 15K strikes. (baseline: unknown)
- At storm volume, the owner can name the busiest area and spot the most recent activity without opening a popup. This is a qualitative check on 6 themes. (baseline: not assessable while the map hangs)
- No regression at normal volume: spec 002 SC-001, SC-004, SC-005, SC-007 and spec 007 SC-004 and SC-006 still hold at about 370 strikes. (baseline: passing)
- The status-strip count stays correct and readable at large numbers, for example with a thousands separator. (baseline: "15520" with no separator)

## Cost of Inaction

The layer works on calm days and with a few hundred strikes, and that is most of the time. During big regional storms the map, and possibly the whole page on its single main thread, freezes exactly when lightning information is most wanted. The only way out is to turn the layer off and lose the information altogether. A public release would put that failure in front of many users on weaker devices. Without a storm-scale test case, any later change to the layer could make things worse unnoticed.

## Open Questions

- [PARTLY ANSWERED: the server takes 7 ms at 26,458 strikes, so the time is in the browser. Still open: how it splits between downloading the 4.6 MB, parsing it, building the page and drawing the map.]
- [NEEDS CLARIFICATION: Did the hang happen in the card map, in fullscreen (where both maps draw the strikes) or both, and on which device?]
- [NEEDS CLARIFICATION: How many of the 15,520 strikes were in or near Singapore? Do strikes far out in the region need to be shown at the same detail as nearby ones?]
- [NEEDS CLARIFICATION: How often do 1K+ and 10K+ windows happen? Is this a rare edge case or a regular part of the monsoon season?]
- [NEEDS CLARIFICATION: At storm volume, which per-strike details must survive: a popup for each strike, the age fade, exact positions when zoomed in, visible overlaps (spec 007 FR-006, SC-006)?]
- [NEEDS CLARIFICATION: Is a new third-party dependency acceptable this time? It was rejected before as unneeded.]
- [NEEDS CLARIFICATION: Can a real storm-scale window (for example the 4:49 pm 2026-11-16 one) be saved and replayed for testing? The busy fixture is 42× too small.]
- [NEEDS CLARIFICATION: What are the target devices and the timing for the public mobile release, since they set the performance bar?]
