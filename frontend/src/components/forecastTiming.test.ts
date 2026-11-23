import { describe, expect, it } from 'vitest';
import {
  A,
  B,
  C,
  DRY,
  FROM_MIDNIGHT,
  THUNDER,
  W,
  period,
  periodSweep,
  sgt,
  snapshotAt,
  twoHourSweep,
  type SweepStep,
} from './forecastFixtures';
import { forecastOutlook, stripLabels } from './forecastTiming';

const dry = (...labels: string[]) => labels.map((label) => period(label, DRY));

/** The resolved windows of `labels`, read and viewed at `read`. */
function windows(read: string, ...labels: string[]) {
  return forecastOutlook(
    snapshotAt(read, { forecast_periods: dry(...labels) }),
    sgt(read),
  ).periods.map(({ window }) => window);
}

const span = (start: string, end: string) => ({ start: sgt(start), end: sgt(end) });

describe('forecast windows', () => {
  it('includes the start and excludes the end', () => {
    const weather = snapshotAt('11:50', { forecast_periods: dry(A, B) });
    const states = (now: string) =>
      forecastOutlook(weather, sgt(now)).periods.map(({ state }) => state);

    expect(states('11:59:59.999')).toEqual(['active', 'upcoming']);
    expect(states('12:00:00')).toEqual(['ended', 'active']);
  });

  it.each([
    ['23:36', '11.30 pm to 1.30 am', '23:30', '2026-11-23 01:30'],
    ['22:06', '10.00 pm to Midnight', '22:00', '2026-11-23 00:00'],
    ['12:06', 'Midday to 2.00 pm', '12:00', '14:00'],
    ['00:06', 'Midnight to 2.00 am', '00:00', '02:00'],
    ['12:06', '12pm to 6pm', '12:00', '18:00'],
    ['18:36', '6:30 pm to 8:30 pm', '18:30', '20:30'],
  ])('read at %s, places the 2-hour text "%s"', (read, text, start, end) => {
    const outlook = forecastOutlook(snapshotAt(read, { valid_period_text: text }), sgt(read));

    expect(outlook.nearTerm.window).toEqual(span(start, end));
  });

  it('ignores a printed next day', () => {
    const labels = ['Midnight to 6 am 22 Nov', A, B, '6 pm to Midnight 23 Nov'];

    expect(windows('00:20', ...labels)[3]).toEqual(span('18:00', '2026-11-23 00:00'));
  });

  it('ignores a printed wrong month', () => {
    expect(
      windows('2026-10-31 18:01', '6 pm 30 Nov to 6 am 01 Dec', '6 am to Midday 01 Dec').map(
        (window) => window?.start,
      ),
    ).toEqual([sgt('2026-10-31 18:00'), sgt('2026-11-01 06:00')]);
  });

  it('ignores a printed wrong day', () => {
    expect(windows('2026-10-31 05:40', '6 am to Midday 01 Nov')[0]?.start).toBe(
      sgt('2026-10-31 06:00'),
    );
  });

  it('ignores a printed wrong year', () => {
    expect(windows('2025-12-31 17:40', '6 pm 31 Dec 2025 to 6 am 01 Jan 2025')[0]?.end).toBe(
      sgt('2026-01-01 06:00'),
    );
  });

  it('places a period issued early as still to come', () => {
    const weather = snapshotAt('23:10', { forecast_periods: dry('Midnight to 6 am 23 Nov') });
    const [first] = forecastOutlook(weather, sgt('23:10')).periods;

    expect(first.window?.start).toBe(sgt('2026-11-23 00:00'));
    expect(first.state).toBe('upcoming');
  });

  it('gives the same windows 0, 1, 3 and 6 hours after issue', () => {
    const expected = [
      span('06:00', '12:00'),
      span('12:00', '18:00'),
      span('18:00', '2026-11-23 06:00'),
    ];
    for (const read of ['05:41', '06:41', '08:41', '11:41']) {
      expect(windows(read, A, B, C), read).toEqual(expected);
    }
  });

  it.each([
    'garbled',
    '',
    '13 pm to 6 pm',
    '0 am to 6 am',
    '6.75 pm to 8 pm',
    '6 am to 6 am',
    'Midday',
  ])('leaves "%s" and the periods after it unknown', (label) => {
    const weather = snapshotAt('08:50', { forecast_periods: dry(A, label, C) });

    expect(forecastOutlook(weather, sgt('09:00')).periods.map(({ state }) => state)).toEqual([
      'active',
      'unknown',
      'unknown',
    ]);
  });

  it('leaves a period unknown when it does not start at the previous end', () => {
    expect(windows('05:50', A, C, '6 am to Midday 23 Nov')).toEqual([
      span('06:00', '12:00'),
      null,
      null,
    ]);
  });

  it('leaves every period unknown when the first is unreadable', () => {
    expect(windows('11:50', 'garbled', B, C)).toEqual([null, null, null]);
  });

  it.each([null, '', 'not a date'])('leaves every window unknown for reading time %j', (time) => {
    const weather = snapshotAt(null, {
      observed_at: time,
      condition: THUNDER,
      forecast_periods: dry(A, B),
    });
    const outlook = forecastOutlook(weather, sgt('12:30'));

    expect([outlook.nearTerm, ...outlook.periods].map(({ state }) => state)).toEqual([
      'unknown',
      'unknown',
      'unknown',
    ]);
    expect(outlook.thunderActive).toBe(false);
  });

  it('keeps the place of a period without wording', () => {
    const weather = snapshotAt('23:45', {
      forecast_periods: FROM_MIDNIGHT.map((label, i) => period(label, i === 0 ? ' ' : DRY)),
    });
    const { periods } = forecastOutlook(weather, sgt('23:45'));

    expect(periods.slice(1).map(({ window }) => window?.start)).toEqual(
      ['2026-11-23 06:00', '2026-11-23 12:00', '2026-11-23 18:00'].map(sgt),
    );
    expect(periods.map(({ missing }) => missing)).toEqual([true, false, false, false]);
  });

  it('judges a stale reading at its reading time', () => {
    const weather = snapshotAt('11:50', {
      forecast_periods: [period(A, THUNDER), period(B, DRY)],
    });
    const outlook = forecastOutlook(weather, sgt('15:00'));

    expect(outlook).toMatchObject({ at: sgt('11:50'), now: sgt('15:00'), fresh: false });
    expect(outlook.thunderActive).toBe(true);
    expect(outlook.stormSky).toBe(false);
  });
});

/** Runs a sweep, returning what went wrong and which placements were seen active and ending. */
function runSweep(steps: Iterable<SweepStep>) {
  const wrong: string[] = [];
  const active = new Set<string>();
  const ending = new Set<string>();
  let count = 0;
  for (const { id, weather, now, inside } of steps) {
    const outlook = forecastOutlook(weather, now);
    if (
      outlook.thunderActive !== inside ||
      outlook.stormSky !== inside ||
      outlook.periods.filter(({ state }) => state === 'active').length > 1
    ) {
      wrong.push(`${id} at ${new Date(now).toISOString()}`);
    }
    if (outlook.stormSky) active.add(id);
    else if (active.has(id)) ending.add(id);
    count++;
  }
  return { count, wrong: wrong.slice(0, 5), active: active.size, ending: ending.size };
}

describe('thunder now, minute by minute (SC-002)', () => {
  it('is exact for every period of every layout', () => {
    expect(runSweep(periodSweep())).toEqual({ count: 19_360, wrong: [], active: 14, ending: 14 });
  });

  it('is exact for all 48 two-hour windows', () => {
    expect(runSweep(twoHourSweep())).toEqual({ count: 8_688, wrong: [], active: 48, ending: 48 });
  });
});

describe('stripLabels', () => {
  it.each([
    ['case 1', '11:50', '12:30', [A, B, C], ['6 am', 'Now', '6 pm']],
    ['case 3', '11:45', '11:50', [B, C], ['Midday', '6 pm']],
    ['case 5', '11:50', '12:30', [A], ['6 am']],
    [
      'case 9',
      '00:20',
      '00:30',
      ['Midnight to 6 am 22 Nov', A, B, '6 pm to Midnight 23 Nov'],
      ['Now', '6 am', 'Midday', '6 pm'],
    ],
    ['stale', '11:50', '15:00', [A, B, C], ['6 am', 'Midday', '6 pm']],
    ['unreadable', '11:50', '12:30', ['Evening 22 Nov 2026 to late'], ['Evening 22 Nov']],
    ['no label', '11:50', '12:30', [''], ['--']],
  ])('%s', (_name, read, now, labels, expected) => {
    const weather = snapshotAt(read, { valid_period_text: W, forecast_periods: dry(...labels) });

    expect(stripLabels(forecastOutlook(weather, sgt(now)))).toEqual(expected);
  });
});
