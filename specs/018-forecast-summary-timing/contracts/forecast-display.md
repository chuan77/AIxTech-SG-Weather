# Contract: Forecast Display

**Feature**: [spec.md](../spec.md) | **Types**: [data-model.md](../data-model.md)

What the top line, strip and sky show for a snapshot and a time. The shape of `/api/*` is unchanged. `forecast_periods[].forecast` may be an empty string.

## Module interfaces

| Module | Export | Contract |
|---|---|---|
| `components/forecastTiming.ts` (new) | `forecastOutlook(weather, now): ForecastOutlook` | Pure. Never reads the clock or throws on bad text. |
| | `stripLabels(outlook): string[]` | One label per period, in order |
| `components/periodLabel.ts` | `periodTimeLabel(instant, now): string` | Standalone words ("Tomorrow midday") |
| | `periodTimePhrase(instant, now): string` | Mid-sentence words ("tomorrow midday") |
| | `shortenPeriodLabel(label): string` | Moved here unchanged, so that `forecastTiming.ts` never imports `outdoorSummary.ts` |
| `components/outdoorSummary.ts` | `outdoorSummaryParts(weather, now): SummaryPart[]` | Weather parts, then heat, UV and PSI as today |
| | `outdoorSummary(weather, now): string \| null` | The parts joined with " · " |
| `theme/sky.ts` | `skyState(weather, now): SkyState` | Calm when stale, else storm from `stormSky`. Haze, heat and calm as today. |
| `components/HourlyStrip.tsx` | props `periods`, `labels` | Renders only. Reads no clock. |
| `components/Hero.tsx` | prop `now` | Supplied by `Layout` |

`thunderNow`, `periodStartLabel` and `periodStartPhrase` are removed, so no caller can judge "now" without a time or trust a printed date.

## Weather part of the top line

Evaluate in order at `outlook.at`.

**1. Thunder active** in either source: output `Thundery showers now` and stop.

**2. Rain part**, the first that matches:

| # | Match | Output |
|---|---|---|
| a | 2-hour rain active | `<Wording> forecast now` |
| b | 2-hour rain with an unknown time | `<Wording> forecast` |
| c | Period rain active, and the period after its run is missing or untimed | `<Wording> forecast` |
| d | Period rain active, otherwise | `<Wording> forecast until <end of run>` |
| e | Earliest upcoming rain, if there is no untimed 2-hour thunder and it starts before any upcoming thunder | `<Wording> forecast from <start>` |
| f | Period rain with an unknown time | `<Wording> forecast` |

A run is the active rain period and the unbroken timed rain periods after it. Its `<Wording>` is their shared wording, or `Rain` if they differ.

**3. Thunder part**, the first that matches:

| # | Match | Output |
|---|---|---|
| a | 2-hour thunder with an unknown time | `Thundery showers forecast` |
| b | Earliest upcoming thunder | `Thundery showers from <start>` |
| c | Period thunder with an unknown time | `Thundery showers forecast` |

Output the rain part, then the thunder part.

**4. If there is neither**, output `No storms forecast` only when all hold:
- at least one period is active or upcoming
- no active, upcoming or unknown period is `missing`
- the 2-hour forecast, in any state, is neither rain nor thunder

Steps 2 and 3 have already ruled out all other live or untimed rain and thunder.

**5. Otherwise** output nothing.

`<Wording>` is NEA's text in sentence case ("Light rain"). "Safe", "dry" and "all clear" are never output.

## Strip labels

| Period | Label |
|---|---|
| Active, fresh reading | `Now` |
| Any other with a window | `periodTimeLabel(start, now)` |
| No window | `shortenPeriodLabel(label)`, or `--` if that is empty |

A period with empty text shows `Unavailable` and no icon, keeping the icon's space.

## Time words

Clock words are `Midnight`, `Midday`, `6 am` and `1.30 pm` (minutes only when not zero). For midnight, the day is the one that ends then.

| Day, relative to viewing | Label | Mid-sentence |
|---|---|---|
| Today | `6 pm`, `Midday`, `Midnight` | `6 pm`, `midday`, `midnight` |
| Midnight that began today | `Midnight` | `midnight` |
| Tomorrow | `Tomorrow 6 am`, `Tomorrow midday` | `tomorrow 6 am` |
| Yesterday | `Yesterday 6 pm` | `yesterday 6 pm` |
| Further away | `12 Nov 6 am` | `12 Nov 6 am` |

## Sky

`skyState` decides all of this. `Layout` passes the weather as it is. The first match wins:

1. No weather, or a stale reading: `calm`, whatever its PSI or heat
2. `stormSky`: `storm`
3. `haze`, `heat`, then `calm`, by today's rules. This includes a reading with no time, as today.

## Guarantees to callers

- No network, storage or logging.
- The stale "As of" prefix and muted ink stay in `Hero`.
- Each part stays its own inline unit, with the separator at its end and a comma for screen readers.
