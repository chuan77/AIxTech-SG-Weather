---
target: frontend critique
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-11-15T01-56-38Z
slug: frontend-src-app-tsx
---
# Critique: AIxTech SG Weather frontend (frontend/src/App.tsx)

Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score: 26/40 (Acceptable, up from 22)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Freshness is excellent; a successful refresh is announced only by a timestamp change |
| 2 | Match System / Real World | 3 | Strong SG vocabulary; Rainfall leads with a 5-minute station total, not "will it rain?" |
| 3 | User Control and Freedom | 3 | Delete has Undo; "Finding you…" can't be cancelled (up to 10 s) |
| 4 | Consistency and Standards | 2 | "Use my location" truncates in Radar/Memphis; entry row jumps when the form opens; h2 before h1 |
| 5 | Error Prevention | 3 | Add disabled until a town is picked; already-saved check |
| 6 | Recognition Rather Than Recall | 3 | Cards carry age and conditions; phone chips truncate at 320 |
| 7 | Flexibility and Efficiency | 1 | No Refresh all: 9 stale places = ~18 taps; no reorder, no set-home, no shortcuts |
| 8 | Aesthetic and Minimalist Design | 3 | Disciplined ink system; air temperature repeated in Heat & Comfort; identical 4-day bars |
| 9 | Error Recovery | 3 | Refresh errors name place, cause, last good reading and Retry |
| 10 | Help and Documentation | 2 | "approx." explained only in a title tooltip; "snapshot" never explained |

## Design Specificity Verdict
Content authored for Singapore (WBGT with station, PSI bands, storm timing logic, NEA flags, Singapore Sky); composition still the Apple Weather template. Singapore Sky is the only theme whose visuals carry meaning.

Detector: CLI 14 advisory findings in index.css: 13 design-system-color (alt-theme palettes absent from DESIGN.md frontmatter; documentation gap, not drift), 1 design-system-font-size (13px pin label, off-ramp, TP). Overlay 77 desktop / 41 phone: mostly low-contrast FPs (detector can't resolve translucent ink over gradients; measured all themes >= 4.5:1 except Sticker hero Refresh/theme select at 4.37-4.9 worst case), data-scale gradient FPs, extension stylesheets. TPs: 11px meta, 31-char all-caps "Forecast issued…", kicker above h1.

## Priority Issues
1. [P1] No fast path to current conditions: every return visit is stale and there is no Refresh all. Fix: "Refresh all stale" on the stale banner and dock, paced by provider pacing. (/impeccable harden or shape)
2. [P1] Use my location says "isn't supported on Firefox or Safari" to every iPhone Safari user (geolocate.ts:84-87 matches iOS Safari UA) under a working button. Fix: verify iOS Safari, then drop the pre-emptive note and rely on the existing failure messages. (/impeccable clarify)
3. [P2] Layout contradicts principle 1: rain is a small 5-minute tile, lightning is a map toggle ~2 screens down, Heat & Comfort leads and repeats air temperature. Fix: lead with a Rain & lightning panel using stormPart. (/impeccable layout)
4. [P2] Entry row truncates in Radar/Memphis and jumps when the add form opens (UseMyLocation.tsx:124, AddLocationForm.tsx). Fix: content-driven wrap; keep Add in the row while open. (/impeccable adapt)
5. [P3] Stale forecast noise: hourly strip leads with an elapsed period; 4-day bars identical. (/impeccable distill)

## Persona Red Flags
- Alex: no Refresh all, reorder, set-home or shortcuts; 18 tab stops of cards before Refresh.
- Sam: run-on sidebar card names ("Ang Mo KioHome·Yesterday29°…"), "H:33°" read literally; title-only "approx."; refresh success not announced; h2 before h1; lightning has no non-visual summary.
- Casey: entry buttons at the top of the page; summary below the fold at 320 and landscape; chips truncate at 320; lightning far down.

## Minor Observations
- Hero empty state says "sidebar", which phones don't have.
- Apple shows WBGT "Low" as plain text; Singapore Sky uses a coloured flag pill.
- Air Quality falls back to "nearest region".
- 13px pin label off the type ramp; alt-theme palettes undocumented in DESIGN.md frontmatter.
- Sticker hero Refresh pill and theme select at ~4.4-4.9:1, thin margin.

## Questions to Consider
- Should the app open on a "last known at 21:27 yesterday, tap for now" verdict instead of a dashboard of stale numbers?
- Should "when does the thunder start, and is lightning near me?" be the hero, with temperature supporting?
- Should Singapore Sky's data-driven sky be behaviour in every theme rather than one choice of six?
