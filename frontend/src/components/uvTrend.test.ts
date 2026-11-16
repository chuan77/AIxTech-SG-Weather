import { describe, expect, it } from 'vitest';
import {
  UV_GUIDANCE,
  UV_MODERATE_FROM,
  UV_SLOT_HOURS,
  uvBandName,
  uvBarFraction,
  uvBarPosition,
  uvSourceText,
  uvStatusText,
  uvTrendView,
  type UvTrendView,
} from './uvTrend';
import type { UvDay } from '../types';

const NOW = new Date('2026-11-15T15:30:00+08:00');

function hourIso(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, '0')}:00:00+08:00`;
}

/** A day whose readings start at 07:00 with the given values (null = non-numeric). */
function day(values: Array<number | null>, date = '2026-11-15', asOf: string | null = null): UvDay {
  return {
    date,
    as_of: asOf,
    readings: values.map((value, i) => ({ hour: hourIso(date, 7 + i), value })),
  };
}

function readings(view: UvTrendView) {
  if (view.kind !== 'readings') throw new Error(`expected readings, got ${view.kind}`);
  return view;
}

describe('uvBandName', () => {
  it.each([
    [0, 'Low'],
    [2, 'Low'],
    [3, 'Moderate'],
    [5, 'Moderate'],
    [6, 'High'],
    [7, 'High'],
    [8, 'Very High'],
    [10, 'Very High'],
    [11, 'Extreme'],
    [14, 'Extreme'],
  ])('%s is %s', (value, band) => {
    expect(uvBandName(value)).toBe(band);
  });

  it('gives null for a missing value', () => {
    expect(uvBandName(null)).toBeNull();
    expect(uvBandName(undefined)).toBeNull();
    expect(uvBandName(Number.NaN)).toBeNull();
  });
});

describe('uvTrendView slots and direction (US1)', () => {
  it('always gives 13 slots from 07:00 to 19:00', () => {
    expect(UV_SLOT_HOURS).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    const view = readings(uvTrendView(2, day([0, 0, 1, 2, 4, 4, 1, 2, 2]), NOW));

    expect(view.slots.map((slot) => slot.hour)).toEqual(UV_SLOT_HOURS);
  });

  it('fills reported hours and leaves later hours empty, never 0', () => {
    const view = readings(uvTrendView(2, day([0, 0, 1, 2, 4, 4, 1, 2, 2]), NOW));

    expect(view.slots.slice(0, 9).map((slot) => slot.value)).toEqual([0, 0, 1, 2, 4, 4, 1, 2, 2]);
    expect(view.slots[4]).toMatchObject({ hour: 11, value: 4, band: 'Moderate' });
    for (const slot of view.slots.slice(9)) {
      expect(slot).toMatchObject({ value: null, band: null });
    }
  });

  it('places readings by their Singapore hour, whatever the stored offset', () => {
    const uv: UvDay = {
      date: '2026-11-15',
      as_of: null,
      readings: [{ hour: '2026-11-15T03:00:00Z', value: 5 }], // 11:00 SGT
    };
    const view = readings(uvTrendView(5, uv, NOW));

    expect(view.slots.find((slot) => slot.hour === 11)?.value).toBe(5);
  });

  it('ignores readings outside 07:00–19:00 for slots', () => {
    const uv: UvDay = {
      date: '2026-11-15',
      as_of: null,
      readings: [
        { hour: hourIso('2026-11-15', 6), value: 1 },
        { hour: hourIso('2026-11-15', 20), value: 1 },
      ],
    };
    const view = readings(uvTrendView(1, uv, NOW));

    expect(view.slots.every((slot) => slot.value === null)).toBe(true);
  });

  it.each([
    [[4, 5], 'Rising'],
    [[5, 4], 'Falling'],
    [[4, 4], 'Steady'],
  ])('direction for %j is %s', (values, direction) => {
    expect(readings(uvTrendView(values[1], day(values), NOW)).direction).toBe(direction);
  });

  it('skips a missing hour when comparing', () => {
    const view = readings(uvTrendView(5, day([3, null, 5]), NOW));

    expect(view.slots[1]).toMatchObject({ hour: 8, value: null });
    expect(view.direction).toBe('Rising');
  });

  it('shows no direction with only one reading', () => {
    expect(readings(uvTrendView(0, day([0]), NOW)).direction).toBeNull();
    expect(readings(uvTrendView(0, day([0, null]), NOW)).direction).toBeNull();
  });

  it('marks a list for the Singapore date of now as today', () => {
    expect(readings(uvTrendView(2, day([1, 2]), NOW)).isToday).toBe(true);
  });
});

describe('uv bar geometry', () => {
  it('centres the gauge slice on the value and stays inside the gauge', () => {
    expect(uvBarPosition(0)).toBe('0%');
    expect(uvBarPosition(11)).toBe('100%');
    expect(uvBarPosition(14)).toBe('100%');
    // 5.5 is the middle of the 0–11 gauge.
    expect(uvBarPosition(5.5)).toBe('50%');
  });

  it('caps the height at 11 and never goes negative', () => {
    expect(uvBarFraction(0)).toBe(0);
    expect(uvBarFraction(5.5)).toBe(0.5);
    expect(uvBarFraction(14)).toBe(1);
    expect(uvBarFraction(-1)).toBe(0);
  });
});

describe('hours at UV 3+, peak window and wording (US2)', () => {
  it('counts readings of 3 or more (spec example 0,0,1,3,5,7,6 → 4)', () => {
    expect(UV_MODERATE_FROM).toBe(3);
    const view = readings(uvTrendView(6, day([0, 0, 1, 3, 5, 7, 6]), NOW));

    expect(view.hoursAtModerateOrAbove).toBe(4);
  });

  it('counts 0 when nothing reached 3, and never counts missing values', () => {
    expect(readings(uvTrendView(2, day([0, 1, 2, 2]), NOW)).hoursAtModerateOrAbove).toBe(0);
    expect(readings(uvTrendView(3, day([null, 3, null]), NOW)).hoursAtModerateOrAbove).toBe(1);
  });

  it('still counts a reading outside the 13 slots', () => {
    const uv: UvDay = {
      date: '2026-11-15',
      as_of: null,
      readings: [{ hour: hourIso('2026-11-15', 20), value: 3 }],
    };

    expect(readings(uvTrendView(3, uv, NOW)).hoursAtModerateOrAbove).toBe(1);
  });

  it('flags 11:00 to 14:00 as NEA usual peak, and only those', () => {
    const view = readings(uvTrendView(2, day([1, 2]), NOW));

    expect(view.slots.filter((slot) => slot.inPeakWindow).map((slot) => slot.hour)).toEqual([
      11, 12, 13, 14,
    ]);
  });

  it('quotes only NEA and HealthHub wording, with no "advised" level', () => {
    expect(UV_GUIDANCE).toBe(
      'UV usually peaks 11 am – 3 pm (NEA). Use SPF 30+ sunscreen, applied 20–30 min before going into the sun (HealthHub).',
    );
    expect(UV_GUIDANCE).not.toContain('advised');
  });

  it('builds the status line from direction and count', () => {
    const falling = readings(uvTrendView(2, day([0, 1, 4, 4, 2]), NOW));
    expect(uvStatusText(falling)).toBe('Falling · 2 h at UV 3+ (Moderate or higher) so far');

    const none = readings(uvTrendView(1, day([0, 1]), NOW));
    expect(uvStatusText(none)).toBe('Rising · No hours at UV 3+ so far');

    const single = readings(uvTrendView(4, day([4]), NOW));
    expect(uvStatusText(single)).toBe('1 h at UV 3+ (Moderate or higher) so far');
  });

  it('gives the source line with the provider update time in Singapore time', () => {
    const view = readings(uvTrendView(2, day([1, 2], '2026-11-15', '2026-11-15T07:11:20Z'), NOW));

    expect(view.asOf).toBe('15:11');
    expect(uvSourceText(view.asOf)).toBe('Nationwide reading, measured at Changi · as of 15:11');
    expect(uvSourceText(null)).toBe('Nationwide reading, measured at Changi');
  });
});

describe('old, empty and unavailable snapshots (US3)', () => {
  it('tells the four states apart', () => {
    expect(uvTrendView(null, null, NOW)).toEqual({ kind: 'unavailable' });
    expect(uvTrendView(undefined, undefined, NOW)).toEqual({ kind: 'unavailable' });
    expect(uvTrendView(5, null, NOW)).toEqual({ kind: 'pre-feature' });
    expect(uvTrendView(5, { date: '2026-11-15', as_of: null, readings: [] }, NOW)).toEqual({
      kind: 'empty',
    });
    expect(uvTrendView(null, { date: '2026-11-15', as_of: null, readings: [] }, NOW)).toEqual({
      kind: 'empty',
    });
    expect(uvTrendView(5, day([5]), NOW).kind).toBe('readings');
  });

  const yesterday = day(
    [0, 0, 1, 2, 4, 3, 3, 2, 1, 1, 0, 0, 0],
    '2026-11-14',
    '2026-11-14T19:11:00+08:00',
  );

  it('labels a previous-day list with its date, with no direction and no "as of"', () => {
    const view = readings(uvTrendView(0, yesterday, new Date('2026-11-15T08:00:00+08:00')));

    expect(view).toMatchObject({
      isToday: false,
      dayLabel: '14 Nov',
      direction: null,
      asOf: null,
      hoursAtModerateOrAbove: 3,
    });
    expect(view.slots.every((slot) => slot.value !== null)).toBe(true);
  });

  it('labels the overnight list (previous day, kept until morning) the same way', () => {
    const view = readings(uvTrendView(0, yesterday, new Date('2026-11-15T00:30:00+08:00')));

    expect(view.dayLabel).toBe('14 Nov');
    expect(view.direction).toBeNull();
  });

  it('treats the evening list as today until midnight Singapore time', () => {
    const view = readings(uvTrendView(0, yesterday, new Date('2026-11-14T23:30:00+08:00')));

    expect(view.isToday).toBe(true);
    expect(view.dayLabel).toBeNull();
  });

  it('words the previous day without "so far"', () => {
    const view = readings(uvTrendView(0, yesterday, NOW));
    expect(uvStatusText(view)).toBe('14 Nov · 3 h at UV 3+ (Moderate or higher)');

    const quiet = readings(uvTrendView(0, day([0, 1, 2], '2026-11-14'), NOW));
    expect(uvStatusText(quiet)).toBe('14 Nov · No hours at UV 3+');
  });

  it('gives the previous-day source line', () => {
    expect(uvSourceText(null, '14 Nov')).toBe('Readings for 14 Nov, measured at Changi');
  });
});
