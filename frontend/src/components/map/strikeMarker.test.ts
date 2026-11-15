import { describe, expect, it } from 'vitest';
import {
  STRIKE_BOLT_PATH,
  STRIKE_STEPS,
  strikeFresh,
  strikeMarkup,
  strikeSizePx,
  strikeStep,
} from './strikeMarker';

const NOW = Date.parse('2026-11-11T14:00:00Z');
// The pins' thunderstorm glyph starts with this cloud path (frontend/src/components/icons.tsx).
const THUNDER_CLOUD_PATH = 'M7 14h10a4 4 0 0 0 .8-7.92';

function iso(minutesAgo: number): string {
  return new Date(NOW - minutesAgo * 60_000).toISOString();
}

describe('strikeStep', () => {
  it('is floor(age / 5), clamped to 0..11', () => {
    expect(strikeStep(iso(0), NOW)).toBe(0);
    expect(strikeStep(iso(2), NOW)).toBe(0);
    expect(strikeStep(iso(4.9), NOW)).toBe(0);
    expect(strikeStep(iso(5), NOW)).toBe(1);
    expect(strikeStep(iso(30), NOW)).toBe(6);
    expect(strikeStep(iso(55), NOW)).toBe(11);
    expect(strikeStep(iso(59.9), NOW)).toBe(11);
  });

  it('treats a future time as newest and an unreadable time as oldest', () => {
    expect(strikeStep(iso(-3), NOW)).toBe(0);
    expect(strikeStep('not a date', NOW)).toBe(STRIKE_STEPS - 1);
  });

  it('changes only at 5-minute boundaries', () => {
    expect(strikeStep(iso(10), NOW)).toBe(strikeStep(iso(14.99), NOW));
    expect(strikeStep(iso(15), NOW)).toBe(strikeStep(iso(14.99), NOW) + 1);
  });

  it('makes a newer strike more prominent than an older one', () => {
    const [a, b, c] = [2, 30, 55].map((age) => strikeStep(iso(age), NOW));
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(strikeSizePx(a)).toBeGreaterThan(strikeSizePx(b));
    expect(strikeSizePx(b)).toBeGreaterThan(strikeSizePx(c));
    expect(strikeFresh(a)).toBeGreaterThan(strikeFresh(b));
    expect(strikeFresh(b)).toBeGreaterThan(strikeFresh(c));
  });
});

describe('strikeSizePx and strikeFresh', () => {
  it('run linearly from newest to oldest step', () => {
    expect(strikeSizePx(0)).toBe(24);
    expect(strikeSizePx(STRIKE_STEPS - 1)).toBe(14);
    expect(strikeFresh(0)).toBe(1);
    expect(strikeFresh(STRIKE_STEPS - 1)).toBe(0);
  });
});

describe('strikeMarkup', () => {
  it('is a hidden, filled bolt, not the thunderstorm glyph', () => {
    const html = strikeMarkup(0);
    expect(html).toContain('class="strike-mark"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).toContain(STRIKE_BOLT_PATH);
    expect(html).not.toContain(THUNDER_CLOUD_PATH);
  });

  it('carries no literal colour, so the theme supplies it', () => {
    for (let step = 0; step < STRIKE_STEPS; step += 1) {
      const html = strikeMarkup(step);
      expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    }
  });

  it('sets its size and freshness for the step', () => {
    expect(strikeMarkup(11)).toContain('width:14px;height:14px');
    expect(strikeMarkup(11)).toContain('--strike-fresh:0');
  });
});
