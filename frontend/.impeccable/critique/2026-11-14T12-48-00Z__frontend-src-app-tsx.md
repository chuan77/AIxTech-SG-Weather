---
target: frontend (critique after phone dock pass)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-11-14T12-48-00Z
slug: frontend-src-app-tsx
---
# Critique: Weather Starter frontend (frontend/src/App.tsx), after stale/day-label/phone-dock pass

Method: dual-agent (A: design review · B: detector + browser).

## Design Health Score: 26/40 (Acceptable; 22 → 25 → 26 → 26)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Age shown in hero, cards, chips, strip; tiles below a stale hero still say "Latest…"/"Nearest realtime…" |
| 2 | Match System / Real World | 3 | Local language good; PSI/WBGT jargon, "Partly Cloudy (Day)", "0.0 mm latest 5-minute total" |
| 3 | User Control and Freedom | 3 | Undo delete, Escape layering, focus return; Home not choosable, no reorder |
| 4 | Consistency and Standards | 3 | Strong tokens; Refresh labelled on desktop, icon-only in phone dock; stale cue differs card vs chip |
| 5 | Error Prevention | 2 | Editing the town after a pick keeps the old coordinates, so Add saves the wrong place; no duplicate warning |
| 6 | Recognition Rather Than Recall | 3 | Good combobox; phone dock shows ~1.5 of 9 chips with no count |
| 7 | Flexibility and Efficiency | 2 | 18 sidebar tab stops plus 9 map-marker stops; no refresh-all-stale, reorder or shortcuts |
| 8 | Aesthetic and Minimalist Design | 3 | Calm; identical 4-day bars; wind/humidity/sun filler |
| 9 | Error Recovery | 3 | Refresh/delete failure handling solid |
| 10 | Help and Documentation | 1 | Nothing explains WBGT, PSI, Home or staleness |

## Design Specificity Verdict
Content is Singapore-specific (summary sentence, WBGT station, NEA flags, freshness and dated periods, Singapore Sky); the skeleton remains Apple Weather, and Singapore Sky's calm state (also used for stale/missing) looks nearly identical to Apple. Detector: CLI 15 (13 theme colours, Memphis dots, 13px pin label); browser 77 desktop / 41 phone. True: 13px pin label, 11px WBGT source line (Tiles.tsx:402), weak "Home" kicker; Glass/Radar palette drift low priority. Low-contrast hits false (computed 4.58–7.7:1); nothing flagged on the phone dock.

## Priority Issues
1. [P1] Stale snapshot reads live below the hero: tiles say "Latest"/"Nearest realtime" (Tiles.tsx ~244–329); daily list says "Today" for a 3-day-old forecast; stale hero number only steps to 85% ink. Fix: pass stale into grids and forecast, swap copy for "Reading from 11 Nov 18:37", dim values, title "Forecast issued 11 Nov", make the stale hero clearly distinct. (/impeccable harden, /impeccable clarify)
2. [P1] Add form can save coordinates that don't match the visible town (AddLocationForm onTownChange keeps lat/lng after editing a picked town); no duplicate warning. (/impeccable harden)
3. [P1] Card map markers sit in the tab order when non-interactive, are named only "30°", and tabbing pans the map away. (/impeccable audit, /impeccable harden)
4. [P2] Advice ignores time and UV ("carry a UV umbrella" after sunset); summary wraps with a leading "·". (/impeccable clarify)
5. [P2] Phone dock hides the set (no count/overflow cue); desktop list ignores freshness order. (/impeccable layout, /impeccable distill)

## Persona Red Flags
- Alex: no reorder/choose Home, no bulk refresh, 27 tab stops before the weather without the skip link; "use my location" promised but absent.
- Sam: markers announced "30°, button"; unlabeled focusable map; no announcement on location change.
- Casey: Add Location at the top; dock chips clip with no cue; stale banner says "Refresh" but the dock button is icon-only.

## Minor Observations
- Compass needle overlaps numeral; TenDayForecast name drifted; hero Home uses a pin icon, cards a house; Heat & Comfort "No reading" unexplained.

## Questions to Consider
- Should a stale hero become "Last known 29° on 11 Nov, refresh?" instead of a verdict?
- Should staleness get its own sky in Singapore Sky?
- At 7 pm on a phone, is the answer a dashboard or one sentence and a 6-hour timeline?
