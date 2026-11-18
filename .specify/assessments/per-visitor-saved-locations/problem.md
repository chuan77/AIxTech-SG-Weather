# Problem Definition: Visitors share one saved-locations list

- **Slug**: per-visitor-saved-locations
- **Created**: 2026-11-17
- **Inputs used**: user input, plus sibling research. There is no `intake.md` or `research.md` in this folder; intake and research were skipped for this slug. The evidence comes from `../next-value-features/research.md` (candidate 1) and the `../vercel-container-hosting/` assessment (problem G5, concept Option B, decision). Neither of those notes is repeated here.

## Problem Statement

Everyone who opens the hosted Lepak Weather app sees, and can add to or delete from, the same single list of saved locations. As the app moves from the owner alone to public users on laptop and mobile, visitors will undo each other's lists and can see the places others saved (which may reveal where they live or work). Today the only protection is that the URL isn't advertised.

## Affected Users & Stakeholders

- **Users**:
  - **Public visitor (laptop or mobile)**: expects "my places" to be theirs. Instead, places appear that they didn't add, and their own places can disappear when someone else deletes them. [source: memory `public-mobile-release`; `vercel-container-hosting/decision.md` G5]
  - **Visitor whose saved places are seen by others**: their saved locations are visible to anyone with the URL. [source: `next-value-features/research.md` Market & Context; the privacy reading is an ASSUMPTION]
  - **Owner, as a user**: their own list is mixed with everyone else's. [source: `vercel-container-hosting/problem.md` G5]
- **Stakeholders**:
  - **Owner (chuan77)**: decides scope and pays nothing today. Wants saved locations to be per user eventually, without building accounts yet. [source: `vercel-container-hosting/problem.md` Non-Goals, owner 2026-11-16]
  - **data.gov.sg (NEA)**: upstream provider. The app runs on a Development key sized for fewer than 5 users (12 requests per 10 s). Any change in how many lists get refreshed affects this budget. [source: sg-weather-api skill; `specs/011-island-rain-view/spec.md` Assumptions]

## Goals

- **G1**: A visitor sees only the saved locations they added themselves. (Closes hosting goal G5.)
- **G2**: One visitor can't add, change or delete another visitor's saved locations.
- **G3**: The app stays usable with no signup, which is how it works today. [source: hosting Non-Goals]
- **G4**: A visitor's saved locations are still there when they come back on the same device.
- **G5**: Public use stays within the data.gov.sg rate budget, with no new 429s at the expected visitor count.

## Non-Goals

- User accounts, signup, login or identity. The owner treats these as separate later work. [source: `vercel-container-hosting/problem.md` Non-Goals]
- Sharing a list with other people, or shared or team lists.
- Changing what a weather snapshot contains, or adding new weather data.
- Access gating (hosting Option C), which stays a fallback, not part of this problem.
- Fetching weather on page load. Principle I still applies.
- Scaling past the current free hosting and Development-key limits, unless G5 forces it (see Open Questions).

## Success Metrics

- Locations from other visitors shown in a visitor's list: 0. (Baseline: every visitor sees every other visitor's locations.)
- Locations a visitor can change or delete that someone else added: 0. (Baseline: all of them.)
- Visitors who must sign up before saving a location: 0. (Baseline: 0; this must not get worse.)
- A visitor's saved locations are still there after closing and reopening the app on the same device. (Baseline: yes, but shared and open to deletion by others.)
- data.gov.sg 429 responses at the expected visitor count: 0. (Baseline: 0 with fewer than 5 visitors; the expected public count is unknown.)
- Qualitative: the owner is comfortable sharing the URL publicly. (Baseline: not comfortable; the URL is deliberately unadvertised.)

## Cost of Inaction

The hosted app can't be shared publicly in good conscience. Once the URL spreads, visitors overwrite and delete each other's places, and anyone can see places others saved. The owner would keep relying on "don't advertise the URL", which is the opposite of the public mobile release goal, or would fall back to access gating (hosting Option C), which shuts out the public users the release is for. Hosting goal G5 stays open as an accepted risk. Nothing breaks technically, and with fewer than 5 visitors the harm is small today. It grows with each visitor.

## Open Questions

- [NEEDS CLARIFICATION: Is "same device only" enough for G4, or must a visitor's list follow them across devices? Across devices needs some form of identity, which conflicts with the no-accounts non-goal.]
- [NEEDS CLARIFICATION: What should a first-time visitor see: an empty list, the 10 seeded locations as defaults, or something else? And what happens to the 10 locations now in Turso?]
- [NEEDS CLARIFICATION: Expected number of public visitors, and will a Production data.gov.sg key be requested? This decides whether G5 can be met.]
- [NEEDS CLARIFICATION: Is it acceptable that a visitor's list is lost when they clear browser data or switch browsers? (Applies only if lists stay on one device.)]
- [NEEDS CLARIFICATION: Does the owner's own current list need to be kept, and if so, how does it become theirs alone?]
- [NEEDS CLARIFICATION: Which mobile weather app is being replaced? How it handles saved places sets what visitors will expect.]
