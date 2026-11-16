# Concept: Seeing how UV is moving through the day

- **Slug**: uv-hourly-trend
- **Created**: 2026-11-15
- **Recommended option**: Option B: today's UV curve in the UV tile

## Options

### Option A: Official guidance line only (no new data)
- **Sketch**: The UV tile keeps its current value, band and gauge, and gains one short line of standing NEA and HealthHub guidance, for example "Sun protection advised from UV 3. UV usually peaks 11 am – 3 pm (NEA)". The tile also states that the reading is from Changi and reported hourly from 7 am to 7 pm. Nothing new is stored, and the hourly list is still thrown away.
- **Appetite**: small (about a day)
- **Trade-offs**: Wins: cheapest; official wording only, so no estimate and no honesty risk; no data or schema change. Sacrifices: doesn't meet the main goals. The user still can't tell rising from falling, and can't see how much of today has been at UV 3 or above (problem.md Goals 1–2). It is the "do nothing much" option.
- **Rabbit holes**: getting the wording exactly right against NEA's and HealthHub's pages (only search summaries so far).

### Option B: Today's UV curve in the UV tile
- **Sketch**: The UV tile adds a compact hourly view of today from 7 am to 7 pm, NEA's reporting window. Hours already reported show their reading, coloured by band from the existing theme UV scale. Hours not yet reported are visibly empty, never filled with a guess. A marker shows the UV 3 protection level, and the 11 am – 3 pm window is marked as NEA's usual peak, labelled as NEA's general advice. A short line says the direction ("Rising", "Near peak", "Falling") and how many hours so far reached UV 3 or more. The tile keeps its current value, band and gauge, and says the data is from Changi as of the snapshot time. It uses the full hourly list that already arrives with each refresh, so there's no new upstream call.
- **Appetite**: small (days)
- **Trade-offs**: Wins: meets all four goals (direction, exposure so far, no estimate shown as a reading, nothing lost) and every success metric. Reuses the existing call, theme scale and band logic. Sacrifices: needs the snapshot to keep today's list (a schema change), and a dense visual inside a small tile. Risks: (1) legibility at phone width and across 6 themes; (2) the frozen-snapshot effect: a morning refresh shows only the morning, which must read as "as of" and not as "the rest of the day is zero"; (3) "Rising/Falling" from hourly steps can flicker on cloudy days.
- **Rabbit holes**:
  - Turning the tile into a full chart component with axes, tooltips and animation.
  - Adding estimated future hours ("typical afternoon"). That is Option C's territory and a non-goal here.
  - Reworking the hero's UV threshold in the same feature.
  - Handling an old snapshot from a previous day (should the curve show at all?).

### Option C: Curve plus typical hours from past days
- **Sketch**: As Option B, but the empty future hours are drawn from typical UV for this month and hour, built offline from past days' NEA readings and clearly labelled "typical, not a forecast". This would give an answer to "when is it usually below 3 this afternoon?".
- **Appetite**: medium (one to two weeks)
- **Trade-offs**: Wins: the only option that says anything about later today. Sacrifices: brings in the offline-history machinery from the `ai-ml-historical-model` assessment (backfill, a shipped lookup, its unresolved Principle I question) for a small gain over NEA's own standing advice (peak 11 am – 3 pm). It also puts estimated values right next to readings, which is exactly the honesty risk problem.md warns against. History reaches back only to some date before mid-2025 (research.md).
- **Rabbit holes**: deciding how cloudy days skew "typical"; where the backfill lives; labelling that people actually notice; scope creep into the wider historical-data feature.

## Recommendation

**Option B.** It is the smallest option that meets the problem's goals.
- Direction and exposure so far become readable from one refresh (Goals 1–2, Success Metrics "Trend readable" and "Exposure so far").
- No extra data.gov.sg call is made (Success Metric "No new upstream calls").
- Every value shown is either an NEA reading or NEA's own standing advice, labelled as such (Goal 3, Success Metric "Honesty").

That settles the "safe sun hours" question with problem.md option (a) plus (b): past hours below UV 3, plus NEA's standing 11 am – 3 pm advice. No estimate is needed. Option A is a fallback if B's tile turns out too dense on a phone. Option C isn't recommended now, because it brings back the estimate the problem asks to avoid, for little gain over NEA's own advice. It could follow later, only as part of the historical-data work.

## Out of Scope (for the recommended option)

- Any UV forecast or estimated future hours (Option C), and any "safe after <time>" claim.
- Location-specific UV; the value stays nationwide (Changi), and the tile says so.
- Changing the hero's UV threshold (it stays at High, 6+). Aligning it is a separate decision.
- Medical advice beyond NEA's and HealthHub's published wording.
- Alerts, notifications and automatic refreshes; fetching stays create or refresh only (Principle I).
- UV history beyond today, multi-day charts, and use of the dated `uv` endpoint.
- Moving UV into the regional forecast strip, a separate panel, or the map.
- Constitution amendments.

## Assumptions to Validate

- NEA's guidance wording (protection from UV 3; extra protection at 8+; peak 11 am – 3 pm; measured at Changi, reported hourly 7 am – 7 pm) holds when the NEA UV page and HealthHub page are read directly. Only search summaries were used (problem.md).
- The `uv` response at refresh time always carries today's full list so far, newest first, as the 2026-10-01 sample did (research.md). It must also be checked at night and just after midnight.
- A compact 13-hour view fits the UV tile at phone width and stays legible in all 6 themes; otherwise fall back to Option A's text inside the tile.
- The app's existing stale-snapshot labelling, plus an "as of <time>" note on the curve, is enough for a morning snapshot not to be read as the whole day. If the snapshot is from a previous day, the curve isn't shown as today's.
- Keeping the hero at UV 6+ while the curve marks UV 3 doesn't confuse people. If it does, the hero threshold becomes its own follow-up decision.
- The direction label ("Rising / Near peak / Falling") can be derived simply from the last few hours without flicker on typical days; the rule itself is for specification.
