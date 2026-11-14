import { describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from '../types';
import { skyState } from './sky';

function snapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    condition: 'Partly Cloudy (Day)',
    forecast_periods: [],
    psi_twenty_four_hourly: null,
    wbgt_c: null,
    heat_stress_level: null,
    wbgt_station_name: null,
    wbgt_station_distance_km: null,
    wbgt_observed_at: null,
    ...overrides,
  } as WeatherSnapshot;
}

const highHeat = {
  wbgt_c: 33.4,
  heat_stress_level: 'High',
  wbgt_station_name: 'Ang Mo Kio',
  wbgt_station_distance_km: 2.1,
};

describe('skyState', () => {
  it('is calm with no snapshot or no readings', () => {
    expect(skyState(null)).toBe('calm');
    expect(skyState(snapshot())).toBe('calm');
  });

  it('is storm when the current condition is thundery', () => {
    expect(skyState(snapshot({ condition: 'Thundery Showers' }))).toBe('storm');
  });

  it('is storm when the period covering now has thunder', () => {
    const periods = [
      { label: '12 pm to 6 pm', forecast: 'Thundery Showers' },
      { label: '6 pm to 6 am', forecast: 'Cloudy' },
    ];
    expect(skyState(snapshot({ condition: 'Cloudy', forecast_periods: periods }))).toBe('storm');
  });

  it('is not storm when thunder is only forecast for a later period', () => {
    // 6:53 pm on a cloudy evening; thunder is forecast for tomorrow's midday.
    const periods = [
      { label: '6 pm 14 Nov to 6 am 15 Nov', forecast: 'Cloudy' },
      { label: '6 am to 12 pm 15 Nov', forecast: 'Partly Cloudy (Day)' },
      { label: '12 pm to 6 pm 15 Nov', forecast: 'Thundery Showers' },
    ];
    expect(skyState(snapshot({ condition: 'Cloudy', forecast_periods: periods }))).toBe('calm');
  });

  it('is haze only above PSI 100', () => {
    expect(skyState(snapshot({ psi_twenty_four_hourly: 100 }))).toBe('calm');
    expect(skyState(snapshot({ psi_twenty_four_hourly: 101 }))).toBe('haze');
  });

  it('is heat for a High reading from a nearby station', () => {
    expect(skyState(snapshot(highHeat))).toBe('heat');
  });

  it('ignores High heat stress from a station too far away to count', () => {
    expect(skyState(snapshot({ ...highHeat, wbgt_station_distance_km: 14 }))).toBe('calm');
  });

  it('is calm for Moderate heat stress', () => {
    expect(skyState(snapshot({ ...highHeat, heat_stress_level: 'Moderate' }))).toBe('calm');
  });

  it('ranks storm over haze over heat', () => {
    const all = { ...highHeat, psi_twenty_four_hourly: 160, condition: 'Thundery Showers' };
    expect(skyState(snapshot(all))).toBe('storm');
    expect(skyState(snapshot({ ...all, condition: 'Hazy' }))).toBe('haze');
    expect(skyState(snapshot({ ...all, condition: 'Hazy', psi_twenty_four_hourly: 80 }))).toBe(
      'heat',
    );
  });
});
