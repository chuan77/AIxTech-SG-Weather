import { describe, expect, it } from 'vitest';
import { periodStartLabel, periodStartPhrase } from './periodLabel';

const TODAY = '2026-11-14';

describe('periodStartLabel', () => {
  it('keeps a period starting today as its time', () => {
    expect(periodStartLabel('6 pm 14 Nov to 6 am 15 Nov', TODAY)).toBe('6 pm');
    expect(periodStartLabel('Midday to 6 pm 14 Nov', TODAY)).toBe('Midday');
  });

  it('names tomorrow, taking the date from the end when the start has none', () => {
    expect(periodStartLabel('6 am to Midday 15 Nov', TODAY)).toBe('Tomorrow 6 am');
    expect(periodStartLabel('Midday to 6 pm 15 Nov', TODAY)).toBe('Tomorrow midday');
  });

  it('dates periods further away, and names yesterday', () => {
    expect(periodStartLabel('6 am to Midday 12 Nov', TODAY)).toBe('12 Nov 6 am');
    expect(periodStartLabel('6 pm 13 Nov to 6 am 14 Nov', TODAY)).toBe('Yesterday 6 pm');
  });

  it('reads labels that carry a year', () => {
    expect(periodStartLabel('6 pm 14 Nov 2026 to 12 am 15 Nov 2026', TODAY)).toBe('6 pm');
  });

  it('crosses the year boundary without a year in the label', () => {
    expect(periodStartLabel('6 am to Midday 1 Jan', '2026-12-31')).toBe('Tomorrow 6 am');
  });

  it('falls back to the raw start when there is no date', () => {
    expect(periodStartLabel('Now', TODAY)).toBe('Now');
    expect(periodStartLabel('', TODAY)).toBe('');
  });
});

describe('periodStartPhrase', () => {
  it('lowercases a leading word for use mid-sentence', () => {
    expect(periodStartPhrase('Midday to 6 pm 15 Nov', TODAY)).toBe('tomorrow midday');
    expect(periodStartPhrase('Midday to 6 pm 14 Nov', TODAY)).toBe('midday');
    expect(periodStartPhrase('6 pm 14 Nov to 6 am 15 Nov', TODAY)).toBe('6 pm');
  });
});
