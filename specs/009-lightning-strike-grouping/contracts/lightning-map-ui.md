# Contract: lightning layer on the map (UI)

Observable behaviour the browser checks (`scripts/e2e/lightning-grouping.sh`) and the manual quickstart verify. The terms are defined in [data-model.md](../data-model.md).

## DOM hooks (stable, used by checks)

| Selector | What it is |
|---|---|
| `.leaflet-lightning-pane` | the lightning pane (z-index 450, below `.leaflet-marker-pane`), as spec 007 |
| `.strike-mark` | a single bolt (spec 007 markup and CSS unchanged) |
| `.strike-group` | a group mark wrapper, with `data-count` (the exact integer), `data-step` (0–11) and `data-splittable` (`true` / `false`) |
| `.strike-group__count` | the abbreviated count text ("12", "1.2k", "37k") |
| `.strike-group__age` | the age label text ("now", "2m" … "59m") |
| `.strike-group-list` | the list popup content of an unsplittable group |

Marks carry no `tabindex` and aren't focusable (FR-018).

## Props (component boundary)

| Component | Prop | Contract |
|---|---|---|
| `WeatherMap` | `showLightning?: boolean` (default `true`) | when `false`, the map's lightning layer is empty and does no work |
| `WeatherMap` | `onLightningGroupSelect?: (view: MapView) => void` | when set, selecting a group calls it with `{ center, zoom }` instead of zooming this map |
| `MapCard` | — | passes `showLightning={!expanded}` and `onLightningGroupSelect`, which opens fullscreen with `initialView = view` |

## Interactions

| Where | Action | Result |
|---|---|---|
| Fullscreen | select a splittable group | the map moves to the group centre at `min(expansionZoom, 20)` (`setView` without animation under reduced motion) |
| Fullscreen or card | select an unsplittable group | the list popup opens: ≤ 20 rows, newest first, each "label · h:mm am/pm · N min ago", then "and N more" if the count is over 20 |
| Card | tap or click a group | fullscreen opens centred on the group at `min(expansionZoom, 20)`; the card map doesn't move |
| Any | select a single bolt | today's popup (label, time, minutes ago) |
| Any | select a pin over a lightning mark | the pin is selected (pins sit above lightning) |
| Any | theme switch | marks recolour immediately; no `POST /api/lightning/refresh` |

## Timing record (developer console only)

`console.info('[lightning] refresh timing', record)`, as in spec 007, with `record.groups: number` and `record.bolts: number` added. `drawMs` covers applying the observation through the second animation frame after the marks are on the map (research §9).

## Status strip

The count uses grouping separators: `"37,242 strikes in the last hour"`, `"1 strike in the last hour"`. Other states keep their spec 002 and 007 wording.
