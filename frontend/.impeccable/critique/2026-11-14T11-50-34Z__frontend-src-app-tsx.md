---
target: frontend (critique and audit, after polish)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-11-14T11-50-34Z
slug: frontend-src-app-tsx
---
# Critique + Audit: Weather Starter frontend (frontend/src/App.tsx), after polish

Method: dual-agent (A: design review · B: detector + browser), plus a parent code audit.

## Design Health Score: 25/40 (Acceptable, up from 22)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Reading times show no date or age: a 3-day-old Sentosa snapshot reads "18:36" like a fresh one; strip says "Now", 4-day lists past days |
| 2 | Match System / Real World | 3 | NEA vocabulary fits; raw strings leak ("Partly Cloudy (Day)"); "6 am" period labels beside 24h times |
| 3 | User Control and Freedom | 3 | Undo toast with pausing timer; Escape doesn't close add form; no way to set Home |
| 4 | Consistency and Standards | 3 | Same structure in every theme; sidebar search looks unstyled in Sticker/Memphis |
| 5 | Error Prevention | 2 | Town search offers already-saved towns with no warning; × on every desktop card |
| 6 | Recognition Rather Than Recall | 3 | Cards readable at a glance; redundant "Town: X" echo |
| 7 | Flexibility and Efficiency | 1 | No refresh-all; desktop Refresh is ~2000px down and the 42nd tab stop; no skip link |
| 8 | Aesthetic and Minimalist Design | 3 | Calm; wind speed twice; 4-day range bars identical (24–33° every day) |
| 9 | Error Recovery | 3 | Refresh failure banner with Retry keeps last reading; add-form shows raw server message |
| 10 | Help and Documentation | 2 | Snapshot model never explained; WBGT "No reading" gives no reason |

## Audit Health Score: 15/20 (Good, up from 10)

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Focus drops to body when add form opens/cancels; delete focus ring clipped by overflow-hidden; no skip link |
| 2 | Performance | 3 | All 3 Google font families load for every theme; react-dom/server in client bundle; store value not memoized; 133 KB gz JS |
| 3 | Responsive Design | 3 | Phone layout, chips, 44px targets fixed; map controls crowd the 224px phone map |
| 4 | Theming | 3 | ink-muted and map-control tokens in place; 4-day range gradient, sun amber and error red still hard-coded |
| 5 | Implementation Integrity | 3 | Freshness display contradicts Product Principle 2; store.error still exposed but unused; pin label 0.8125rem off ramp |

## Design Specificity Verdict
Specific where the data is (Heat & Comfort with WBGT station and distance, summary line, PSI detail, Singapore Sky's data-driven sky); the frame is still the iOS Weather template, and the 4-day range bar is a borrowed pattern that carries no information in Singapore. Detector: CLI 15 findings (13 undocumented theme colours, Memphis dots, one off-ramp font size), browser 77 desktop / 48 phone; true positives only the 11px WBGT caption, the 0.8125rem pin label and the "Home" kicker above the h1. Everything else false (contrast against unresolved frosted gradient, inactive-theme rules, data-scale gradients, Leaflet internals, sidebar is not a card).

## Priority Issues
1. [P0] Stale snapshots look current: formatTime drops the date (format.ts), Hero "Updated", SidebarCard time, HourlyStrip "Now", TenDayForecast past days. Fix: relative age + date when not today, Stale label/dimming past a threshold, drop "Now" and past days when stale, Refresh prompt in hero. (/impeccable harden)
2. [P1] Desktop Refresh unreachable: bottom of the panel, 42nd tab stop. Fix: Refresh beside "Updated" in the hero on md+. (/impeccable layout)
3. [P1] Focus management: add form open/cancel drops focus, no Escape, clipped delete focus ring (SidebarCard overflow-hidden), no skip link. (/impeccable harden)
4. [P2] Add form weighted to coordinates; promised "use my location" missing; saved towns re-offered. (/impeccable distill, /impeccable onboard)
5. [P2] 4-day range bars carry no information; Singapore's variable is storm timing. (/impeccable clarify)

## Persona Red Flags
- Alex: no refresh-all, stale cards not marked, Refresh buried, no reorder/set-home.
- Sam: focus lost on add form, clipped delete ring, no skip link, stale data never announced.
- Casey: search + Add take the top 140px; map controls cover a third of the phone map.

## Minor Observations
- Page title "Weather"; product name absent from UI.
- Compass repeats wind speed; needle overlaps the number.
- Footer credits a hostname, not NEA / data.gov.sg.
- UV advice and "carry a UV umbrella" shown after sunset.
- "6 am" period labels vs 24h elsewhere.

## Questions to Consider
- Should a stale location look stale (grey sky, no giant number) rather than merely carry a timestamp?
- Should the 4-day list and hourly strip become one storm-timing view?
- Singapore Sky is the only theme that reads data; should it be the default?
