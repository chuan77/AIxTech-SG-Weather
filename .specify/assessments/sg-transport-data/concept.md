# Concept: Taxi chances alongside rain at a saved place

- **Slug**: sg-transport-data
- **Created**: 2026-11-18
- **Recommended option**: B (test the rain–taxi link first), with no user-facing build until it passes

## Options

### Option A: Do nothing (users keep their taxi apps)
- **Sketch**: Lepak stays weather-only. Users check the rain in Lepak, then open Grab, Gojek or a taxi app, which already show nearby cars live and let them book.
- **Appetite**: none
- **Trade-offs**: no cost, no constitution amendment, and no new dependency on a legacy v1 endpoint. Gives up any chance of making the rain view answer "can I get home?" on its own. Matches the cost of inaction in problem.md.
- **Rabbit holes**: none.

### Option B: Test the premise first (rain vs taxi supply study)
- **Sketch**: before building anything users see, collect taxi supply over 1–2 weeks at a modest pace (for example every 10–15 minutes), alongside whether it was raining. Then compare counts near a handful of representative spots (CBD, a heartland town, the west) in wet and dry periods at similar times of day. The output is a short findings note in this assessment folder: does supply drop in the rain, by how much, and how fast does the local count change from minute to minute (which answers whether 2-minute-old data is good enough). Nothing ships to the app.
- **Appetite**: small (a couple of days of effort, spread over 1–2 weeks of calendar time to catch enough rain)
- **Trade-offs**: cheap, and it settles the problem's first success metric ("rain–taxi link exists") and the staleness question with real data before any amendment or UI work. It delays any feature by the collection window. It needs rain to actually happen during the window; the November–January monsoon makes that likely [ASSUMPTION]. It adds a few thousand keyless calls to a v1 endpoint over the period.
- **Rabbit holes**: turning a quick study into a research project (statistics, many locations, a dashboard). Keep it to a few spots and a simple wet-vs-dry comparison. Also defining "raining" (station rainfall vs the 2-hour forecast). Pick one simple rule and note it.

### Option C: Smallest user-facing feature (taxi line on the saved place)
- **Sketch**: on a saved place's weather view, a single line such as "Taxis nearby: few / some / many (as of HH:MM)", shown with the rest of the weather and updated whenever the user refreshes that place. No map dots and no island-wide layer. It sits beside the rain information so the user can judge "leave now or wait".
- **Appetite**: medium (a few weeks with spec, constitution change, tests and e2e, judging by specs 008 and 011)
- **Trade-offs**: directly serves the problem's goals with the least UI. Tied to a saved place, so it may fit the refresh flow better than a live layer. But it's not weather data, so the constitution question still needs an answer. The data can be minutes old by the time someone reads it, which risks the "never reads as live" goal. It builds on an unproven premise unless Option B runs first.
- **Rabbit holes**: the constitution amendment (is non-weather data allowed in a place's stored data, or is this a third live source?); choosing "few/some/many" thresholds without the Option B data; the v1 endpoint's limits or retirement; scope creep toward a map layer.

### Option D: Taxi map layer (like lightning and rain)
- **Sketch**: a "Taxis" switch on the map shows available taxis island-wide as grouped dots, refreshed when the user asks, like the lightning and rain layers.
- **Appetite**: medium to large (lightning took specs 002, 007 and 009 to reach a usable state)
- **Trade-offs**: visually rich, and it reuses the grouping pattern. But it shows island-wide supply rather than answering the question at the user's place, competes head-on with ride-hailing apps that do it live, needs an amendment for a third live layer, and shows positions that are 2+ minutes old for moving cars.
- **Rabbit holes**: performance on phones (~3,900+ points), staleness making dots wrong, layer-menu crowding, and pressure to add booking links.

## Recommendation

**Option B, and nothing user-facing until it passes.** The whole problem rests on an unproven hypothesis: that taxi supply drops noticeably in the rain at the places people save, and that a few-minutes-old picture is still accurate enough to act on. Both are cheap to test and expensive to get wrong. Options C and D each need a constitution amendment and weeks of work. Option B answers problem.md's first two success metrics with real numbers for a few days of effort. If the link is weak or the local counts swing too fast, the right next step is Option A, and the assessment closes with evidence. If it's strong, Option C is the natural follow-up: smallest, closest to the user's question, no map layer. It would go back through decide with the findings attached.

## Out of Scope (for the recommended option)

- Any change to the app, its API, its database or the constitution.
- Showing taxi data to users in any form.
- Booking, fares, private-hire cars, other transport datasets, routing (inherited non-goals).
- Statistical rigour beyond a simple wet-vs-dry comparison at a few spots.
- Storing collected data in the app's database or committing raw captures larger than needed for the findings note.

## Assumptions to Validate

- Enough rain falls during the collection window to compare wet and dry periods at similar times of day. [ASSUMPTION: November–January monsoon]
- The v1 taxi endpoint tolerates keyless polling every 10–15 minutes for 1–2 weeks without blocking. No rate-limit headers were seen in one call. [research: Data & Constraints]
- Rain at a spot can be judged from data the project already knows how to read (station rainfall or the 2-hour forecast). [ASSUMPTION]
- The licence and terms allow collecting and analysing the feed this way. [NEEDS CLARIFICATION carried from research]
- Owner's appetite: willing to wait 1–2 weeks for evidence before deciding on a feature. [NEEDS CLARIFICATION]
