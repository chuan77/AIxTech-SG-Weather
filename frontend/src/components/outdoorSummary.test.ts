import { describe, expect, it } from 'vitest';
import type { ForecastPeriod, WeatherSnapshot } from '../types';
import {
  A,
  B,
  C,
  DRY,
  FROM_MIDNIGHT,
  M,
  THUNDER,
  W,
  period,
  sgt,
  snapshotAt,
} from './forecastFixtures';
import { outdoorSummary, outdoorSummaryParts, psiBand, uvBand } from './outdoorSummary';

interface Case {
  name: string;
  read: string | null;
  now: string;
  condition?: string;
  window?: string | null;
  periods?: ForecastPeriod[];
  expected: string[];
}

/** The weather parts: the fixtures have no heat, UV or PSI reading. */
function weatherParts({ read, now, condition = DRY, window = W, periods = [] }: Case): string[] {
  const weather = snapshotAt(read, {
    condition,
    valid_period_text: window,
    forecast_periods: periods,
  });
  return outdoorSummaryParts(weather, sgt(now)).map((part) => part.text);
}

const fromMidnight = (...forecasts: string[]) =>
  FROM_MIDNIGHT.map((label, i) => period(label, forecasts[i]));

describe('the weather part: "now" means now (spec 018 US1)', () => {
  it.each<Case>([
    {
      name: '1: thunder until midday has ended',
      read: '11:50',
      now: '12:30',
      periods: [period(A, THUNDER), period(B, DRY), period(C, DRY)],
      expected: ['No storms forecast'],
    },
    {
      name: '2: thunder from midday has started',
      read: '11:50',
      now: '12:30',
      periods: [period(A, DRY), period(B, THUNDER), period(C, DRY)],
      expected: ['Thundery showers now'],
    },
    {
      name: '3: the first period is still to come',
      read: '11:45',
      now: '11:50',
      periods: [period(B, THUNDER), period(C, DRY)],
      expected: ['Thundery showers from midday'],
    },
    {
      name: '3 at the boundary',
      read: '11:45',
      now: '12:00',
      periods: [period(B, THUNDER), period(C, DRY)],
      expected: ['Thundery showers now'],
    },
    {
      name: '4 before the 2-hour forecast ends',
      read: '11:50',
      now: '13:00',
      condition: THUNDER,
      periods: [period(B, DRY), period(C, DRY)],
      expected: ['Thundery showers now'],
    },
    {
      name: '4: the 2-hour thunder has ended',
      read: '11:50',
      now: '14:00',
      condition: THUNDER,
      periods: [period(B, DRY), period(C, DRY)],
      expected: [],
    },
    {
      name: '5: every window has ended',
      read: '11:50',
      now: '12:30',
      window: '10.00 am to Midday',
      periods: [period(A, DRY)],
      expected: [],
    },
    {
      name: '9: NEA prints tomorrow on this evening',
      read: '00:20',
      now: '00:30',
      window: 'Midnight to 2.00 am',
      periods: [
        period('Midnight to 6 am 22 Nov', DRY),
        period(A, DRY),
        period(B, DRY),
        period('6 pm to Midnight 23 Nov', THUNDER),
      ],
      expected: ['Thundery showers from 6 pm'],
    },
    {
      name: 'stale: judged at the reading time (Hero dates it)',
      read: '11:50',
      now: '15:00',
      periods: [period(A, THUNDER), period(B, DRY)],
      expected: ['Thundery showers now'],
    },
    {
      name: 'no reading time',
      read: null,
      now: '12:30',
      condition: THUNDER,
      expected: ['Thundery showers forecast'],
    },
    {
      name: 'device clock behind the reading',
      read: '11:50',
      now: '11:00',
      condition: THUNDER,
      periods: [period(B, DRY)],
      expected: ['Thundery showers from 11.30 am'],
    },
    { name: 'only a dry 2-hour forecast', read: '12:10', now: '12:30', expected: [] },
    {
      name: '2-hour forecast unavailable',
      read: '12:10',
      now: '12:30',
      condition: 'Unavailable',
      window: null,
      periods: [period(B, DRY)],
      expected: ['No storms forecast'],
    },
    {
      name: 'untimed 2-hour thunder comes before later thunder',
      read: '12:10',
      now: '12:30',
      condition: THUNDER,
      window: null,
      periods: [period(B, DRY), period(C, THUNDER)],
      expected: ['Thundery showers forecast'],
    },
    {
      name: 'a missing period, then thunder',
      read: '23:45',
      now: '23:45',
      window: '11.30 pm to 1.30 am',
      periods: fromMidnight('', THUNDER, DRY, DRY),
      expected: ['Thundery showers from tomorrow 6 am'],
    },
    {
      name: 'a missing period, the rest dry',
      read: '23:45',
      now: '23:45',
      window: '11.30 pm to 1.30 am',
      periods: fromMidnight('', DRY, DRY, DRY),
      expected: [],
    },
    {
      name: 'a missing period that has ended',
      read: '11:50',
      now: '12:30',
      periods: [period(A, ''), period(B, DRY), period(C, DRY)],
      expected: ['No storms forecast'],
    },
  ])('$name', (example) => {
    expect(weatherParts(example)).toEqual(example.expected);
  });
});

describe('the weather part: forecast rain is named (spec 018 US2)', () => {
  const SHOWERS = 'Showers';
  const LIGHT = 'Light Rain';
  const AFTERNOON = '1.30 pm to 3.30 pm';
  const EVENING = '6.30 pm to 8.30 pm';

  it.each<Case>([
    {
      name: '6: rain in both forecasts is said once',
      read: '12:10',
      now: '12:30',
      condition: SHOWERS,
      periods: [period(B, SHOWERS), period(C, SHOWERS)],
      expected: ['Showers forecast now'],
    },
    {
      name: 'period rain',
      read: '13:50',
      now: '14:00',
      window: AFTERNOON,
      periods: [period(B, LIGHT), period(C, DRY)],
      expected: ['Light rain forecast until 6 pm'],
    },
    {
      name: '7: rain still to come',
      read: '08:50',
      now: '09:00',
      window: M,
      periods: [period(A, DRY), period(B, SHOWERS)],
      expected: ['Showers forecast from midday'],
    },
    {
      name: '8: rain, then thunder',
      read: '08:50',
      now: '09:00',
      window: M,
      periods: [period(A, DRY), period(B, SHOWERS), period(C, THUNDER)],
      expected: ['Showers forecast from midday', 'Thundery showers from 6 pm'],
    },
    {
      name: 'rain now, thunder later',
      read: '12:10',
      now: '12:30',
      condition: SHOWERS,
      periods: [period(B, DRY), period(C, THUNDER)],
      expected: ['Showers forecast now', 'Thundery showers from 6 pm'],
    },
    {
      name: 'thunder now stands alone',
      read: '12:10',
      now: '12:30',
      condition: SHOWERS,
      periods: [period(B, THUNDER), period(C, SHOWERS)],
      expected: ['Thundery showers now'],
    },
    {
      name: 'rain after thunder is left out',
      read: '08:50',
      now: '09:00',
      window: M,
      periods: [period(A, DRY), period(B, THUNDER), period(C, SHOWERS)],
      expected: ['Thundery showers from midday'],
    },
    {
      name: 'both untimed',
      read: null,
      now: '12:30',
      condition: THUNDER,
      periods: [period(B, SHOWERS)],
      expected: ['Showers forecast', 'Thundery showers forecast'],
    },
    {
      name: 'an ended wet 2-hour forecast',
      read: '11:50',
      now: '14:00',
      condition: SHOWERS,
      periods: [period(B, DRY), period(C, DRY)],
      expected: [],
    },
    {
      name: 'until midnight',
      read: '18:50',
      now: '19:00',
      window: EVENING,
      periods: [period('6 pm to Midnight 23 Nov', SHOWERS)],
      expected: ['Showers forecast until midnight'],
    },
    {
      name: 'until tomorrow',
      read: '18:50',
      now: '19:00',
      window: EVENING,
      periods: [period(C, SHOWERS)],
      expected: ['Showers forecast until tomorrow 6 am'],
    },
    {
      name: 'drizzle counts as rain',
      read: '12:10',
      now: '12:30',
      condition: 'Drizzle',
      periods: [period(B, DRY)],
      expected: ['Drizzle forecast now'],
    },
    {
      name: 'dry control',
      read: '12:10',
      now: '12:30',
      periods: [period(B, DRY), period(C, DRY)],
      expected: ['No storms forecast'],
    },
    {
      name: 'a rain run ends with its last period',
      read: '13:50',
      now: '14:00',
      window: AFTERNOON,
      periods: [period(B, LIGHT), period(C, LIGHT)],
      expected: ['Light rain forecast until tomorrow 6 am'],
    },
    {
      name: 'a mixed run is called Rain',
      read: '13:50',
      now: '14:00',
      window: AFTERNOON,
      periods: [period(B, LIGHT), period(C, SHOWERS)],
      expected: ['Rain forecast until tomorrow 6 am'],
    },
    {
      name: 'a run meeting a missing period has no end',
      read: '13:50',
      now: '14:00',
      window: AFTERNOON,
      periods: [period(B, LIGHT), period(C, '')],
      expected: ['Light rain forecast'],
    },
    {
      name: 'a run meeting an untimed period has no end',
      read: '13:50',
      now: '14:00',
      window: AFTERNOON,
      periods: [period(B, LIGHT), period('garbled', SHOWERS)],
      expected: ['Light rain forecast'],
    },
    {
      name: 'a run meeting thunder',
      read: '13:50',
      now: '14:00',
      window: AFTERNOON,
      periods: [period(B, LIGHT), period(C, THUNDER)],
      expected: ['Light rain forecast until 6 pm', 'Thundery showers from 6 pm'],
    },
    {
      name: 'untimed 2-hour rain comes before later rain',
      read: '12:10',
      now: '12:30',
      condition: SHOWERS,
      window: null,
      periods: [period(B, DRY), period(C, SHOWERS)],
      expected: ['Showers forecast'],
    },
    {
      name: 'untimed 2-hour rain comes before period rain',
      read: '12:10',
      now: '12:30',
      condition: SHOWERS,
      window: null,
      periods: [period(B, LIGHT), period(C, DRY)],
      expected: ['Showers forecast'],
    },
    {
      name: 'untimed thunder comes before later rain',
      read: '12:10',
      now: '12:30',
      condition: THUNDER,
      window: null,
      periods: [period(B, DRY), period(C, SHOWERS)],
      expected: ['Thundery showers forecast'],
    },
    {
      name: 'thunder now, untimed rain',
      read: '12:10',
      now: '12:30',
      condition: SHOWERS,
      window: null,
      periods: [period(B, THUNDER), period(C, DRY)],
      expected: ['Thundery showers now'],
    },
    {
      name: 'untimed rain, later thunder',
      read: '08:50',
      now: '08:55',
      window: M,
      periods: [period(A, DRY), period(B, THUNDER), period('garbled', SHOWERS)],
      expected: ['Showers forecast', 'Thundery showers from midday'],
    },
  ])('$name', (example) => {
    expect(weatherParts(example)).toEqual(example.expected);
  });
});

describe('no false reassurance (SC-003)', () => {
  const VIEWS = ['09:20', '11:00', '12:00'] as const;
  const WEATHERS = ['dry', 'rain', 'thunder', 'missing'] as const;
  type Weather = (typeof WEATHERS)[number];
  const TEXT = { dry: DRY, rain: 'Showers', thunder: THUNDER, missing: '' };

  /**
   * The required line, as literals: `p` is the 2-hour forecast (08:30–10:30), `a` the morning
   * period and `b` the afternoon's. It deliberately uses none of the timing module.
   */
  function oracle(view: (typeof VIEWS)[number], p: Weather, a: Weather, b: Weather): string[] {
    const early = view === '09:20';
    const noon = view === '12:00';
    if (early && p === 'thunder') return ['Thundery showers now'];
    if ((noon ? b : a) === 'thunder') return ['Thundery showers now'];

    const line: string[] = [];
    if (early && p === 'rain') line.push('Showers forecast now');
    else if (noon && b === 'rain') line.push('Showers forecast until 6 pm');
    else if (!noon && a === 'rain') {
      if (b === 'rain') line.push('Showers forecast until 6 pm');
      else if (b === 'missing') line.push('Showers forecast');
      else line.push('Showers forecast until midday');
    } else if (!noon && b === 'rain') line.push('Showers forecast from midday');

    if (!noon && b === 'thunder') line.push('Thundery showers from midday');
    if (line.length > 0) return line;

    const dryAhead = b === 'dry' && (noon || a === 'dry');
    return dryAhead && p !== 'rain' && p !== 'thunder' ? ['No storms forecast'] : [];
  }

  it('gives the exact line for all 192 combinations', () => {
    const wrong: string[] = [];
    let count = 0;
    for (const now of VIEWS) {
      for (const p of WEATHERS) {
        for (const a of WEATHERS) {
          for (const b of WEATHERS) {
            const line = weatherParts({
              name: '',
              read: '09:10',
              now,
              condition: p === 'missing' ? 'Unavailable' : TEXT[p],
              window: p === 'missing' ? null : M,
              periods: [period(A, TEXT[a]), period(B, TEXT[b])],
              expected: [],
            });
            const id = `${now} ${p}/${a}/${b}: ${line.join(' · ') || 'none'}`;
            if (line.join() !== oracle(now, p, a, b).join()) wrong.push(id);
            if (/\bsafe\b|\bdry\b|all clear/i.test(line.join())) wrong.push(`banned word, ${id}`);
            count++;
          }
        }
      }
    }
    expect({ count, wrong: wrong.slice(0, 8) }).toEqual({ count: 192, wrong: [] });
  });
});

describe('the rest of the summary', () => {
  const now = sgt('12:30');
  const summary = (overrides: Partial<WeatherSnapshot> = {}) =>
    outdoorSummary(snapshotAt('12:10', overrides), now);

  it('returns null when nothing is known', () => {
    expect(summary()).toBeNull();
  });

  it('joins heat stress and PSI and skips stations that are too far away', () => {
    const readings = {
      wbgt_c: 31.2,
      heat_stress_level: 'Moderate',
      wbgt_station_distance_km: 2,
      psi_twenty_four_hourly: 42.4,
    };

    expect(summary(readings)).toBe('Heat stress moderate · PSI 42 good');
    expect(summary({ ...readings, wbgt_station_distance_km: 25 })).toBe('PSI 42 good');
  });

  it('keeps heat, UV and PSI in order, with or without a weather part', () => {
    const readings = {
      wbgt_c: 33.4,
      heat_stress_level: 'High',
      wbgt_station_distance_km: 2,
      uv_index: 9,
      psi_twenty_four_hourly: 42,
    };
    const rest = 'Heat stress high · UV very high · PSI 42 good';

    expect(summary(readings)).toBe(rest);
    expect(summary({ ...readings, forecast_periods: [period(B, THUNDER)] })).toBe(
      `Thundery showers now · ${rest}`,
    );
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

describe('uvBand', () => {
  it('names High and up, and stays quiet below 6', () => {
    expect(uvBand(null)).toBeNull();
    expect(uvBand(5.9)).toBeNull();
    expect(uvBand(6)).toBe('High');
    expect(uvBand(8)).toBe('Very high');
    expect(uvBand(11)).toBe('Extreme');
  });

  it('joins the summary only when High or above', () => {
    const now = sgt('12:30');

    expect(outdoorSummary(snapshotAt('12:10', { uv_index: 3 }), now)).toBeNull();
    expect(outdoorSummary(snapshotAt('12:10', { uv_index: 9 }), now)).toBe('UV very high');
  });
});
