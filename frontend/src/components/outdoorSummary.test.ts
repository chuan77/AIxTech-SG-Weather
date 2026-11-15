import { describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from '../types';
import { outdoorSummary, psiBand, shortenPeriodLabel, uvBand } from './outdoorSummary';

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

describe('outdoorSummary', () => {
  it('returns null when nothing is known', () => {
    expect(outdoorSummary(snapshot())).toBeNull();
  });

  it('says thundery showers now when the current condition is thundery', () => {
    expect(outdoorSummary(snapshot({ condition: 'Thundery Showers' }))).toBe(
      'Thundery showers now',
    );
  });

  it('names the first forecast period with thunder', () => {
    const periods = [
      { label: '12 pm 14 Nov 2026 to 6 pm 14 Nov 2026', forecast: 'Cloudy' },
      { label: '6 pm 14 Nov 2026 to 12 am 15 Nov 2026', forecast: 'Thundery Showers' },
    ];
    expect(outdoorSummary(snapshot({ forecast_periods: periods }))).toBe(
      'Thundery showers from 6 pm 14 Nov',
    );
  });

  it('says no storms only when there is a forecast to back it', () => {
    const periods = [{ label: 'Now', forecast: 'Fair' }];
    expect(outdoorSummary(snapshot({ forecast_periods: periods }))).toBe('No storms forecast');
  });

  it('joins heat stress and PSI and skips stations that are too far away', () => {
    const near = snapshot({
      wbgt_c: 31.2,
      heat_stress_level: 'Moderate',
      wbgt_station_distance_km: 2,
      psi_twenty_four_hourly: 42.4,
    });
    expect(outdoorSummary(near)).toBe('Heat stress moderate · PSI 42 good');

    const far = snapshot({ ...near, wbgt_station_distance_km: 25 });
    expect(outdoorSummary(far)).toBe('PSI 42 good');
  });
});

describe('psiBand', () => {
  it.each([
    [null, null],
    [50, 'Good'],
    [51, 'Moderate'],
    [201, 'Very Unhealthy'],
    [301, 'Hazardous'],
  ])('maps %s to %s', (psi, band) => {
    expect(psiBand(psi)).toBe(band);
  });
});

describe('shortenPeriodLabel', () => {
  it('keeps the start and drops the year', () => {
    expect(shortenPeriodLabel('6 pm 14 Nov 2026 to 12 am 15 Nov 2026')).toBe('6 pm 14 Nov');
  });
});

describe('uvBand', () => {
  it('names High and up, and stays quiet below 6', () => {
    expect(uvBand(null)).toBeNull();
    expect(uvBand(5.9)).toBeNull();
    expect(uvBand(6)).toBe('High');
    expect(uvBand(8)).toBe('Very high');
    expect(uvBand(11)).toBe('Extreme');
  });

  it('joins the summary only when High or above', () => {
    expect(outdoorSummary(snapshot({ uv_index: 3 }))).toBeNull();
    expect(outdoorSummary(snapshot({ uv_index: 9 }))).toBe('UV very high');
  });
});
