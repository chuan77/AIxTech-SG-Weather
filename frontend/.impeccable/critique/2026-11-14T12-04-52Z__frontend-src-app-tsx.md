---
target: frontend (critique and audit, after freshness pass)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-11-14T12-04-52Z
slug: frontend-src-app-tsx
---
# Critique + Audit: Weather Starter frontend (frontend/src/App.tsx), after freshness/focus pass

Method: dual-agent (A: design review · B: detector + browser), plus a parent code audit.

## Design Health Score: 26/40 (Acceptable, 22 → 25 → 26)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Age shown on cards, chips, hero and strip; the stale hero still shows its temperature at full display weight |
| 2 | Match System / Real World | 3 | "6 am"/"Midday" carry no day though they mean tomorrow; footer credits a hostname; wind as bare degrees |
| 3 | User Control and Freedom | 3 | Undo delete, Escape closes the form and returns focus |
| 4 | Consistency and Standards | 2 | Stale handling uneven: cards dim, hero number doesn't; summary and Singapore sky ignore age |
| 5 | Error Prevention | 2 | Already-saved towns re-offered; ArrowDown skips the pre-highlighted first match |
| 6 | Recognition Rather Than Recall | 3 | Good labels; lat/long always visible |
| 7 | Flexibility and Efficiency | 2 | Refresh now in the hero; no refresh-all-stale; 9 deletes in tab path; "use my location" missing |
| 8 | Aesthetic and Minimalist Design | 3 | Calm hero; identical 4-day bars; air temperature repeats the hero |
| 9 | Error Recovery | 3 | Refresh failure names cause, keeps reading, offers Retry |
| 10 | Help and Documentation | 2 | WBGT, PSI bands and "stale" unexplained; hover-only tooltips |

## Audit Health Score: 15/20 (Good, 10 → 15 → 15)

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Skip link, form focus, inset rings fixed; 18 sidebar tab stops, map markers read as one run, stale card time only in title |
| 2 | Performance | 3 | 3 font families for every theme; react-dom/server bundled; store value not memoized; 134 KB gz JS |
| 3 | Responsive Design | 3 | Phone switcher and search sit at the top, out of thumb reach |
| 4 | Theming | 3 | 7 hard-coded colour classes (range bar, sun amber, error red) |
| 5 | Implementation Integrity | 3 | Summary and sky ignore staleness; PRODUCT.md lists "use my location" as delivered; pin label 13px off ramp |

## Design Specificity Verdict
Content is authored for Singapore (summary line, WBGT station, NEA flags, freshness model); the skeleton is still Apple Weather. Detector: CLI 15 (13 theme colours, Memphis dots, 13px pin label); browser 77 desktop / 50 phone. True: 11px WBGT caption, 13px pin label, documented "Home" marker. Low-contrast hits false (sampled 4.58–7.7:1).

## Priority Issues
1. [P1] Stale hero still gives a present-tense verdict: Sentosa (11 Nov) says "No storms forecast" while its own forecast below says "Today: Afternoon thundery showers"; hero temperature not dimmed; Singapore sky paints from stale data. Fix: past-tense summary with its date when stale, dim the hero number, sky to calm when stale. (/impeccable clarify, /impeccable harden)
2. [P1] Forecast periods have no day: "6 am", "Midday" mean tomorrow in the evening. Fix: prefix "Tomorrow"/weekday when the period's SGT date differs. (/impeccable clarify)
3. [P1] Phone switching out of thumb reach; delete beside the selected chip; "use my location" missing. (/impeccable adapt)
4. [P2] Main panel long and flat: 8 sections, identical 4-day bars, air temperature repeats hero. (/impeccable distill)
5. [P2] Keyboard and form friction: 9 deletes in tab order, lat/long always shown, ArrowDown skips first match, no duplicate warning. (/impeccable harden)

## Persona Red Flags
- Alex: no refresh-all-stale, no place-switch shortcut.
- Sam: 18 sidebar tab stops, theme select before Refresh in tab order, map markers run together, stale summary not flagged as historical.
- Casey: chips and search at the top, delete beside selected chip, theme at page end.

## Minor Observations
- UV umbrella advice at night; "Latest 5-minute total" on old snapshots.
- Footer credits a hostname, not NEA.
- Selected pin can hide under map controls.

## Questions to Consider
- Should the hero lead with the answer ("Dry until midday; storms after") rather than a number that barely changes?
- Should a days-old location collapse to "Out of date, tap to refresh" instead of showing weather?
- Does saved-location search earn the top of the phone screen?
