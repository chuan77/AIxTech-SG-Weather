import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** One hourly UV index reading from data.gov.sg (nationwide, measured at Changi). */
export interface UvReading {
  /** ISO start of the hour with Singapore offset, e.g. '2026-11-15T11:00:00+08:00'. */
  hour: string;
  /** UV index; null when the provider value isn't numeric (never 0 for missing). */
  value: number | null;
}

/** The day's hourly UV readings from the same `uv` response as `uv_index`. */
export interface UvDay {
  /** 'YYYY-MM-DD' Singapore calendar day, from the provider record (previous day overnight). */
  date: string;
  /** When the provider last updated the readings (`updatedTimestamp`), not the refresh time. */
  as_of: string | null;
  /** Oldest first; may be empty. */
  readings: UvReading[];
}

export interface WeatherSnapshot {
  condition: string | null;
  observed_at: string | null;
  source: string | null;
  area: string | null;
  valid_period_text: string | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  rainfall_mm: number | null;
  wind_speed_knots: number | null;
  wind_direction_degrees: number | null;
  forecast_low_c: number | null;
  forecast_high_c: number | null;
  uv_index: number | null;
  uv_hourly: UvDay | null;
  psi_twenty_four_hourly: number | null;
  pm25_one_hourly: number | null;
  air_quality_region: string | null;
  pm10_twenty_four_hourly: number | null;
  o3_eight_hour_max: number | null;
  no2_one_hour_max: number | null;
  so2_twenty_four_hourly: number | null;
  co_eight_hour_max: number | null;
  air_quality_observed_at: string | null;
  wbgt_c: number | null;
  heat_stress_level: string | null;
  wbgt_station_name: string | null;
  wbgt_station_distance_km: number | null;
  wbgt_observed_at: string | null;
  forecast_periods: Array<{
    label: string;
    forecast: string;
  }>;
  daily_forecast: Array<{
    date: string;
    forecast: string;
    temperature_low_c: number | null;
    temperature_high_c: number | null;
  }>;
}

/**
 * One anonymous visitor (spec 013): a browser known only by the SHA-256 of the random key it holds.
 * The key itself is never stored, logged or sent anywhere but the `X-Visitor-Key` header.
 */
export const visitors = sqliteTable('visitors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Lowercase hex SHA-256 of the 43-character browser key. */
  keyHash: text('key_hash').notNull().unique(),
  createdAt: text('created_at').notNull(),
  /** Bumped by any use at most once an hour; visitors unused for 90 days are swept. */
  lastUsedAt: text('last_used_at').notNull(),
});

export type VisitorRow = typeof visitors.$inferSelect;

export const locations = sqliteTable(
  'locations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Owner (visitors.id). Null only for rows saved before spec 013, until the owner claims them.
    // No foreign key: adding one makes drizzle-kit rebuild the table (spec 013 research R4).
    visitorId: integer('visitor_id'),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    createdAt: text('created_at').notNull(),
    condition: text('condition'),
    observedAt: text('observed_at'),
    source: text('source'),
    area: text('area'),
    validPeriodText: text('valid_period_text'),
    temperatureC: real('temperature_c'),
    humidityPercent: real('humidity_percent'),
    rainfallMm: real('rainfall_mm'),
    windSpeedKnots: real('wind_speed_knots'),
    windDirectionDegrees: real('wind_direction_degrees'),
    forecastLowC: real('forecast_low_c'),
    forecastHighC: real('forecast_high_c'),
    uvIndex: real('uv_index'),
    // Nullable: rows refreshed before this column existed read null (pre-feature state).
    uvHourly: text('uv_hourly', { mode: 'json' }).$type<UvDay>(),
    psiTwentyFourHourly: real('psi_twenty_four_hourly'),
    pm25OneHourly: real('pm25_one_hourly'),
    airQualityRegion: text('air_quality_region'),
    pm10TwentyFourHourly: real('pm10_twenty_four_hourly'),
    o3EightHourMax: real('o3_eight_hour_max'),
    no2OneHourMax: real('no2_one_hour_max'),
    so2TwentyFourHourly: real('so2_twenty_four_hourly'),
    coEightHourMax: real('co_eight_hour_max'),
    airQualityObservedAt: text('air_quality_observed_at'),
    wbgtC: real('wbgt_c'),
    heatStressLevel: text('heat_stress_level'),
    wbgtStationName: text('wbgt_station_name'),
    wbgtStationDistanceKm: real('wbgt_station_distance_km'),
    wbgtObservedAt: text('wbgt_observed_at'),
    forecastPeriods: text('forecast_periods', { mode: 'json' })
      .$type<WeatherSnapshot['forecast_periods']>()
      .notNull(),
    dailyForecast: text('daily_forecast', { mode: 'json' })
      .$type<WeatherSnapshot['daily_forecast']>()
      .notNull(),
  },
  (table) => [
    // One place per coordinate within a visitor's list; different visitors may share coordinates.
    uniqueIndex('locations_visitor_latitude_longitude_unique').on(
      table.visitorId,
      table.latitude,
      table.longitude,
    ),
  ],
);
