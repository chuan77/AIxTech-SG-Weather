import type { ForecastPeriod, WeatherSnapshot } from '../types';

// Fixtures for the spec 018 tests (forecast timing, summary, sky). Only test files import this.

const MINUTE = 60_000;

/**
 * A whole minute-by-minute sweep is tens of thousands of steps: about 5 s locally and three times
 * that on CI, past vitest's 5 s default. Its tests get this limit instead of fewer steps.
 */
export const SWEEP_TIMEOUT_MS = 60_000;

/** An instant from Singapore wall-clock time: "12:30" on 22 Nov 2026, or "2026-10-31 18:01". */
export function sgt(text: string): number {
  const [date, time] = text.includes(' ') ? text.split(' ') : ['2026-11-22', text];
  return Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}+08:00`);
}

export const A = '6 am to Midday 22 Nov';
export const B = 'Midday to 6 pm 22 Nov';
export const C = '6 pm 22 Nov to 6 am 23 Nov';
/** 2-hour validity texts. */
export const W = '11.30 am to 1.30 pm';
export const M = '8.30 am to 10.30 am';

export const DRY = 'Cloudy';
export const THUNDER = 'Thundery Showers';

const NEXT_MORNING = '6 am to Midday 23 Nov';
const NEXT_AFTERNOON = 'Midday to 6 pm 23 Nov';
export const FROM_MIDNIGHT = [
  'Midnight to 6 am 23 Nov',
  NEXT_MORNING,
  NEXT_AFTERNOON,
  '6 pm to Midnight 24 Nov', // NEA prints the day it ends
];

export function period(label: string, forecast: string): ForecastPeriod {
  return { label, forecast };
}

/** A snapshot read at `read` (null: no reading time), with a dry 11:30–13:30 2-hour forecast. */
export function snapshotAt(
  read: string | number | null,
  overrides: Partial<WeatherSnapshot> = {},
): WeatherSnapshot {
  return {
    condition: DRY,
    valid_period_text: W,
    observed_at:
      read === null ? null : new Date(typeof read === 'number' ? read : sgt(read)).toISOString(),
    forecast_periods: [],
    psi_twenty_four_hourly: null,
    uv_index: null,
    wbgt_c: null,
    heat_stress_level: null,
    wbgt_station_name: null,
    wbgt_station_distance_km: null,
    wbgt_observed_at: null,
    ...overrides,
  } as WeatherSnapshot;
}

// Windows are written out, so the sweeps don't depend on the resolver they test.
const LAYOUTS: { issued: string; periods: [label: string, start: string, end: string][] }[] = [
  {
    issued: '2026-11-22 05:41',
    periods: [
      [A, '2026-11-22 06:00', '2026-11-22 12:00'],
      [B, '2026-11-22 12:00', '2026-11-22 18:00'],
      [C, '2026-11-22 18:00', '2026-11-23 06:00'],
    ],
  },
  {
    issued: '2026-11-22 11:41',
    periods: [
      [B, '2026-11-22 12:00', '2026-11-22 18:00'],
      [C, '2026-11-22 18:00', '2026-11-23 06:00'],
      [NEXT_MORNING, '2026-11-23 06:00', '2026-11-23 12:00'],
    ],
  },
  {
    issued: '2026-11-22 17:41',
    periods: [
      [C, '2026-11-22 18:00', '2026-11-23 06:00'],
      [NEXT_MORNING, '2026-11-23 06:00', '2026-11-23 12:00'],
      [NEXT_AFTERNOON, '2026-11-23 12:00', '2026-11-23 18:00'],
    ],
  },
  {
    issued: '2026-11-22 23:41',
    periods: [
      [FROM_MIDNIGHT[0], '2026-11-23 00:00', '2026-11-23 06:00'],
      [FROM_MIDNIGHT[1], '2026-11-23 06:00', '2026-11-23 12:00'],
      [FROM_MIDNIGHT[2], '2026-11-23 12:00', '2026-11-23 18:00'],
      [FROM_MIDNIGHT[3], '2026-11-23 18:00', '2026-11-24 00:00'],
    ],
  },
  {
    issued: '2026-11-22 23:41',
    periods: [[FROM_MIDNIGHT[0], '2026-11-23 00:00', '2026-11-23 06:00']],
  },
];

export interface SweepStep {
  /** Which thunder placement this step belongs to. */
  id: string;
  weather: WeatherSnapshot;
  now: number;
  /** Whether `now` is inside the thunder forecast's window. */
  inside: boolean;
}

/**
 * Thunder in each period of each layout, at every minute to the last window's end. The reading
 * moves with the clock so it stays fresh: a stale one would freeze the time being judged.
 */
export function* periodSweep(): Generator<SweepStep> {
  for (const [layout, { issued, periods }] of LAYOUTS.entries()) {
    const from = sgt(issued);
    const to = sgt(periods[periods.length - 1][2]);
    for (const [placement, [, startText, endText]] of periods.entries()) {
      const start = sgt(startText);
      const end = sgt(endText);
      const forecasts = periods.map(([label], i) => period(label, i === placement ? THUNDER : DRY));
      for (let now = from; now <= to; now += MINUTE) {
        yield {
          id: `layout ${layout}, period ${placement}`,
          weather: snapshotAt(Math.max(from, now - 179 * MINUTE), {
            valid_period_text: null,
            forecast_periods: forecasts,
          }),
          now,
          inside: start <= now && now < end,
        };
      }
    }
  }
}

function twoHourClock(minuteOfDay: number): string {
  const minute = minuteOfDay % 1440;
  if (minute === 0) return 'Midnight';
  if (minute === 720) return 'Midday';
  const hour = Math.floor(minute / 60) % 12 || 12;
  return `${hour}.${String(minute % 60).padStart(2, '0')} ${minute < 720 ? 'am' : 'pm'}`;
}

/** Thunder in the 2-hour forecast, for all 48 half-hour windows starting on 31 Dec 2026. */
export function* twoHourSweep(): Generator<SweepStep> {
  for (let slot = 0; slot < 48; slot++) {
    const start = sgt('2026-12-31 00:00') + slot * 30 * MINUTE;
    const end = start + 120 * MINUTE;
    const weather = snapshotAt(start + 10 * MINUTE, {
      condition: THUNDER,
      valid_period_text: `${twoHourClock(slot * 30)} to ${twoHourClock(slot * 30 + 120)}`,
    });
    for (let now = start - 30 * MINUTE; now <= end + 30 * MINUTE; now += MINUTE) {
      yield { id: `2-hour window ${slot}`, weather, now, inside: start <= now && now < end };
    }
  }
}
