# Contract: Location weather snapshot (additive change)

Affects every endpoint that returns a location, because each one embeds the same `weather` object:

- `GET /api/locations`
- `GET /api/locations/:locationId`
- `POST /api/locations` (201)
- `POST /api/locations/:id/refresh`

No new endpoints. No request changes. No change to when the server calls data.gov.sg: still only on
create and refresh (constitution Principle I), and still the same number of upstream calls per
refresh (spec FR-012, SC-003).

## Added fields on `weather`

All six are always present, and each is `number | null` or `string | null`.

```json
{
  "weather": {
    "...existing fields unchanged...": "",
    "pm10_twenty_four_hourly": 18,
    "o3_eight_hour_max": 34,
    "no2_one_hour_max": 22,
    "so2_twenty_four_hourly": 4,
    "co_eight_hour_max": 0.4,
    "air_quality_observed_at": "2026-11-13T15:00:00+08:00"
  }
}
```

| Field | Type | Meaning |
|---|---|---|
| `pm10_twenty_four_hourly` | number \| null | PM10 24-hour average for `air_quality_region` |
| `o3_eight_hour_max` | number \| null | Ozone 8-hour maximum |
| `no2_one_hour_max` | number \| null | Nitrogen dioxide 1-hour maximum |
| `so2_twenty_four_hourly` | number \| null | Sulphur dioxide 24-hour average |
| `co_eight_hour_max` | number \| null | Carbon monoxide 8-hour maximum |
| `air_quality_observed_at` | string \| null | Provider timestamp of the PSI reading (ISO 8601, `+08:00`) |

- `null` means no reading: the provider call failed, the region had no value, the location is not
  refreshed yet, or it was last refreshed before this change.
- Units are not part of the contract; the UI applies them (see [data-model.md](../data-model.md)).
- Existing fields keep their names, types and meaning. Clients that ignore the new fields are unaffected.

## UI contract (readouts)

| Readout | Shown when | Value state | No-reading state |
|---|---|---|---|
| Feels like | a location is selected | `NN.N°` + band label + advice (+ "Carry an umbrella"; + "approx." if wind missing) | "No reading", tooltip names missing temperature and/or humidity |
| Sunrise / sunset | a location is selected (refreshed or not) | `HH:MM` SGT for both | none; always computable |
| Air-quality detail | user expands the air-quality readout | five pollutant rows, value + unit, plus reading time | per-row "No reading" |

All three follow the active theme (`white` classes, `rounded-card`) and must not contain the phrase
"Heat Stress".
