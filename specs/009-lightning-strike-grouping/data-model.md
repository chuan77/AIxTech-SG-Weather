# Data Model: Lightning Strike Grouping

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Nothing here is stored in SQLite or in any `WeatherSnapshot` (constitution Principle I lightning exception). The server-side data is unchanged. Everything new lives in the browser and only for display.

## LightningStrike (unchanged)

As in spec 002 and `backend/src/lightning.ts`: `id` (`occurred_at|latitude|longitude`), `latitude`, `longitude`, `occurred_at` (ISO), `type`, `label`. It is the single source for groups, single bolts, the status-strip count and the Hero's "near you" check (FR-014).

## LightningObservation (unchanged shape)

`strikes`, `window_minutes: 60`, `fetched_at`, `provider_updated_at`, `stale`. Sent compressed over HTTP (see [contracts/lightning-refresh.md](./contracts/lightning-refresh.md)).

## StrikeIndex (new, browser only)

A spatial index of the in-window strikes, built from one observation.

| Field | Meaning |
|---|---|
| `observation` | the observation it was built from (rebuilt only when this changes) |
| `strikeIds` | the set of strike ids indexed. When a tick drops strikes past 60 min, the set changes and the index is rebuilt |
| each indexed point | strike position, plus `{ id, occurredAtMs }` |
| each group | count, `newestAtMs` (the max of its points' `occurredAtMs`), centre position, group id |

Options (named constants, research §3): radius 40 px (revised from 60 during implementation), minPoints 2, minZoom 0, maxZoom 20.

**Rules**:
- Strikes outside the 60-minute window or with unparseable times are excluded before indexing, using today's `visibleStrikes`.
- Rebuild triggers: a new observation, or a tick that changes the in-window set. Theme changes and pans never rebuild.

## LightningMark (new, browser only): one thing drawn on the map

A tagged union produced for the current view (padded bounds plus zoom) and the current time.

| Field | Group mark | Single bolt |
|---|---|---|
| `key` | `g:<groupId>@<zoom>:<lat>,<lng>` (6 decimals; ids repeat across index rebuilds, so the position keeps an unchanged group stable and a moved one replaced) | `s:<strike.id>` |
| `kind` | `'group'` | `'bolt'` |
| `position` | the group's centre | the strike's position |
| `count` | number of strikes (≥ 2) | — |
| `countLabel` | `formatGroupCount(count)`: "12", "980", "1.2k", "37k" | — |
| `sizeBand` | `small` (<100), `medium` (<1,000), `large` (≥1,000) | — |
| `newestAtMs` | the newest strike in the group | the strike's time |
| `step` | `strikeStep(newest, now)`, 0–11 (5-minute steps, spec 007) | same |
| `ageLabel` | "now" under 1 min, else "Nm", 1–59 | — (the bolt's popup gives the minutes) |
| `expansionZoom` | `getClusterExpansionZoom(groupId)` | — |
| `splittable` | `expansionZoom ≤ 20` | — |

**Appearance key** (decides whether `setIcon` is needed): bolts use `step`; groups use `step|countLabel|ageLabel|sizeBand`. A mark whose key and appearance are both unchanged is left alone.

## MarkDiff (new, browser only)

The result of comparing the marks on the map with the marks wanted for the view.

| Field | Meaning |
|---|---|
| `add` | marks wanted but not on the map |
| `remove` | keys on the map but not wanted |
| `restyle` | marks on the map whose appearance key changed |

There are no "move" entries. A group's key includes the zoom, so after a zoom change it gets a new key (remove plus add). At one zoom, the same group id keeps its position until the index is rebuilt.

## GroupListPopup (new, browser only)

Shown for an unsplittable group (`splittable = false`). It holds up to 20 of the group's strikes, newest first, from `getLeaves`. Each row is today's popup text (`formatStrikePopup`: label, clock time, "N min ago"). A final "and N more" appears when the count is over 20.

## LightningTimingRecord (extended)

Spec 007's record (`frontend/src/components/map/lightningTiming.ts`) gains `groups: number` and `bolts: number`, the marks drawn for the observation. `drawMs` now runs from the start of applying the observation in the layer to the second animation frame after the marker diff (research §9).

## StormReplayFixture (new, development and tests)

File `backend/fixtures/lightning-storm-2026-11-16.json.gz`:

| Field | Value |
|---|---|
| `source` | text describing the capture |
| `captured_at` | `2026-11-16T09:08:37.184Z` (the original `fetched_at`) |
| `provider_updated_at` | as captured |
| `window_minutes` | 60 |
| `fields` | `["latitude","longitude","occurred_at","type","label"]` |
| `strikes` | 37,242 arrays in that field order |

When loaded, every `occurred_at` is shifted by `now − captured_at`, and `id` is rebuilt as `occurred_at|latitude|longitude`.

## State transitions: one map's lightning layer

```text
off ──(layer enabled + observation)──► building ──► drawn
drawn ──(pan / zoom end)──► diff only ──► drawn
drawn ──(30 s tick, no expiry)──► restyle only ──► drawn
drawn ──(tick with expiry | new observation)──► building ──► drawn
drawn ──(theme change)──► nothing to do (colours are CSS variables; no rebuild, no setIcon) ──► drawn
any ──(layer disabled | showLightning=false)──► off (layer group emptied)
```
