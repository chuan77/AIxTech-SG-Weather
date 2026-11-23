import { describe, expect, it } from 'vitest';
import {
  A,
  B,
  C,
  DRY,
  THUNDER,
  W,
  period,
  periodSweep,
  sgt,
  snapshotAt,
  SWEEP_TIMEOUT_MS,
  twoHourSweep,
} from '../components/forecastFixtures';
import { outdoorSummaryParts } from '../components/outdoorSummary';
import type { WeatherSnapshot } from '../types';
import { skyState } from './sky';

const highHeat = {
  wbgt_c: 33.4,
  heat_stress_level: 'High',
  wbgt_station_name: 'Ang Mo Kio',
  wbgt_station_distance_km: 2.1,
};

/** The sky for a fresh reading from 12:10, seen at 12:30. */
const skyNow = (overrides: Partial<WeatherSnapshot> = {}) =>
  skyState(snapshotAt('12:10', overrides), sgt('12:30'));

describe('skyState', () => {
  it('is calm with no snapshot or no readings', () => {
    expect(skyState(null, sgt('12:30'))).toBe('calm');
    expect(skyNow()).toBe('calm');
  });

  it.each([
    ['2', '11:50', '12:30', { forecast_periods: [period(A, DRY), period(B, THUNDER)] }],
    ['3 at the boundary', '11:45', '12:00', { forecast_periods: [period(B, THUNDER)] }],
    ['4 before the end', '11:50', '13:00', { condition: THUNDER, valid_period_text: W }],
  ])('is storm for case %s', (_name, read, now, overrides) => {
    expect(skyState(snapshotAt(read, overrides), sgt(now))).toBe('storm');
  });

  it.each([
    ['1', '11:50', '12:30', { forecast_periods: [period(A, THUNDER), period(B, DRY)] }],
    ['3', '11:45', '11:50', { forecast_periods: [period(B, THUNDER), period(C, DRY)] }],
    ['4', '11:50', '14:00', { condition: THUNDER, valid_period_text: W }],
    [
      '5',
      '11:50',
      '12:30',
      { valid_period_text: '10.00 am to Midday', forecast_periods: [period(A, DRY)] },
    ],
    [
      '9',
      '00:20',
      '00:30',
      {
        valid_period_text: 'Midnight to 2.00 am',
        forecast_periods: [
          period('Midnight to 6 am 22 Nov', DRY),
          period(A, DRY),
          period(B, DRY),
          period('6 pm to Midnight 23 Nov', THUNDER),
        ],
      },
    ],
    ['stale', '11:50', '15:00', { forecast_periods: [period(A, THUNDER), period(B, DRY)] }],
    ['no reading time', null, '12:30', { condition: THUNDER }],
  ])('is not storm for case %s', (_name, read, now, overrides) => {
    expect(skyState(snapshotAt(read, overrides), sgt(now))).toBe('calm');
  });

  it.each([
    ['haze', { psi_twenty_four_hourly: 150 }],
    ['heat', highHeat],
  ])('is calm when stale, whatever the %s reading', (_name, overrides) => {
    expect(skyState(snapshotAt('11:50', overrides), sgt('15:00'))).toBe('calm');
  });

  it('still shows haze for a reading with no time', () => {
    expect(skyState(snapshotAt(null, { psi_twenty_four_hourly: 150 }), sgt('12:30'))).toBe('haze');
  });

  it('is haze only above PSI 100', () => {
    expect(skyNow({ psi_twenty_four_hourly: 100 })).toBe('calm');
    expect(skyNow({ psi_twenty_four_hourly: 101 })).toBe('haze');
  });

  it('is heat for a High reading from a nearby station', () => {
    expect(skyNow(highHeat)).toBe('heat');
  });

  it('ignores High heat stress from a station too far away to count', () => {
    expect(skyNow({ ...highHeat, wbgt_station_distance_km: 14 })).toBe('calm');
  });

  it('is calm for Moderate heat stress', () => {
    expect(skyNow({ ...highHeat, heat_stress_level: 'Moderate' })).toBe('calm');
  });

  it('ranks storm over haze over heat', () => {
    const all = { ...highHeat, psi_twenty_four_hourly: 160, condition: THUNDER };
    expect(skyNow(all)).toBe('storm');
    expect(skyNow({ ...all, condition: 'Hazy' })).toBe('haze');
    expect(skyNow({ ...all, condition: 'Hazy', psi_twenty_four_hourly: 80 })).toBe('heat');
  });

  it.each([
    ['period', periodSweep, 19_360],
    ['2-hour', twoHourSweep, 8_688],
  ])('agrees with the top line through the %s sweep (SC-004)', (_name, sweep, expected) => {
    const wrong: string[] = [];
    let count = 0;
    for (const { id, weather, now, inside } of sweep()) {
      const storm = skyState(weather, now) === 'storm';
      const saysNow = outdoorSummaryParts(weather, now)[0]?.text === 'Thundery showers now';
      if (storm !== inside || saysNow !== inside) {
        wrong.push(`${id} at ${new Date(now).toISOString()}`);
      }
      count++;
    }
    expect({ count, wrong: wrong.slice(0, 5) }).toEqual({ count: expected, wrong: [] });
  }, SWEEP_TIMEOUT_MS);
});
