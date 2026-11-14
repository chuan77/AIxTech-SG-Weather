import { describe, expect, it } from 'vitest';
import {
  BANDS,
  apparentTemperature,
  bandFor,
  feelsLike,
  knotsToMs,
  needsUmbrella,
  roundHalfUp1,
} from './feelsLike';
import type { WeatherSnapshot } from '../types';

function weather(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    condition: 'Fair',
    observed_at: null,
    source: null,
    area: null,
    valid_period_text: null,
    temperature_c: 30,
    humidity_percent: 70,
    rainfall_mm: 0,
    wind_speed_knots: 0,
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
    wbgt_c: null,
    heat_stress_level: null,
    wbgt_station_name: null,
    wbgt_station_distance_km: null,
    wbgt_observed_at: null,
    forecast_periods: [],
    daily_forecast: [],
    ...overrides,
  };
}

describe('apparentTemperature (Steadman, non-radiation)', () => {
  // Hand-computed: e = 0.70 × 6.105 × exp(17.27×30/267.7) = 29.6010; AT = 30 + 0.33e − 0.70×2 − 4.
  it('matches a hand-computed value', () => {
    expect(apparentTemperature(30, 70, 2)).toBeCloseTo(34.37, 2);
    expect(apparentTemperature(30, 70, 0)).toBeCloseTo(35.77, 2);
    expect(apparentTemperature(26, 90, 1.5)).toBeCloseTo(30.9, 2);
  });

  it('converts knots to m/s', () => {
    expect(knotsToMs(10)).toBeCloseTo(5.14444, 5);
  });
});

describe('roundHalfUp1', () => {
  it('rounds half up to one decimal', () => {
    expect(roundHalfUp1(26.95)).toBe(27);
    expect(roundHalfUp1(26.94)).toBe(26.9);
    expect(roundHalfUp1(31.95)).toBe(32);
    expect(roundHalfUp1(36.96)).toBe(37);
  });
});

describe('bandFor', () => {
  it.each([
    [23.9, 'chilly'],
    [24.0, 'breezy-cool'],
    [26.9, 'breezy-cool'],
    [27.0, 'warm'],
    [31.9, 'warm'],
    [32.0, 'hot-muggy'],
    [36.9, 'hot-muggy'],
    [37.0, 'scorching'],
    [10, 'chilly'],
    [45, 'scorching'],
  ])('%s °C is %s', (value, id) => {
    expect(bandFor(value).id).toBe(id);
  });

  it('never uses the words "Heat Stress"', () => {
    for (const band of BANDS) {
      expect(`${band.label} ${band.advice}`).not.toMatch(/heat stress/i);
    }
  });
});

describe('needsUmbrella', () => {
  it.each([
    'Light Rain',
    'Passing Showers',
    'Thundery Showers',
    'Heavy Thundery Showers with Gusty Winds',
  ])('is true for forecast "%s"', (condition) => {
    expect(needsUmbrella(condition, null)).toBe(true);
  });

  it.each(['Fair', 'Partly Cloudy', 'Cloudy', 'Hazy', 'Not refreshed'])(
    'is false for forecast "%s" with no rain at the station',
    (condition) => {
      expect(needsUmbrella(condition, 0)).toBe(false);
    },
  );

  it('uses station rainfall above 0.1 mm', () => {
    expect(needsUmbrella('Cloudy', 0.2)).toBe(true);
    expect(needsUmbrella('Cloudy', 0.1)).toBe(false);
  });

  it('does not let missing rainfall block a rainy forecast', () => {
    expect(needsUmbrella('Showers', null)).toBe(true);
  });

  it('falls back to rainfall when the condition is missing', () => {
    expect(needsUmbrella(null, 0.2)).toBe(true);
    expect(needsUmbrella(null, null)).toBe(false);
  });
});

describe('feelsLike', () => {
  it('returns value, band, advice and flags for complete readings', () => {
    const result = feelsLike(weather({ wind_speed_knots: 2 / 0.514444 }));
    expect(result).toMatchObject({ kind: 'value', value: 34.4, approx: false, umbrella: false });
    if (result.kind === 'value') expect(result.band.id).toBe('hot-muggy');
  });

  it('reports which inputs are missing', () => {
    expect(feelsLike(weather({ temperature_c: null }))).toEqual({
      kind: 'no-reading',
      missing: ['temperature'],
    });
    expect(feelsLike(weather({ humidity_percent: null }))).toEqual({
      kind: 'no-reading',
      missing: ['humidity'],
    });
    expect(feelsLike(weather({ temperature_c: null, humidity_percent: Number.NaN }))).toEqual({
      kind: 'no-reading',
      missing: ['temperature', 'humidity'],
    });
  });

  it('computes with still air and marks approx when wind is missing', () => {
    const result = feelsLike(weather({ wind_speed_knots: null }));
    expect(result).toMatchObject({ kind: 'value', value: 35.8, approx: true });
  });

  it('flags the umbrella from the forecast wording', () => {
    expect(feelsLike(weather({ condition: 'Thundery Showers' }))).toMatchObject({ umbrella: true });
  });
});
