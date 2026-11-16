import { describe, expect, it } from 'vitest';
import { groupIconSizePx, groupMarkup } from './groupMarker';
import { strikeFresh } from './strikeMarker';

const BASE = {
  countLabel: '1.2k',
  ageLabel: '2m',
  step: 3,
  sizeBand: 'large' as const,
  count: 1240,
  splittable: true,
};

describe('groupIconSizePx', () => {
  it('grows by size band', () => {
    expect(groupIconSizePx('small')).toBe(28);
    expect(groupIconSizePx('medium')).toBe(32);
    expect(groupIconSizePx('large')).toBe(36);
  });
});

describe('groupMarkup', () => {
  const html = groupMarkup(BASE);

  it('carries the class, size band and data attributes the checks read', () => {
    expect(html).toContain('class="strike-group strike-group--large"');
    expect(html).toContain('data-count="1240"');
    expect(html).toContain('data-step="3"');
    expect(html).toContain('data-splittable="true"');
    expect(groupMarkup({ ...BASE, splittable: false })).toContain('data-splittable="false"');
  });

  it('shows the abbreviated count and the age label', () => {
    expect(html).toMatch(/<span class="strike-group__count">1\.2k<\/span>/);
    expect(html).toMatch(/<span class="strike-group__age">2m<\/span>/);
  });

  it('fades by the same freshness as single bolts', () => {
    expect(html).toContain(`--strike-fresh:${strikeFresh(3)}`);
  });

  it('hides its glyph from assistive tech and is never a tab stop', () => {
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain('tabindex');
  });

  it('takes no colours of its own (theme variables only)', () => {
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
  });
});
