# Problem Definition: Is it worth heading out in the rain, or will I be stuck without a taxi?

- **Slug**: sg-transport-data
- **Created**: 2026-11-18
- **Inputs used**: intake.md | research.md | owner's choice of framing (2026-11-18: "Rain + getting a taxi")

The idea arrived supply-led ("build features from data.gov.sg transport data"). Research found no stated user need [research: Users & Demand]. The owner chose this framing as the problem to test. It's a **hypothesis**, not an observed pain.

## Problem Statement

When it's raining, or about to rain, at a place someone has saved, a Lepak user can see the weather but has no sense of whether a taxi will be easy to get there. So they can't judge whether to leave now, wait out the rain, or plan another way. This matters because Lepak aims to replace people's mobile weather app [research: memory `public-mobile-release`], and in Singapore "should I go now?" in the rain is often a question about getting a ride, not just about the forecast [ASSUMPTION, research confidence: low].

## Affected Users & Stakeholders

- **Users**: public Lepak users on mobile who check the weather for a saved place before leaving it. They see rain, but not their chances of getting a taxi. [research: Users & Demand; whether users actually do this is [NEEDS CLARIFICATION: no usage evidence exists]]
- **Users**: how many there are, and how often they take taxis rather than ride-hailing or public transport, is [NEEDS CLARIFICATION: unknown; the app has visit counts only].
- **Stakeholders**: the repo owner, who decides scope and would have to approve a constitution amendment (Principle I allows only two live island-wide layers) [research: Data & Constraints].
- **Stakeholders**: LTA and data.gov.sg as the data source. Their licence, terms and the future of the v1 endpoint bound what is possible [research: Gaps].

## Goals

- A user looking at rain at a saved place can also judge, at a glance, whether getting a taxi there is likely to be easy or hard right now.
- That judgement is honest about how old its data is, so stale taxi supply never reads as live.
- The weather experience stays as fast and dependable as today when the transport data is slow or unavailable.

## Non-Goals

- Booking, hailing or estimating fares, or any link-out that competes with ride-hailing apps.
- Private-hire (ride-hailing) car supply, unless the source turns out to include it.
- Other transport data (carparks, traffic cameras, bus or train) unless a later survey adds it.
- Routing or travel-time advice.
- Turning Lepak into a transport app; weather stays the main thing.
- Choosing a design, data flow or caching approach, or deciding to build. Those belong to shape and decide.

## Success Metrics

- **Rain–taxi link exists in the data**: taxi supply near typical saved places is measurably lower during rain than in dry periods at similar times (baseline: unknown; one dry-evening sample of 3,912 island-wide [research: Data & Constraints]). If there's no link, the premise fails.
- **Usefulness despite delay**: the taxi picture shown is still accurate enough to act on at its age, for example local counts at 2+ minutes old still match the present (baseline: unknown; the feed updates every 30 s and the app caches for at least 2 minutes).
- **Use**: share of mobile sessions that view a saved place during rain and also look at taxi availability (baseline: 0; not measurable today without new measurement [NEEDS CLARIFICATION: is measuring feature use acceptable under the spec 012 privacy notice?]).
- **No regression**: weather views load as fast as today, and a transport outage shows "unavailable" without affecting weather (baseline: current behaviour).
- **Qualitative**: users say it helped them decide whether to leave (baseline: none; no feedback channel exists).

## Cost of Inaction

Nothing breaks. Users keep checking the weather in Lepak and then open a taxi or ride-hailing app to see nearby cars, which those apps already do live and with booking [research: Market & Context, ASSUMPTION]. The app stays focused on weather, needs no constitution amendment, and carries no extra upstream dependency on a legacy v1 endpoint. The cost is a missed chance to make Lepak's rain view more useful in its own right, and its size depends on a link between rain and taxi scarcity that hasn't been shown.

## Open Questions

- [NEEDS CLARIFICATION: Does taxi availability actually drop in the rain? It needs samples across rainy and dry periods; research has one dry evening sample.]
- [NEEDS CLARIFICATION: Do Lepak users take street-hail taxis enough for this to matter, compared with ride-hailing or public transport?]
- [NEEDS CLARIFICATION: Does the feed include private-hire cars, or street-hail taxis only?]
- [NEEDS CLARIFICATION: Is the owner willing to amend the constitution for a third live island-wide data source?]
- [NEEDS CLARIFICATION: How old can taxi data be before it misleads? The constitution's 2-minute cache sits against a 30-second feed.]
- [NEEDS CLARIFICATION: Licence and terms of use for LTA Taxi Availability, and whether the v1 endpoint has a rate limit or a retirement date]
- [NEEDS CLARIFICATION: Is measuring feature use acceptable under the spec 012 privacy notice, so the "Use" metric can be tracked?]
- [NEEDS CLARIFICATION: Should a survey of the wider transport topic happen first, or is taxis-only the scope?]
