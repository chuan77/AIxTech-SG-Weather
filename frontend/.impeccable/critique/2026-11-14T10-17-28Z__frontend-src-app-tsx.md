---
target: frontend (critique and audit)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-11-14T10-17-28Z
slug: frontend-src-app-tsx
---
# Critique + Audit: Weather Starter frontend (frontend/src/App.tsx)

Method: dual-agent (A: design review · B: detector + browser), plus a parent code audit.

## Design Health Score: 22/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Updated/Refreshing shown; mixed card ages with no stale signal; ~10 s refresh with only a spinner |
| 2 | Match System / Real World | 2 | "New coordinate" + lat/lng fields; ug/m3 vs µg/m³; 12h vs 24h times |
| 3 | User Control and Freedom | 2 | Delete is instant, no confirm/undo |
| 4 | Consistency and Standards | 2 | Temperature x3, forecast high x3; hero condition vs hourly "Now" disagree |
| 5 | Error Prevention | 2 | No Singapore bounds on lat/lng; 28px delete sits on the select target |
| 6 | Recognition Rather Than Recall | 3 | Good town search; unlabeled sidebar search; cloud icon for every condition |
| 7 | Flexibility and Efficiency | 2 | No refresh-all, reorder, set-home; Refresh at page bottom |
| 8 | Aesthetic and Minimalist Design | 2 | 11 equal-weight tiles, duplicate data, flat 4-day bars, grid holes |
| 9 | Error Recovery | 2 | Refresh failure is silent (store.error never rendered); raw server messages |
| 10 | Help and Documentation | 2 | WBGT/PSI unexplained; guidance hidden in title tooltips |

## Audit Health Score: 10/20 (Acceptable)

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 2 | Secondary text 1.9-3.8:1 in Apple/Glass/Sticker; one heading; 49 SVGs not aria-hidden |
| 2 | Performance | 3 | All 3 Google font families load for every theme; react-dom/server in client bundle; ~15 stacked backdrop-blur layers |
| 3 | Responsive Design | 1 | Phone: sidebar takes ~58% of the screen, main scrolls inside 314px, cards squash to 34px |
| 4 | Theming | 2 | Good --ink system, but no muted-text token; hard-coded text-[#fff]/bg-black/40 map controls; data gradients not themed |
| 5 | Implementation Integrity | 2 | store.error dead; conditionToIcon not reused in HourlyStrip/10-day/sidebar; global .text-red-100 override |

## Design Specificity Verdict
Default "Apple" theme is an iOS Weather copy; the other four are generic style presets. Specificity lives in the data (NEA areas, WBGT bands, PSI regions, lightning, Feels Like advice) but the layout buries it in an even tile grid led by temperature, which barely changes in Singapore.

Detector: source scan 1 finding (codex-grid-background index.css:172, false positive: Memphis polka dots). Overlay 17 desktop / 28 at 390px; true positives: 10-11px text (~15 uses), compass 10px labels, cream Memphis ground (intentional). Rest false positives (data gradients, Leaflet clipping, extension stylesheets, nested-cards in sidebar, text-occlusion).

## Priority Issues
1. [P0] Mobile layout broken: Layout.tsx:7 h-full flex-col + Hero.tsx:39 inner scroll + Sidebar.tsx:52 max-h-72 with shrinkable overflow-hidden cards. Fix: document scroll below md, shrink-0 cards, location switcher row, move theme picker out of fixed top-right. (/impeccable adapt)
2. [P1] Contrast fails AA in 3 of 5 themes incl. default (tile labels 2.1-3.3, footnotes 1.9-2.6). Fix: per-theme --ink-muted token tuned to 4.5:1, darken Glass, no text below /70. (/impeccable colorize or polish)
3. [P1] Silent failures + destructive delete: refresh errors never shown; delete instant with 28px target. Fix: inline error with Retry in hero; undo toast; 44px target. (/impeccable harden)
4. [P1] Wrong hierarchy for Singapore: hero lacks condition; storm/heat/haze tiles look like UV 2; one cloud icon for everything. Fix: hero verdict line, real condition icons via conditionToIcon, alert tiles that escalate. (/impeccable layout, /impeccable bolder)
5. [P2] Redundant tiles, flat 4-day bars, grid holes, add-form "coordinate" language. (/impeccable distill, /impeccable clarify)

## Persona Red Flags
- Alex: no refresh-all, reorder, set-home or shortcuts; Refresh at bottom; preview map non-interactive.
- Sam: unlabeled sidebar search; single h1, unnamed sections; title-only guidance; scale bars/compass have no text alternative; weak ring-white/40 focus on light themes; reduced-motion only covers the fullscreen map.
- Casey: P0 layout; theme picker over search; 28px delete; background tap on preview map opens fullscreen.

## Minor Observations
- "My Location · Home" for a location that was only added first.
- Fixed id="air-quality-detail".
- UV scale caps at 11; heat-stress scale is a magic wbgt-25 over 10.
- Page title just "Weather"; theme names use the Apple brand.
- 10-day day 0 shows a weekday, not "Today".
- StoreProvider value not memoized: every store change re-renders all consumers.

## Questions to Consider
- If it is 30° every day, why is temperature the hero rather than "can I go out at 4 pm?"
- Should one Singapore-native theme (storm wall, haze, heat-flag colours) replace borrowed styles?
- Does a phone need the saved-locations list, or one location plus a tappable island map?
