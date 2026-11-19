import { describe, expect, it } from 'vitest';
import { tempWindMarkup, tempWindSizePx } from './tempWindMarker';

const LIGHT = { wind: 'arrow', level: 'light', temp: 'value' } as const;

describe('tempWindMarkup', () => {
  it('draws the temperature and an arrow rotated the way the wind blows', () => {
    const html = tempWindMarkup(LIGHT, '27.4°', 48, 'Clementi Road, 27.4 degrees');
    expect(html).toContain('class="tw-mark"');
    expect(html).toContain('<span class="tw-temp">27.4°</span>');
    expect(html).toContain('tw-wind tw-arrow tw-arrow-light');
    expect(html).toContain('transform:rotate(48deg)');
    expect(html).toContain('<span class="sr-only">Clementi Road, 27.4 degrees</span>');
  });

  it('grows the arrow with the strength level', () => {
    const light = tempWindSizePx(LIGHT);
    const moderate = tempWindSizePx({ ...LIGHT, level: 'moderate' });
    const strong = tempWindSizePx({ ...LIGHT, level: 'strong' });
    expect(moderate.arrow).toBeGreaterThan(light.arrow);
    expect(strong.arrow).toBeGreaterThan(moderate.arrow);
    expect(tempWindMarkup({ ...LIGHT, level: 'strong' }, '27.0°', 0, '')).toContain(
      'tw-arrow-strong',
    );
  });

  it('writes "calm" instead of an arrow', () => {
    const html = tempWindMarkup({ wind: 'calm', level: 'calm', temp: 'value' }, '27.0°', 0, '');
    expect(html).toContain('<span class="tw-wind tw-calm">calm</span>');
    expect(html).not.toContain('tw-arrow');
  });

  it('draws a solid crossed-out glyph for no wind reading, the size of a light arrow', () => {
    const kind = { wind: 'missing', level: null, temp: 'value' } as const;
    const html = tempWindMarkup(kind, '27.0°', 0, '');
    expect(html).toContain('tw-wind tw-wind-missing');
    expect(html).not.toContain('stroke-dasharray');
    expect(tempWindSizePx(kind).arrow).toBe(tempWindSizePx(LIGHT).arrow);
  });

  it('marks a missing temperature with the muted class', () => {
    const html = tempWindMarkup({ ...LIGHT, temp: 'missing' }, '–°', 0, '');
    expect(html).toContain('<span class="tw-temp tw-temp-missing">–°</span>');
  });

  it('escapes the text it is given', () => {
    const html = tempWindMarkup(LIGHT, '<b>1</b>', 0, '<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&#60;img');
  });

  it('carries no colour: the theme styles every part', () => {
    for (const kind of [
      LIGHT,
      { wind: 'calm', level: 'calm', temp: 'value' } as const,
      { wind: 'missing', level: null, temp: 'missing' } as const,
    ]) {
      const html = tempWindMarkup(kind, '27.0°', 90, 'x');
      expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(|hsl\(|fill="(?!none)|stroke="(?!none)/i);
    }
  });

  it('gives a box at least 24 px tall and wide enough for the label', () => {
    const size = tempWindSizePx(LIGHT);
    expect(size.height).toBeGreaterThanOrEqual(24);
    expect(size.width).toBeGreaterThan(size.arrow + 30);
  });
});
