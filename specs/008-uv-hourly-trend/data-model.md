# Data Model: Today's UV Trend in the UV Tile

## Stored: `WeatherSnapshot.uv_hourly` (new, nullable)

Added to `WeatherSnapshot` in `backend/src/schema.ts` and `frontend/src/types.ts`. Stored in the new nullable JSON text column `locations.uv_hourly` (Drizzle `text('uv_hourly', { mode: 'json' })`), by generated migration `backend/drizzle/0003_*.sql`.

```text
UvDay {
  date:     string          // 'YYYY-MM-DD', Singapore calendar day, from the provider record's `date`
  as_of:    string | null   // ISO time the provider last updated the record (`updatedTimestamp`); the tile's "as of", never the refresh time
  readings: UvReading[]     // oldest first; may be empty
}

UvReading {
  hour:  string             // ISO start of the hour, Singapore offset, e.g. '2026-11-15T11:00:00+08:00'
  value: number | null      // UV index; null when the provider value isn't numeric
}
```

**Validation and normalisation** (in `SingaporeWeatherClient.fetchUvIndex`, research R2 and R6):
- Built from `data.records[0]`, the same record that already gives `uv_index`. No extra request.
- `date` is taken from `record.date`. If that's missing or unparseable, use the Singapore date of the first (oldest) kept reading's `hour` (an ISO time with `+08:00`). If there are no readings, use the Singapore date of `record.timestamp`. Only when none of these can be read is `uv_hourly` `null`, so a fresh snapshot is never mistaken for a pre-feature one.
- Readings are reordered oldest first. Entries without a parseable `hour` are dropped. A non-numeric `value` becomes `null` (`numberOrNull`), never 0.
- Duplicate hours keep the first occurrence in provider order (the newest value).
- `uv_index` and its timestamp are unchanged (still `index[0]`).

**States** (research R6):

| `uv_index` | `uv_hourly` | Meaning | Tile shows |
|---|---|---|---|
| null | null | UV fetch failed or never refreshed | "Unavailable" (as today) |
| number | null | Refreshed before this feature | Current value, band, gauge, plus "Hourly view appears after the next refresh" |
| any | `readings: []` | Provider returned an empty list | "No UV readings yet" |
| any | readings present | Normal | Hourly view |

**Lifecycle**: replaced in full on every create or refresh (snapshot pattern, Principle I). Never appended to and never kept beyond the next refresh. Identical across locations refreshed at the same time (nationwide value).

## Derived (frontend only, not stored): `UvTrendView`

Produced by the new pure module `frontend/src/components/uvTrend.ts` from `(uv_index, uv_hourly, now)`.

```text
UvTrendView =
  | { kind: 'unavailable' }
  | { kind: 'pre-feature' }
  | { kind: 'empty' }
  | { kind: 'readings',
      isToday:   boolean            // uv_hourly.date === Singapore date of `now`
      dayLabel:  string | null      // null when today; '14 Nov' otherwise
      asOf:      string | null      // 'HH:MM' SGT from as_of; null on previous days
      slots:     UvSlot[13]         // 07:00 … 19:00, always 13
      direction: 'Rising' | 'Steady' | 'Falling' | null   // null unless isToday and ≥ 2 numeric readings
      hoursAtModerateOrAbove: number                      // numeric readings with value ≥ 3
    }

UvSlot {
  hour:   number                    // 7 … 19
  value:  number | null             // null = empty slot (not reported, or non-numeric)
  band:   'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme' | null
  inPeakWindow: boolean             // 11 ≤ hour < 15 (NEA's 11 am – 3 pm)
}
```

Rules (spec FR-003 to FR-012, research R7):
- Slots are 07 to 19 inclusive. A reading whose hour is outside that range is ignored for slots but still counted.
- Band boundaries are shared with the existing `uvLabel` (≤2 Low, ≤5 Moderate, ≤7 High, ≤10 Very High, else Extreme). Both move into `uvTrend.ts` as `uvBandName()` so the tile label and the slots can't disagree.
- Direction uses the last two numeric readings in time order, skipping nulls.
- An empty slot carries `value: null` and is never rendered as 0.
