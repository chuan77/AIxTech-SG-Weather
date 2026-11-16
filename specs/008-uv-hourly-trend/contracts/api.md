# Contracts: API changes for the UV trend

There are no new endpoints and no new upstream calls. Existing routes change only by carrying one extra snapshot field.

## `GET /api/locations`, `POST /api/locations`, `POST /api/locations/:id/refresh`

Each location's `weather` object gains `uv_hourly`:

```json
{
  "uv_index": 2,
  "uv_hourly": {
    "date": "2026-11-15",
    "as_of": "2026-11-15T15:11:20+08:00",
    "readings": [
      { "hour": "2026-11-15T07:00:00+08:00", "value": 0 },
      { "hour": "2026-11-15T08:00:00+08:00", "value": 0 },
      { "hour": "2026-11-15T09:00:00+08:00", "value": 1 },
      { "hour": "2026-11-15T10:00:00+08:00", "value": 2 },
      { "hour": "2026-11-15T11:00:00+08:00", "value": 4 },
      { "hour": "2026-11-15T12:00:00+08:00", "value": 4 },
      { "hour": "2026-11-15T13:00:00+08:00", "value": 1 },
      { "hour": "2026-11-15T14:00:00+08:00", "value": 2 },
      { "hour": "2026-11-15T15:00:00+08:00", "value": 2 }
    ]
  }
}
```

- `uv_hourly` is `null` when the location is unrefreshed, was refreshed before this feature, or the UV fetch failed. `readings` may be an empty array, and any `value` may be `null`.
- `readings` is ordered oldest first. `date` is the provider record's own day, so a refresh between about 19:11 and 07:11 SGT carries the previous day (research R2).
- `GET /api/locations` still reads only SQLite and makes no provider call (Principle I).
- A failed UV fetch MUST NOT change the status code of create or refresh. `uv_index` and `uv_hourly` are both `null`, and the rest of the snapshot is returned.

## Upstream call (unchanged)

`GET {apiBase}/v2/real-time/api/uv`: the same single call per refresh, through the shared `ProviderRequester`. The refresh call count stays the same (12 per plan research, confirmed and pinned by a test in T010; spec FR-002, SC-003). Only `data.records[0]` is read: `date`, `timestamp`, `updatedTimestamp`, `index[] { hour, value }`.
