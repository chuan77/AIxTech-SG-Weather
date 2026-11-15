import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Location } from '../../types';
import { CloudIcon, RainIcon, SunIcon, ThunderIcon, weatherGlyphMarkup } from '../icons';
import { escapeHtml, pinMarkup } from './pinMarkup';

describe('weatherGlyphMarkup', () => {
  it('matches the React icon it replaces in map pins', () => {
    const pairs = [
      ['cloud', CloudIcon],
      ['sun', SunIcon],
      ['rain', RainIcon],
      ['thunder', ThunderIcon],
    ] as const;
    for (const [glyph, Icon] of pairs) {
      expect(weatherGlyphMarkup(glyph, 'h-3.5 w-3.5')).toBe(
        renderToStaticMarkup(createElement(Icon, { className: 'h-3.5 w-3.5' })),
      );
    }
  });
});

describe('pinMarkup', () => {
  const place = (area: string, condition: string) =>
    ({
      id: 1,
      latitude: 1.35,
      longitude: 103.85,
      weather: { area, condition, temperature_c: 30 },
    }) as unknown as Location;

  it('escapes text from the API', () => {
    expect(escapeHtml(`<b>"Tom's" & co</b>`)).toBe(
      '&#60;b&#62;&#34;Tom&#39;s&#34; &#38; co&#60;/b&#62;',
    );
    const html = pinMarkup(place('<img src=x onerror=alert(1)>', 'Showers'), false);
    expect(html).not.toContain('<img');
  });

  it('names the place for screen readers and marks the selected pin', () => {
    const html = pinMarkup(place('Bishan', 'Thundery Showers'), true);
    expect(html).toContain('weather-pin--selected');
    expect(html).toMatch(/<span class="sr-only">Bishan, .*Thundery Showers, selected<\/span>/);
  });
});
