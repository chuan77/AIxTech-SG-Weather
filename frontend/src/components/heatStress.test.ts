import { describe, expect, it } from 'vitest';
import { HEAT_STRESS_GUIDANCE, WBGT_MAX_STATION_KM, heatStressView } from './heatStress';
import type { WeatherSnapshot } from '../types';

function weather(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    condition: 'Fair',
    observed_at: null,
    source: null,
    area: null,
    valid_period_text: null,
    temperature_c: null,
    humidity_percent: null,
    rainfall_mm: null,
    wind_speed_knots: null,
    wind_direction_degrees: null,
    forecast_low_c: null,
    forecast_high_c: null,
    uv_index: null,
    psi_twenty_four_hourly: null,
    pm25_one_hourly: null,
    air_quality_region: null,
    pm10_twenty_four_hourly: null,
    o3_eight_hour_max: null,
    no2_one_hour_max: null,
    so2_twenty_four_hourly: null,
    co_eight_hour_max: null,
    air_quality_observed_at: null,
    wbgt_c: 29.34,
    heat_stress_level: 'Low',
    wbgt_station_name: 'Bishan Street',
    wbgt_station_distance_km: 0.42,
    wbgt_observed_at: '2026-11-14T11:45:00+08:00',
    forecast_periods: [],
    daily_forecast: [],
    ...overrides,
  };
}

describe('heatStressView', () => {
  it('shows a reading with value, station, distance and SGT time', () => {
    expect(heatStressView(weather())).toEqual({
      kind: 'reading',
      value: '29.3',
      level: 'Low',
      tone: 'low',
      guidance: null,
      stationName: 'Bishan Street',
      distanceKm: '0.4',
      observedAt: '11:45',
    });
  });

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY])(
    'has no reading when WBGT is %s',
    (value) => {
      expect(heatStressView(weather({ wbgt_c: value }))).toEqual({ kind: 'no-reading' });
    },
  );

  it('has no reading when the station distance is missing', () => {
    expect(heatStressView(weather({ wbgt_station_distance_km: null }))).toEqual({
      kind: 'no-reading',
    });
  });

  it('checks for a missing reading before the distance', () => {
    expect(heatStressView(weather({ wbgt_c: null, wbgt_station_distance_km: 25 }))).toEqual({
      kind: 'no-reading',
    });
  });

  it('reports no nearby station beyond 10 km and names the nearest one', () => {
    expect(
      heatStressView(
        weather({ wbgt_station_name: 'Tuas Terminal Gateway', wbgt_station_distance_km: 10.1 }),
      ),
    ).toEqual({
      kind: 'no-nearby-station',
      tooltip: 'Nearest station: Tuas Terminal Gateway, 10.1 km away',
    });
  });

  it('treats exactly 10.0 km as nearby', () => {
    expect(heatStressView(weather({ wbgt_station_distance_km: 10 })).kind).toBe('reading');
    expect(WBGT_MAX_STATION_KM).toBe(10);
  });

  it.each([
    ['Low', 'low', null],
    ['moderate ', 'moderate', HEAT_STRESS_GUIDANCE.moderate],
    ['HIGH', 'high', HEAT_STRESS_GUIDANCE.high],
  ])('maps level %j to tone %s with the right guidance', (level, tone, guidance) => {
    expect(heatStressView(weather({ heat_stress_level: level }))).toMatchObject({
      tone,
      guidance,
    });
  });

  it('shows an unrecognised level as given, with no guidance', () => {
    expect(heatStressView(weather({ heat_stress_level: 'Extreme' }))).toMatchObject({
      level: 'Extreme',
      tone: 'unknown',
      guidance: null,
    });
  });

  it('gives advisory-level guidance only for Moderate and High', () => {
    expect(HEAT_STRESS_GUIDANCE.moderate).toMatch(/outdoor activity/);
    expect(HEAT_STRESS_GUIDANCE.high).toMatch(/outdoor activity/);
  });
});
