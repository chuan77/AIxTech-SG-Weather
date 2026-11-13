# Research: Outdoor Comfort Tiles

Phase 0 output for [plan.md](plan.md). Each item resolves an unknown from the Technical Context.

## R1. Steadman apparent-temperature formula

- **Decision**: Use the non-radiation form used by Australia's Bureau of Meteorology:
  - `AT = Ta + 0.33 × e − 0.70 × ws − 4.00`
  - `e = (rh / 100) × 6.105 × exp(17.27 × Ta / (237.7 + Ta))` (hPa)
  - `Ta` dry-bulb °C, `rh` relative humidity %, `ws` wind speed in m/s at 10 m.
- **Rationale**: Matches problem.md and the spec's Assumptions. Needs only temperature, humidity and wind, which every refreshed location already stores. Valid across the whole range, so no "below 27 °C" special case.
- **Evidence**: Two independent secondary sources give the same constants and attribute them to the Bureau's thermal-comfort page and Steadman (1984): a forum post quoting the Bureau page (community.tempest.earth) and the documentation of a Python package (spotforecast2 `weather.derived.apparent_temperature`). The Bureau's own page was not in the results, so confidence is medium-high, not high. The radiation form (`+0.348e … +0.70Q/(ws+10) − 4.25`) needs net radiation, which the app does not have.
- **Alternatives considered**: NWS heat index (rejected by the owner; needs fallbacks below ~27 °C, ignores wind); LLM estimate (rejected: non-deterministic, untestable offline, breaks Principle III's spirit); WBGT (deferred to step 2; it is heat strain, not comfort).

## R2. Wind unit conversion

- **Decision**: `ws (m/s) = knots × 0.514444`.
- **Rationale**: The snapshot stores `wind_speed_knots`. 1 knot = 1852 m / 3600 s = 0.514444 m/s (exact definition).
- **Note**: The station anemometer height is not documented in the data; Steadman assumes 10 m. This is accepted as a known approximation.

## R3. Rounding half-up without float error

- **Decision**: `Math.round(x * 10) / 10` (JavaScript `Math.round` rounds .5 up).
- **Correction (during implementation, 2026-11-13)**: An earlier draft said the naive form maps 26.95 to 26.9 and proposed quantising first. That was wrong: in JavaScript `26.95 * 10 === 269.5`, and a scan of every two-decimal value from 0.00 to 49.99 found no value where the naive form differs from a quantised one. The simpler form is used. The 26.95 → 27.0 case stays as a test.
- **Alternatives considered**: `toFixed(1)` (rounds via binary representation; e.g. `(1.005).toFixed(2)` is `"1.00"`); a decimal library (unnecessary dependency for one function).

## R4. Rain wording in the 2-hour forecast

- **Decision**: The umbrella note applies when the stored `condition` matches `/rain|shower|thunder/i`, or when `rainfall_mm > 0.1`.
- **Rationale**: The 2-hour forecast uses a fixed NEA vocabulary (for example Light Rain, Moderate Rain, Heavy Rain, Passing Showers, Light Showers, Showers, Heavy Showers, Thundery Showers, Heavy Thundery Showers, Heavy Thundery Showers with Gusty Winds). All rain-type entries contain one of the three stems; non-rain entries (Fair, Fair (Day), Partly Cloudy, Cloudy, Hazy, Windy, Mist, Fog) do not. The default `Not refreshed` value does not match.
- **Confidence**: medium; the vocabulary is from general knowledge of the NEA feed. Unit tests pin the expected matches so a future vocabulary change is visible.

## R5. Sunrise and sunset

- **Decision**: Compute locally in a pure frontend module using the NOAA solar-position approximation (solar declination and equation of time from the day of year, zenith 90.833° for sunrise/sunset including refraction). Show times in `Asia/Singapore` with `Intl.DateTimeFormat`, regardless of the browser's own time zone.
- **Rationale**: FR-009 forbids new provider calls; NOAA's approximation is accurate to about a minute near the equator, inside SC-005's two-minute tolerance. About 40 lines; no polar edge cases at Singapore's latitude.
- **Alternatives considered**: the `suncalc` package (accurate and small, but adds a dependency and types for one calculation; acceptable fallback if the hand-written version fails its reference tests); an external sunrise API (violates FR-009 and Principle I).
- **Verification**: Tests compare against at least three reference dates taken from a published Singapore sunrise/sunset table (captured during implementation; see quickstart).

## R6. Midnight rollover

- **Decision**: The sun-times tile reads the clock through the existing `useNow` hook (`frontend/src/components/map/useNow.ts`) on a 60-second interval and derives today's Singapore date from it.
- **Rationale**: FR-010 needs a date change without a refresh. The hook already exists and makes no network call.

## R7. Pollutant fields in the PSI response

- **Decision**: Read these keys for the location's region from `data.items[0].readings` of the `psi` response the client already fetches: `pm10_twenty_four_hourly`, `o3_eight_hour_max`, `no2_one_hour_max`, `so2_twenty_four_hourly`, `co_eight_hour_max`. Store the item's `updatedTimestamp` (falling back to `timestamp`) as the air-quality reading time.
- **Rationale**: The keys are recorded in the sg-weather-api skill's endpoint notes (verified live 2026-11-11). Using the existing `psi` payload keeps calls per refresh at 11 (FR-012, SC-003).
- **Units (display)**: PM10, O3, NO2 and SO2 in µg/m³; CO in mg/m³. Confidence: medium. The search found the averaging periods (24-h PM10, 8-h CO, 24-h SO2, 1-h NO2, 8-h O3) but not the units. Confirm against NEA's "Computation of the PSI" document before release (quickstart step 5).
- **Unit check (T021, 2026-11-13)**: partly confirmed. An unofficial copy of NEA's "Computation of the Pollutant Standards Index (PSI)" (https://fuzzyview.neocities.org/computation-of-the-pollutant-standards-index-(psi).pdf, seen via search) has breakpoint-table column headers "8-hr CO (mg/m³)" and "8-hr O₃ (µg/m³)". Its numbers were garbled, and the official NEA copy was not reached. The displayed units match, so they are unchanged. Confidence: medium-high.
- **Alternatives considered**: showing sub-indices instead of concentrations (out of scope per spec); fetching a separate dataset (adds calls).

## R8. Storage shape for pollutants

- **Decision**: Six new nullable columns on `locations`, one per pollutant plus `air_quality_observed_at`, added with a generated Drizzle migration.
- **Rationale**: Matches the existing pattern (one column per scalar reading). An `ALTER TABLE … ADD COLUMN` leaves existing rows null, which the UI shows as "No reading" until refresh (spec, Story 3 scenario 3). No back-fill.
- **Alternatives considered**: one JSON column (fewer columns but breaks the existing one-scalar-per-column pattern and complicates typing).

## R9. Where derived values live

- **Decision**: "Feels like" and sun times are derived in the frontend from stored data, in pure `.ts` modules with vitest tests. Nothing derived is stored.
- **Rationale**: Principle IV (testable logic in pure modules); the spec's Key Entities say these are recalculated whenever shown; storing them would make old rows stale after a formula fix.

## Sources

- https://community.tempest.earth/t/steadman-apparent-temperature-australian-apparent-temperature/2248 (formula, quoting the Bureau of Meteorology page)
- https://sequential-parameter-optimization.github.io/spotforecast2-safe/docs/reference/weather.derived.apparent_temperature.html (same formula, attributed to the Bureau)
- https://en.wikipedia.org/wiki/Apparent_temperature (background)
- https://federicotartarini.github.io/air-quality-weather-sg/pollutant-standards-index-singapore (PSI averaging periods)
- https://www.nea.gov.sg/our-services/pollution-control (PSI pollutants, rolling 24-hour basis)
- `~/.claude/skills/sg-weather-api/references/endpoints.md` (PSI reading keys, verified 2026-11-11)
