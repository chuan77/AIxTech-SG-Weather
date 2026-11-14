---
title: Derived tiles
description: Feels-like temperature, heat-stress display and sunrise/sunset, computed in the browser from stored data.
sidebar:
  order: 3
---

Three tiles are computed on the client from stored data and make no calls of their own. All are pure modules with unit tests, which is the pattern for any logic worth testing in the frontend.

```mermaid
flowchart LR
  Snap["Stored WeatherSnapshot<br/>temperature, humidity,<br/>wind speed, condition, rainfall"] --> FL["feelsLike.ts"] --> FLT["Feels like tile"]
  WB["Stored WBGT fields<br/>value, level, station, distance"] --> HS["heatStress.ts<br/>10 km cut-off"] --> HST["Heat Stress tile"]
  Coords["Location latitude / longitude"] --> ST["sunTimes.ts"]
  Clock["useNow(60 s)<br/>today in Singapore"] --> ST --> SunT["Sunrise / Sunset tile"]
```

## Feels like (`components/feelsLike.ts`)

Steadman apparent temperature, the non-radiation form used by Australia's Bureau of Meteorology:

```text
AT = Ta + 0.33·e − 0.70·ws − 4.00
e  = (RH / 100) · 6.105 · exp(17.27·Ta / (237.7 + Ta))     water vapour pressure, hPa
```

`Ta` is air temperature in °C, `RH` relative humidity in %, `ws` wind speed in m/s (converted from knots). The result is rounded half-up to one decimal.

- **No reading:** if temperature or humidity is missing, the tile shows "No reading" with a hint such as "Needs temperature and humidity".
- **Approximate:** if wind is missing, it is treated as 0 and the value is marked approximate.

The value picks a comfort band. Lower bounds are inclusive.

| Band | From (°C) | Advice (shortened) |
| --- | --- | --- |
| Chilly | below 24 | Jacket or hoodie |
| Breezy & Cool | 24 | Light layer |
| Warm | 27 | Standard light wear |
| Hot & Muggy | 32 | Breathable, loose fabrics; UV umbrella in open sun |
| Scorching | 37 | Minimal clothing and sun gear |

An umbrella note appears when the 2-hour forecast mentions rain, showers or thunder, or the nearest station recorded more than 0.1 mm of rain.

## Heat stress (`components/heatStress.ts`)

The WBGT reading itself is official NEA data fetched on refresh (see [Weather provider](/backend/weather-provider/#upstream-calls)). `heatStressView(weather)` decides what the tile shows:

```mermaid
flowchart TD
  Start["heatStressView(weather)"] --> A{"wbgt_c and distance<br/>are finite numbers?"}
  A -- no --> NR["No reading"]
  A -- yes --> B{"distance > 10 km?"}
  B -- yes --> NN["No nearby station<br/>tooltip names the station"]
  B -- no --> R["Reading: value, level,<br/>station · km · HH:mm"]
  R --> G{"level"}
  G -- Moderate / High --> Guide["plus one guidance line"]
  G -- Low / other --> NoGuide["no guidance"]
```

- **Cut-off:** `WBGT_MAX_STATION_KM = 10`. Exactly 10.0 km counts as nearby. Against the current 30 stations, every main-island point checked is within about 6.5 km.
- **Levels:** NEA's bands are Low below 31 °C, Moderate 31 to below 33 °C, High 33 °C and above. The tile shows NEA's label as stored. Matching is case-insensitive; an unknown label is shown as given, with no guidance.
- **Guidance:** `HEAT_STRESS_GUIDANCE` holds one advisory-level line each for Moderate and High (reduce or minimise outdoor activity, shade, water). No medical advice.
- **Styling:** High is emphasised more than Moderate using only `white/*` classes, so it follows every theme. A scale bar covers 25 to 35 °C.
- **Naming:** only this tile uses the words "Heat Stress". `feelsLike.test.ts` checks that the feels-like tile never does.

## Sunrise and sunset (`components/sunTimes.ts`)

NOAA's general solar position approximation: fractional year, then equation of time and solar declination, then the hour angle at a zenith of 90.833° (which allows for refraction and the sun's radius). It is accurate to about a minute near the equator and makes no network call.

The date is always today's date in Singapore (`singaporeDate()`), whatever the browser's time zone, and times are formatted in Singapore time. The tile re-reads the clock every 60 seconds, so it rolls over at midnight without a reload.
