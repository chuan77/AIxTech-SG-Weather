import { describe, expect, it } from 'vitest';
import type { LightningObservation, LightningStrike } from '../../types';
import {
  formatStrikePopup,
  formatStrikeTime,
  isFresh,
  parseEnabled,
  serialiseEnabled,
  statusMessage,
  strikeStyle,
  visibleStrikes,
} from './lightningHelpers';

const NOW = Date.parse('2026-11-11T14:00:00Z'); // 22:00 SGT

function iso(minutesAgo: number): string {
  return new Date(NOW - minutesAgo * 60_000).toISOString();
}

function strike(minutesAgo: number, overrides: Partial<LightningStrike> = {}): LightningStrike {
  const occurred_at = iso(minutesAgo);
  return {
    id: `${occurred_at}|1.35|103.82`,
    latitude: 1.35,
    longitude: 103.82,
    occurred_at,
    type: 'C',
    label: 'Cloud to Cloud',
    ...overrides,
  };
}

function observation(strikes: LightningStrike[], fetchedMinutesAgo = 1): LightningObservation {
  return {
    strikes,
    window_minutes: 60,
    fetched_at: iso(fetchedMinutesAgo),
    provider_updated_at: null,
    stale: false,
  };
}

describe('visibleStrikes', () => {
  it('keeps strikes up to 60 minutes old and drops older ones', () => {
    const result = visibleStrikes([strike(59), strike(61)], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].occurred_at).toBe(iso(59));
  });

  it('tolerates a strike slightly in the future', () => {
    expect(visibleStrikes([strike(-4)], NOW)).toHaveLength(1);
  });

  it('drops an unparseable date without throwing', () => {
    expect(visibleStrikes([strike(5, { occurred_at: 'nope' })], NOW)).toEqual([]);
  });
});

describe('isFresh', () => {
  it('is true under 2 minutes and false from 2 minutes on', () => {
    expect(isFresh({ fetched_at: new Date(NOW - 119_000).toISOString() }, NOW)).toBe(true);
    expect(isFresh({ fetched_at: new Date(NOW - 120_000).toISOString() }, NOW)).toBe(false);
  });

  it('is false without data or with an unparseable time', () => {
    expect(isFresh(null, NOW)).toBe(false);
    expect(isFresh({ fetched_at: 'nope' }, NOW)).toBe(false);
  });
});

describe('strikeStyle', () => {
  it('is strongest now and weakest at 60 minutes', () => {
    expect(strikeStyle(iso(0), NOW)).toEqual({ opacity: 1, radius: 8 });
    const half = strikeStyle(iso(30), NOW);
    expect(half.opacity).toBeCloseTo(0.575);
    expect(half.radius).toBeCloseTo(6.5);
    const oldest = strikeStyle(iso(60), NOW);
    expect(oldest.opacity).toBeCloseTo(0.15);
    expect(oldest.radius).toBeCloseTo(5);
  });

  it('clamps a future strike to the newest style', () => {
    expect(strikeStyle(iso(-3), NOW)).toEqual({ opacity: 1, radius: 8 });
  });

  it('fades strictly with age', () => {
    const [a, b, c] = [2, 30, 55].map((age) => strikeStyle(iso(age), NOW));
    expect(a.opacity).toBeGreaterThan(b.opacity);
    expect(b.opacity).toBeGreaterThan(c.opacity);
    expect(a.radius).toBeGreaterThan(b.radius);
    expect(b.radius).toBeGreaterThan(c.radius);
  });
});

describe('formatting', () => {
  it('shows Singapore clock time in 12-hour form', () => {
    expect(formatStrikeTime('2026-11-11T13:38:00Z')).toBe('9:38 pm');
    expect(formatStrikeTime('2026-11-11T16:05:00Z')).toBe('12:05 am');
    expect(formatStrikeTime('2026-11-11T04:00:00Z')).toBe('12:00 pm');
    expect(formatStrikeTime('2026-11-11T01:07:00+08:00')).toBe('1:07 am');
  });

  it('handles an unparseable time', () => {
    expect(formatStrikeTime('nope')).toBe('unknown time');
  });

  it('builds popup text from the strike', () => {
    expect(formatStrikePopup(strike(12), NOW)).toEqual({
      title: 'Cloud to Cloud',
      time: '9:48 pm',
      relative: '12 min ago',
    });
    expect(formatStrikePopup(strike(0), NOW).relative).toBe('just now');
  });
});

describe('statusMessage', () => {
  it('prompts when idle', () => {
    expect(statusMessage('idle', null, NOW)).toEqual({ text: 'Show latest lightning', updatedText: null });
  });

  it('shows loading', () => {
    expect(statusMessage('loading', null, NOW).text).toBe('Loading lightning…');
  });

  it('reports no lightning when empty', () => {
    const result = statusMessage('empty', observation([]), NOW);
    expect(result.text).toBe('No lightning in the last hour');
    expect(result.updatedText).toBe('Updated 9:59 pm');
  });

  it('counts strikes with singular and plural wording', () => {
    expect(statusMessage('ok', observation([strike(5)]), NOW).text).toBe('1 strike in the last hour');
    expect(statusMessage('ok', observation([strike(5), strike(9)]), NOW).text).toBe(
      '2 strikes in the last hour',
    );
  });

  it('falls back to the empty message once every strike has aged out', () => {
    expect(statusMessage('ok', observation([strike(61)]), NOW).text).toBe('No lightning in the last hour');
  });

  it('reports unavailable and keeps the last-updated time of earlier data', () => {
    const result = statusMessage('unavailable', observation([strike(5)], 4), NOW);
    expect(result.text).toBe('Lightning data is currently unavailable');
    expect(result.updatedText).toBe('Updated 9:56 pm');
  });
});

describe('enabled preference', () => {
  it('defaults to on when missing or invalid', () => {
    expect(parseEnabled(null)).toBe(true);
    expect(parseEnabled('')).toBe(true);
    expect(parseEnabled('maybe')).toBe(true);
    expect(parseEnabled('true')).toBe(true);
  });

  it('is off only for "false" and round-trips', () => {
    expect(parseEnabled('false')).toBe(false);
    expect(parseEnabled(serialiseEnabled(false))).toBe(false);
    expect(parseEnabled(serialiseEnabled(true))).toBe(true);
  });
});
