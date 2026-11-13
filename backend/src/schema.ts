import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
  psi_twenty_four_hourly: number | null;
  pm25_one_hourly: number | null;
  air_quality_region: string | null;
  pm10_twenty_four_hourly: number | null;
  o3_eight_hour_max: number | null;
  no2_one_hour_max: number | null;
  so2_twenty_four_hourly: number | null;
  co_eight_hour_max: number | null;
  air_quality_observed_at: string | null;
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

export const locations = sqliteTable(
  'locations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
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
    psiTwentyFourHourly: real('psi_twenty_four_hourly'),
    pm25OneHourly: real('pm25_one_hourly'),
    airQualityRegion: text('air_quality_region'),
    pm10TwentyFourHourly: real('pm10_twenty_four_hourly'),
    o3EightHourMax: real('o3_eight_hour_max'),
    no2OneHourMax: real('no2_one_hour_max'),
    so2TwentyFourHourly: real('so2_twenty_four_hourly'),
    coEightHourMax: real('co_eight_hour_max'),
    airQualityObservedAt: text('air_quality_observed_at'),
    forecastPeriods: text('forecast_periods', { mode: 'json' })
      .$type<WeatherSnapshot['forecast_periods']>()
      .notNull(),
    dailyForecast: text('daily_forecast', { mode: 'json' })
      .$type<WeatherSnapshot['daily_forecast']>()
      .notNull(),
  },
  (table) => [
    uniqueIndex('locations_latitude_longitude_unique').on(table.latitude, table.longitude),
  ],
);
