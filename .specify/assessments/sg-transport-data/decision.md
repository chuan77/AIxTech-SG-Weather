# Decision: Taxi chances alongside rain at a saved place

- **Slug**: sg-transport-data
- **Decided**: 2026-11-18
- **Verdict**: needs-clarification (owner direction: proceed with Option B, the rain vs taxi supply study, as the research that resolves it)
- **Artifacts reviewed**: intake.md | research.md | problem.md | concept.md

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | weak | A hypothesis chosen by the owner ("rain + getting a taxi"), not an observed pain. No user has asked for it, and whether taxi supply drops in the rain is unproven |
| Evidence strength | weak | Data facts are solid (one live call: 3,912 taxis, 84 KB, 5 s fresh), but demand, the rain–taxi link and whether 2-minute-old data is useful all rest on assumptions |
| Value vs. inaction | unknown | Inaction costs nothing today, since users have taxi apps. The value depends entirely on the unproven rain–taxi link |
| Feasibility / appetite | adequate | Option B is small (days of effort over 1–2 weeks) and changes nothing in the app. Options C and D are credible but medium-sized and need an amendment |
| Strategic fit | adequate | The owner stated on 2026-11-18 that Lepak may expand beyond a weather app, which reverses the earlier weather-only scope. The constitution still allows only two live island-wide sources, so a user-facing feature needs an amendment |
| Risk posture | adequate | Option B's risks are small and known: a few thousand keyless v1 calls, licence not yet checked, possibly too little rain in the window. App, users and constitution are untouched |

## Verdict & Rationale

**needs-clarification, revisiting research through Option B.** Problem validity and evidence strength are both `weak`, so a go (a handoff to `/speckit-specify` to build something) isn't justified; the skill forbids it with weak evidence. A kill would be premature as well: the owner has signalled a strategic interest in taking Lepak beyond weather, and the deciding question (does taxi supply near saved places drop in the rain, and is a few-minutes-old count still accurate?) is cheap to answer. The owner chose Option B on 2026-11-18. It's a time-boxed data study, not a feature, and its findings decide what comes next:

- **If the rain–taxi link is clear and local counts stay stable over a few minutes:** re-run `/speckit-assess-decide` with the findings. Option C (a "taxis nearby" line on the saved place) becomes the candidate for a go, together with a constitution amendment.
- **If not:** record a kill with the evidence. Other transport ideas for "more than weather" would start fresh at intake.

## If needs-clarification

- **Blocking questions** (Option B answers the first two):
  - [NEEDS CLARIFICATION: Does available-taxi supply near representative spots drop measurably in the rain compared with dry periods at similar times?]
  - [NEEDS CLARIFICATION: How quickly does a local taxi count change, and is a 2–5-minute-old count still close to the present?]
  - [NEEDS CLARIFICATION: Do the licence and terms of LTA Taxi Availability allow this collection? Check before starting.]
  - [NEEDS CLARIFICATION: Is the owner willing to amend the constitution (a third data source, and non-weather data) if the study passes?]
- **Revisit stage**: research (run Option B, then append a "Findings" section or a `findings.md` in this folder, then re-run decide)
- **Study boundaries** (from concept.md): no app, API, database or constitution change; nothing shown to users; a few representative spots; a simple wet-vs-dry comparison; polling every 10–15 minutes for 1–2 weeks.

## If go — Handoff to `/speckit-specify`

Not applicable yet. A go can be considered after Option B's findings.
