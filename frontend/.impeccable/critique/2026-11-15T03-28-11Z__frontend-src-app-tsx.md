---
target: frontend critique
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-11-15T03-28-11Z
slug: frontend-src-app-tsx
---
# Critique: AIxTech SG Weather frontend (frontend/src/App.tsx)

Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score: 29/40 (Good, up from 26)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 4 | Freshness, Refresh-all progress, lightning status all visible; lightning has no glance-level answer outside the map |
| 2 | Match System / Real World | 3 | "Feels like 37° Scorching" beside "Heat stress Low"; 5-minute rainfall total isn't a rain answer |
| 3 | User Control and Freedom | 3 | Undo (6 s), Stop, Escape all present; Home is fixed as first saved place |
| 4 | Consistency and Standards | 3 | Air temperature shown twice at display size; Refresh in different places per breakpoint |
| 5 | Error Prevention | 3 | Town list offers already-saved towns without a "saved" mark |
| 6 | Recognition Rather Than Recall | 3 | Stale chips swap condition icon for a clock |
| 7 | Flexibility and Efficiency | 2 | No shortcuts, reorder, set-home; ~1 chip visible at 390 with 10 places |
| 8 | Aesthetic and Minimalist Design | 3 | Repeated readings; identical 4-day bars; three statements of age in a stale hero |
| 9 | Error Recovery | 3 | Good recovery; "only been tested in Chrome" exposes QA status |
| 10 | Help and Documentation | 2 | WBGT, PSI bands and the 3 h "out-of-date" rule unexplained; title-only tooltips |

## Design Specificity Verdict
Content authored for Singapore (summary line, WBGT with station, PSI region, Singapore Sky, freshness rules); skeleton still iOS Weather, and the hero's display slot holds temperature, the least decisive number in Singapore.

Detector: CLI 14 advisory findings in index.css (13 alt-theme colours undocumented in DESIGN.md frontmatter; 13px pin label off the ramp). Overlay 80 desktop / 40 phone, overwhelmingly FPs (low-contrast on translucent panels, sidebar nested-cards, data-scale gradients, extension CSS). Measured: every text element passes AA in all six themes (thinnest: Sticker hero temperature 4.03 as large text, Sticker theme select 4.86, Apple card meta 5.04). No truncated labels in any theme; no horizontal overflow; all phone controls >= 44px.

## Priority Issues
1. [P1] Hero answers "how hot", not "can I go out": 6.5rem temperature leads; summary is a 14px muted line; UV never in the summary; lightning only in the map card. Fix: summary becomes the hero statement; add UV High+ and loaded lightning; temperature second (deliberate Apple theming work). (/impeccable layout)
2. [P1] Contradictory heat signals: Feels like "Scorching" beside WBGT "Low" with no ranking; air temperature duplicated. Fix: WBGT is the verdict, feels-like supporting, or one reconciling line; drop duplicate air temp. (/impeccable clarify + distill)
3. [P1] Phone dock too heavy: 119 px with the Refresh-all row = 31% of an 844x390 screen, clips the hero temperature; ~1 chip visible at 390. Fix: fold Refresh all into the dock Refresh (badge/sheet) or show it at the page top; place sheet beyond 4 places; hide dock on scroll in landscape. (/impeccable adapt)
4. [P2] Stale feels-like advice in present tense: FeelsLikeReading never receives asOf (Tiles.tsx:441). Fix: pass asOf, drop or date the advice; explain missing WBGT. (/impeccable harden)
5. [P3] Orphaned "·" at line start in the hero summary at 390 (Hero.tsx:103); "0.0 mm" wraps in Radar/Memphis at 390. Fix: keep separator with the following part; nowrap the value. (/impeccable polish)

## Persona Red Flags
- Alex: no set/reorder Home, no shortcuts, Refresh all only for stale places, 6 s Undo short for batch deletes.
- Sam: selecting a place changes the whole panel silently (only "Updated …" is live, without the place name); sidebar h2 before h1; title-only "approx." and stale card time.
- Casey: ~1 chip visible with 10 places; dock covers a third of a landscape screen; add buttons at the top; theme picker at the very bottom.

## Minor Observations
- "Pick a town from the list…" hint appears after the first keystroke.
- "Forecast issued …" uses observation time, not NEA issue time.
- HourlyStrip and TenDayForecast use new Date() rather than the ticking now; "Now"/"Today" can lag past midnight.
- Empty state says "Select a location" even with no saved places.
- 13px pin label off the type ramp; alt-theme palettes missing from DESIGN.md frontmatter.

## Questions to Consider
- Why is a number that varies ~5° a year the one giant figure, instead of the next change ("Storms from 12 pm")?
- Could the 3-period strip become "best window to go out in the next 6 hours"?
- Is refreshing just the selected place on open more honest than greeting users with "Refresh 8 out-of-date places"?
