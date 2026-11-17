import { describe, expect, it } from 'vitest';
import { RAIN_MARK_KINDS, rainMarkup, rainSizePx } from './rainMarker';

describe('rainSizePx', () => {
  it('grows with heaviness so levels differ by size, not only colour', () => {
    expect(rainSizePx('dry')).toBe(10);
    expect(rainSizePx('light')).toBe(14);
    expect(rainSizePx('moderate')).toBe(18);
    expect(rainSizePx('heavy')).toBe(24);
    expect(rainSizePx('missing')).toBe(14);
  });
});

describe('rainMarkup', () => {
  it('uses one class per kind and carries no colour', () => {
    for (const kind of RAIN_MARK_KINDS) {
      const html = rainMarkup(kind, false, 'Station');
      expect(html).toContain(`class="rain-mark rain-${kind}"`);
      expect(html).not.toMatch(/#[0-9a-f]{3,6}|rgb|fill=|stroke=/i);
    }
  });

  it('draws dry as a ring, wet levels as a drop, and missing as a dashed ring with a dash', () => {
    expect(rainMarkup('dry', false, 'S')).toContain('<circle');
    expect(rainMarkup('dry', false, 'S')).not.toContain('<path');
    for (const kind of ['light', 'moderate', 'heavy'] as const) {
      expect(rainMarkup(kind, false, 'S')).toContain('<path');
    }
    const missing = rainMarkup('missing', false, 'S');
    expect(missing).toContain('<circle');
    expect(missing).toContain('rain-missing__dash');
  });

  it('adds the partial badge only when asked', () => {
    expect(rainMarkup('light', true, 'S')).toContain('class="rain-mark rain-light rain-partial"');
    expect(rainMarkup('light', false, 'S')).not.toContain('rain-partial');
  });

  it('sizes the box from the kind', () => {
    expect(rainMarkup('heavy', false, 'S')).toContain('width:24px;height:24px');
  });

  it('escapes the accessible label, which comes from the API', () => {
    const html = rainMarkup('dry', false, `<img src=x onerror="alert(1)">`);
    expect(html).not.toContain('<img');
    expect(html).toContain('&#60;img');
  });
});
