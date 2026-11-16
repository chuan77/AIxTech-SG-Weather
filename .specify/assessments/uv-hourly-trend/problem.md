# Problem Definition: Seeing how UV is moving through the day

- **Slug**: uv-hourly-trend
- **Created**: 2026-11-15
- **Inputs used**: research.md (intake.md absent; research was run directly from user input)

## Problem Statement

Someone checking the Singapore dashboard before going outside sees only the latest hour's UV reading. They can't tell whether UV is still climbing towards its peak or already falling, or how long it has been at a level that calls for sun protection. So they can't judge when being out in the sun is reasonable. NEA publishes no UV forecast, so any answer about later hours is an estimate, not a reading. That limits how directly the question can be answered (research.md, Data & Constraints; Evidence Against).

## Affected Users & Stakeholders

- **Users**: members of the general public in Singapore deciding when to be outdoors (a walk, exercise, errands), with no special needs assumed. The owner is one of them and asks that the app follow official guidance rather than personal preference (owner, 2026-11-15). Today they get one number per refresh (research.md, Users & Demand; Market & Context).
- **Stakeholders**:
  - **The owner as decision-maker**: queued this feature on 2026-11-14 after the WBGT tile (research.md, Users & Demand).
  - **The project constitution**: constrains how UV may be fetched (only on create or refresh, Principle I) and shown (theme tokens, Principle V; pure testable logic, Principle IV) (research.md, Data & Constraints).
- **NEA / Meteorological Service Singapore (MSS)**: the authority whose UV readings, scale and advice the app follows. The **Health Promotion Board (HealthHub)** is the reference for sun-protection practice. Their published guidance, not the app, defines thresholds and wording (owner, 2026-11-15).

## Resolved by Official Guidance (2026-11-15)

Sources are web-search summaries of the pages listed; the pages themselves weren't opened. Wording must be confirmed against the NEA UV page before specification closes.

- **Who the users are** (was Q6): the general public, following NEA and HealthHub guidance (owner).
- **How UV is measured**: NEA measures UV at Changi and reports it hourly from 07:00 to 19:00, each value a 15-minute average. That confirms one nationwide value (NEA UV Index page, via search summary).
- **Scale and bands**: Low 0–2, Moderate 3–5, High 6–7, Very High 8–10, Extreme 11+. NEA advises **extra** protection at Very High and Extreme. This matches the bands already in the code (news reports quoting NEA; NEA UV page).
- **When protection is advised**: from **UV 3** (Moderate) up, per WHO guidance as cited by Singapore public sources (Families for Life; 365cps citing WHO). HealthHub advises SPF 30+ sunscreen, applied 20–30 minutes before sun exposure (HealthHub Sun Protection page, via search summary).
- **When UV is worst**: NEA states the maximum typically occurs **11:00–15:00**, and Very High and Extreme levels are common then on days with little cloud. This is official, standing guidance about typical days, not a forecast (NEA UV page, via search summary).
- Still product decisions, which no official body answers: Q3 (where it is shown) and Q5 (how an old snapshot reads).

## Goals

- The user can tell from the dashboard whether UV is **rising, at its peak or falling** at the time of the snapshot.
- The user can see **how much of today so far** has been at or above the level where sun protection is advised.
- The user is never shown an estimate of future UV as if it were an NEA reading. Anything about later hours is clearly labelled as typical or estimated, or isn't shown.
- Nothing is lost that the user has today: the current value, its band and the hero's "UV high" note stay as reliable as they are now.

## Non-Goals

- A UV **forecast** produced by the app, or presented as NEA's. NEA publishes none (research.md, Data & Constraints).
- Location-specific UV: NEA's value is nationwide (research.md, Data & Constraints).
- Medical or dermatological advice beyond the band wording the app already uses.
- Alerts, notifications or automatic refreshes during the day (fetching stays create or refresh only, Principle I).
- UV history beyond today, or multi-day UV charts. That ties in with the historical-data assessment (`ai-ml-historical-model`), not this one.
- Changes to other tiles, the regional forecast strip's content, or the hero's other parts.
- Constitution amendments.

## Success Metrics

- **Trend readable** (qualitative): from one refresh, the owner can say correctly whether UV is rising, peaking or falling. (Baseline: not possible; one value only.)
- **Exposure so far** (measurable): the number of hours today at or above the protection threshold can be read off the dashboard, and it matches NEA's hourly values for that day. (Baseline: not shown.)
- **No new upstream calls** (measurable): data.gov.sg requests per refresh stay unchanged; the hourly list already arrives with today's single `uv` call. (Baseline: 1 `uv` call per refresh.)
- **Honesty** (measurable): 0 places where an estimated or future UV value is shown without a "typical" or "estimate" label. (Baseline: 0; nothing estimated is shown today.)
- **No blank states** (measurable): with no UV list (night, upstream error), the UV area shows an explicit state, never an empty chart. (Baseline: the tile shows "Unavailable".)

## Cost of Inaction

Low. The UV tile keeps showing the latest value and band, and the hero keeps flagging High and above (research.md, Prior Art). The owner still has to guess whether UV is rising or falling, or check another source. Nothing breaks, and no upstream cost changes. The cost is a missed, cheap improvement, since the data already arrives with every refresh and is thrown away (research.md, Data & Constraints).

## Open Questions

- [NEEDS CLARIFICATION: What should "safe sun hours" mean? Official guidance now offers an option it didn't before. Choose: (a) past hours today below UV 3, (b) NEA's standing 11:00–15:00 peak window, shown as NEA's general advice, (c) typical hours from past days, labelled as typical, or (d) drop the term. Options (a) and (b) need no estimate.]
- [NEEDS CLARIFICATION: Protection is advised from UV 3 (official guidance, above), but the hero only mentions UV from 6. Should the hero stay at 6, with 3 used only in the trend, or align to 3? This is a product choice; the guidance only fixes the threshold.]
- [NEEDS CLARIFICATION: Where should the user see the trend: with the UV tile, as its own panel, or alongside the hourly forecast strip (which holds regional forecast periods, a different kind of data)? No official body answers this.]
- [NEEDS CLARIFICATION: Confirm the time span follows NEA's reporting window (07:00–19:00) instead of sunrise to sunset. NEA reports in that window, so it is the natural default.]
- [NEEDS CLARIFICATION: How should an old snapshot read? A morning refresh only holds the morning's hours. Is the app's existing staleness labelling enough, or must the trend say "as of <time>" itself? No official body answers this.]
- [NEEDS CLARIFICATION: Open NEA's UV Index page and HealthHub's Sun Protection page directly to confirm the band advice wording, the Changi measurement note and the 11:00–15:00 statement. Only search summaries were used.]
- Constraint to respect: frontend tests cover pure `.ts` modules only, so any trend or threshold logic worth testing must live in one (constitution Principle IV).
