import { describe, expect, it } from 'vitest';
import { sgt } from './forecastFixtures';
import { periodTimeLabel, periodTimePhrase, shortenPeriodLabel } from './periodLabel';

describe('time words', () => {
  it.each([
    // [when, seen at, label, mid-sentence]
    ['18:00', '12:30', '6 pm', '6 pm'],
    ['12:00', '11:50', 'Midday', 'midday'],
    ['06:00', '12:30', '6 am', '6 am'],
    ['13:30', '11:50', '1.30 pm', '1.30 pm'],
    ['00:30', '00:40', '12.30 am', '12.30 am'],
    ['2026-11-23 00:00', '19:00', 'Midnight', 'midnight'], // tonight's
    ['2026-11-23 00:00', '23:45', 'Midnight', 'midnight'],
    ['00:00', '00:30', 'Midnight', 'midnight'], // began today
    ['2026-11-23 06:00', '19:00', 'Tomorrow 6 am', 'tomorrow 6 am'],
    ['2026-11-23 12:00', '19:00', 'Tomorrow midday', 'tomorrow midday'],
    ['2026-11-24 00:00', '19:00', 'Tomorrow midnight', 'tomorrow midnight'],
    ['2026-11-21 18:00', '07:00', 'Yesterday 6 pm', 'yesterday 6 pm'],
    ['2026-11-12 06:00', '07:00', '12 Nov 6 am', '12 Nov 6 am'],
    ['2026-11-13 00:00', '07:00', '12 Nov midnight', '12 Nov midnight'],
    ['2027-01-01 06:00', '2026-12-31 19:00', 'Tomorrow 6 am', 'tomorrow 6 am'],
    ['2027-01-01 00:00', '2026-12-31 19:00', 'Midnight', 'midnight'],
  ])('names %s seen at %s', (when, now, label, phrase) => {
    expect(periodTimeLabel(sgt(when), sgt(now))).toBe(label);
    expect(periodTimePhrase(sgt(when), sgt(now))).toBe(phrase);
  });
});

describe('shortenPeriodLabel', () => {
  it('keeps the start and drops the year', () => {
    expect(shortenPeriodLabel('6 pm 14 Nov 2026 to 12 am 15 Nov 2026')).toBe('6 pm 14 Nov');
  });
});
