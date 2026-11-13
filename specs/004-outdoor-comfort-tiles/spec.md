# Feature Specification: Outdoor Comfort Tiles

**Feature Branch**: `004-outdoor-comfort-tiles`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "with the handoff section of decision.md". Source assessment: `.specify/assessments/nea-data-new-features/` (verdict go, Option B, two steps). This spec covers **step 1 only**: a "feels like" readout with clothing advice, today's sunrise and sunset, and the pollutant breakdown behind the air-quality number. Step 2 (NEA heat-stress / WBGT tile and slower request pacing) is gated on step 1 proving useful and will be specified separately.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how hot it feels and what to wear (Priority: P1)

When I select a saved location, I see a "Feels like" temperature, a short comfort label (for example "Hot & Muggy") and one line of clothing advice. When rain is expected or falling, the advice also tells me to carry an umbrella. This lets me decide what to wear before going out without reading several tiles.

**Why this priority**: It answers the main question from the assessment ("is it comfortable to be outside now?") and uses only readings the location already has, so it delivers value on its own.

**Independent Test**: Select a refreshed location with known temperature, humidity and wind readings; check that the shown value, label and advice match the band table below.

**Acceptance Scenarios**:

1. **Given** a refreshed location with temperature, humidity and wind readings, **When** I select it, **Then** I see a "feels like" value in °C to one decimal place, the comfort label for its band and that band's clothing advice.
2. **Given** a location whose "feels like" value is exactly on a band boundary (for example 27.0), **When** I select it, **Then** the higher band is shown ("Warm", not "Breezy & Cool").
3. **Given** a location whose 2-hour forecast mentions rain, showers or thunder, **When** I select it, **Then** the advice ends with "Carry an umbrella".
4. **Given** a location whose 2-hour forecast does not mention rain but whose nearest station reports more than 0.1 mm of rainfall, **When** I select it, **Then** the advice ends with "Carry an umbrella".
5. **Given** a location with no temperature reading or no humidity reading, **When** I select it, **Then** the readout shows "No reading" with a tooltip naming the missing inputs, and no label or advice.
6. **Given** a location with temperature and humidity but no wind reading, **When** I select it, **Then** a value is still shown, marked "approx.", calculated as if the air were still.

---

### User Story 2 - See today's sunrise and sunset (Priority: P2)

When I select a saved location, I see today's sunrise and sunset times for that place, so I can plan outdoor activity around daylight.

**Why this priority**: Useful for planning but less directly tied to comfort or safety than Story 1.

**Independent Test**: Select any saved location and compare the times shown with a published sunrise/sunset table for Singapore on the same date.

**Acceptance Scenarios**:

1. **Given** any saved location, **When** I select it, **Then** I see today's sunrise and sunset in Singapore time, to the minute.
2. **Given** a location that has never been refreshed, **When** I select it, **Then** sunrise and sunset are still shown, because they depend only on the location's position and the date.
3. **Given** the dashboard stays open past midnight Singapore time, **When** I next view the location, **Then** the times shown are for the new day.

---

### User Story 3 - See what is behind the air-quality number (Priority: P3)

The air-quality readout today shows only the 24-hour PSI and PM2.5. I want to also see the individual pollutant readings that make up the PSI for my location's region, so on a bad-air day I can tell what is driving it.

**Why this priority**: Matters mainly on haze or poor-air days; marginal on most days (research.md).

**Independent Test**: Refresh a location and check that each pollutant value shown matches the official PSI reading for that location's region at the same time.

**Acceptance Scenarios**:

1. **Given** a refreshed location, **When** I open its air-quality detail, **Then** I see PM10, ozone (O3), nitrogen dioxide (NO2), sulphur dioxide (SO2) and carbon monoxide (CO) for its region, each with its unit and the time of the reading.
2. **Given** one pollutant has no reading for the region, **When** I open the detail, **Then** that pollutant shows "No reading" and the others still show values.
3. **Given** a location last refreshed before this feature existed, **When** I open the detail, **Then** each pollutant shows "No reading" until the location is refreshed, and the existing PSI and PM2.5 values still show.

---

### Edge Cases

- **Raw value between bands** (for example 26.95): the value is rounded to one decimal first (26.95 becomes 27.0), then banded, so no value falls outside a band.
- **Unrefreshed location** (default snapshot with no readings): "Feels like" shows "No reading"; sunrise/sunset still shows; pollutant detail shows "No reading".
- **Rainfall reading missing**: treated as no rain signal from the station; the umbrella note still appears if the forecast mentions rain.
- **Forecast condition missing**: the umbrella note depends on station rainfall alone.
- **Extreme readings** (for example, very low "feels like" during heavy rain): the lowest band ("Chilly") covers every value below 24.0, and the highest ("Scorching") covers every value from 37.0 up, so any value has a band.
- **Theme change**: every new readout follows the active theme like the existing tiles.
- **Narrow screen**: the new readouts stay readable at phone width without horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

**Feels like**

- **FR-001**: The dashboard MUST show a "feels like" value for the selected location, calculated with the Steadman apparent-temperature method (no solar radiation term) from that location's stored temperature, humidity and wind speed.
- **FR-002**: The value MUST be rounded half-up to one decimal place before banding, and shown in °C to one decimal place.
- **FR-003**: The rounded value MUST be assigned to exactly one band, with label and clothing advice as follows:

  | Rounded value (°C) | Label | Clothing advice |
  |---|---|---|
  | below 24.0 | Chilly | Wear a jacket or hoodie. Rare outdoor chill; layer up for wind and rain. |
  | 24.0 up to but not including 27.0 | Breezy & Cool | Bring a light layer. Comfortable in a tee, though a thin cardigan helps in breezy or damp spots. |
  | 27.0 up to but not including 32.0 | Warm | Standard light wear. Short sleeves and light trousers or shorts; no jacket needed. |
  | 32.0 up to but not including 37.0 | Hot & Muggy | Wear breathable, loose fabrics. Stick to dry-fit or light cotton; carry a UV umbrella in open sun. |
  | 37.0 and above | Scorching | Minimal, airy clothing and sun gear. Opt for moisture-wicking wear, sunglasses and a UV umbrella. |

- **FR-004**: The advice MUST end with "Carry an umbrella" when the location's 2-hour forecast mentions rain, showers or thunder, or when its nearest station reports more than 0.1 mm of rainfall. A missing rainfall reading MUST NOT stop the note when the forecast mentions rain.
- **FR-005**: If temperature or humidity is missing, the readout MUST show "No reading" with a tooltip naming the missing inputs, and MUST NOT show a label or advice.
- **FR-006**: If only wind speed is missing, the value MUST be calculated with zero wind and marked "approx.".
- **FR-007**: The feels-like readout MUST NOT use the words "Heat Stress", which are reserved for the official NEA heat-stress readout planned for step 2, and its advice MUST be limited to clothing and gear (no health or medical instructions).

**Sunrise and sunset**

- **FR-008**: The dashboard MUST show today's sunrise and sunset for the selected location's position, in Singapore time, to the minute.
- **FR-009**: Sunrise and sunset MUST be shown for every saved location, refreshed or not, and MUST NOT require any new call to the weather data provider.
- **FR-010**: Sunrise and sunset MUST update to the new date after midnight Singapore time, without needing a location refresh.

**Air-quality detail**

- **FR-011**: The dashboard MUST show, for the selected location's air-quality region, the latest PM10, O3, NO2, SO2 and CO readings from the official PSI data, each with its unit.
- **FR-012**: These readings MUST be obtained during the location's existing create or refresh, from data the app already requests for PSI, so the number of provider calls per refresh does not increase.
- **FR-013**: Any pollutant without a reading MUST show "No reading" without affecting the other pollutants or the existing PSI and PM2.5 values.

**General**

- **FR-014**: No new readout may cause a weather data call on page load or on selecting a location; data arrives only on location create or refresh, as today.
- **FR-015**: A failure or missing value in any new readout MUST NOT affect the rest of the dashboard.
- **FR-016**: Every new readout MUST follow the active theme and the existing "No reading" convention, never a blank or broken tile.

### Key Entities

- **Feels-like reading**: derived per location from stored temperature, humidity and wind. Attributes: value (°C, one decimal), band label, clothing advice, umbrella flag, "approx." flag, or a "No reading" state naming missing inputs. Not stored separately; recalculated whenever shown.
- **Daylight times**: derived per location from position and the current Singapore date. Attributes: sunrise time, sunset time.
- **Pollutant breakdown**: part of a location's stored weather snapshot. Attributes: PM10, O3, NO2, SO2, CO for the location's air-quality region, each optional, plus the reading time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a refreshed location, the owner can tell what to wear and whether to bring an umbrella from the dashboard alone, without opening another app (qualitative; checked by the owner).
- **SC-002**: For every saved location, each new readout shows either a value or an explicit "No reading" state; zero blank or broken readouts across all themes.
- **SC-003**: The number of data provider calls made by one location refresh is the same before and after this feature.
- **SC-004**: For 10 sample inputs covering every band boundary, the shown label matches the band table in FR-003 every time.
- **SC-005**: Sunrise and sunset shown for a Singapore location are within 2 minutes of a published reference table for the same date.
- **SC-006**: After using it, the owner decides whether to proceed to step 2 (heat-stress tile); this decision is recorded in the assessment folder.

## Assumptions

- Personal use for this version; the owner is the only user (problem.md).
- The Steadman apparent-temperature formula recorded in problem.md (AT = Ta + 0.33e − 0.70ws − 4.00, with e the vapour pressure from humidity and ws wind speed in m/s) is correct; to be confirmed from a primary source during planning.
- Stored wind speed is in knots and is converted to m/s for the calculation.
- The 2-hour forecast condition text is the source for "mentions rain, showers or thunder"; matching is done on the forecast wording.
- Sunrise and sunset are calculated locally from position and date; no provider supplies them.
- The PSI response the app already requests contains the five pollutant readings for each region (research.md, verified 2026-11-11).
- Locations saved before this feature show "No reading" for pollutant detail until refreshed; no migration of old readings is attempted.
- Out of scope: the NEA heat-stress (WBGT) tile, request pacing changes and Prod-key handling (step 2); research Priorities 4-9; sunrise/sunset on the hourly strip or forecasts; pollutant sub-indices; any LLM-generated content; alerts and notifications.
