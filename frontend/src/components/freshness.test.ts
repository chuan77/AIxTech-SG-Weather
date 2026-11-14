import { describe, expect, it } from 'vitest';
import { readingFreshness } from './freshness';

// 14 Nov 2026, 19:50 SGT
const NOW = Date.parse('2026-11-14T19:50:00+08:00');

describe('readingFreshness', () => {
  it('has nothing to say without a reading', () => {
    expect(readingFreshness(null, NOW)).toEqual({ kind: 'none' });
    expect(readingFreshness('not a date', NOW)).toEqual({ kind: 'none' });
  });

  it('shows only the time for a recent reading', () => {
    expect(readingFreshness('2026-11-14T18:53:00+08:00', NOW)).toEqual({
      kind: 'fresh',
      when: '18:53',
      age: '',
    });
  });

  it('marks a same-day reading stale after three hours, with its age in hours', () => {
    expect(readingFreshness('2026-11-14T13:36:38+08:00', NOW)).toEqual({
      kind: 'stale',
      when: '13:37',
      age: '6 h ago',
    });
  });

  it('names yesterday', () => {
    expect(readingFreshness('2026-11-13T18:39:00+08:00', NOW)).toEqual({
      kind: 'stale',
      when: 'Yesterday 18:39',
      age: 'Yesterday',
    });
  });

  it('dates older readings and counts the days', () => {
    expect(readingFreshness('2026-11-11T18:36:40+08:00', NOW)).toEqual({
      kind: 'stale',
      when: '11 Nov 18:37',
      age: '3 days ago',
    });
  });

  it('uses Singapore calendar days, not UTC ones', () => {
    // 00:30 SGT on the 14th is still the 13th in UTC.
    const lateNight = Date.parse('2026-11-14T00:30:00+08:00');
    expect(readingFreshness('2026-11-13T23:50:00+08:00', lateNight)).toMatchObject({
      kind: 'fresh',
      when: 'Yesterday 23:50',
    });
  });
});
