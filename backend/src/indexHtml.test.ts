import { describe, expect, it } from 'vitest';
import { renderIndexHtml } from './indexHtml.js';

const page = '<!doctype html><html><head><title>Weather</title></head><body></body></html>';

describe('renderIndexHtml', () => {
  it('adds the CARTO key from the runtime environment as a meta tag in <head>', () => {
    const html = renderIndexHtml(page, { VITE_CARTO_API_KEY: 'abc_123-XYZ' });
    expect(html).toContain('<meta name="carto-api-key" content="abc_123-XYZ" />\n</head>');
  });

  it('escapes the value so it cannot break out of the attribute', () => {
    const html = renderIndexHtml(page, { VITE_CARTO_API_KEY: '"><script>x</script>&\'' });
    expect(html).toContain('content="&quot;&gt;&lt;script&gt;x&lt;/script&gt;&amp;&#39;"');
    expect(html).not.toContain('<script>x');
  });

  it('leaves the page unchanged when no key is set or it is blank', () => {
    expect(renderIndexHtml(page, {})).toBe(page);
    expect(renderIndexHtml(page, { VITE_CARTO_API_KEY: '  ' })).toBe(page);
  });
});

describe('renderIndexHtml web analytics mode', () => {
  it('marks the page for measuring when WEB_ANALYTICS=on', () => {
    const html = renderIndexHtml(page, { WEB_ANALYTICS: 'on' });
    expect(html).toContain('<meta name="web-analytics" content="measure" />\n</head>');
  });

  it('marks the page notice-only when WEB_ANALYTICS=notice-only', () => {
    const html = renderIndexHtml(page, { WEB_ANALYTICS: 'notice-only' });
    expect(html).toContain('<meta name="web-analytics" content="notice-only" />\n</head>');
  });

  it('measures on Vercel when WEB_ANALYTICS is unset', () => {
    expect(renderIndexHtml(page, { VERCEL: '1' })).toContain('content="measure"');
  });

  it('adds no tag when measurement is off or the value is unknown', () => {
    // SPEED_INSIGHTS=off too: VERCEL=1 alone would also turn on page-speed measurement (spec 016).
    expect(
      renderIndexHtml(page, { WEB_ANALYTICS: 'off', SPEED_INSIGHTS: 'off', VERCEL: '1' }),
    ).toBe(page);
    expect(renderIndexHtml(page, { WEB_ANALYTICS: '"><script>x</script>' })).toBe(page);
  });

  it('writes both tags once each next to the map key', () => {
    const html = renderIndexHtml(page, { VITE_CARTO_API_KEY: 'k', WEB_ANALYTICS: 'on' });
    expect(html.match(/name="carto-api-key"/g)).toHaveLength(1);
    expect(html.match(/name="web-analytics"/g)).toHaveLength(1);
    expect(html.indexOf('web-analytics')).toBeLessThan(html.indexOf('</head>'));
  });
});

describe('renderIndexHtml speed insights mode', () => {
  it('marks the page for measuring when SPEED_INSIGHTS=on', () => {
    const html = renderIndexHtml(page, { SPEED_INSIGHTS: 'on' });
    expect(html).toContain('<meta name="speed-insights" content="measure" />');
  });

  it('marks the page notice-only when SPEED_INSIGHTS=notice-only', () => {
    const html = renderIndexHtml(page, { SPEED_INSIGHTS: 'notice-only' });
    expect(html).toContain('<meta name="speed-insights" content="notice-only" />\n</head>');
  });

  it('adds no tag when SPEED_INSIGHTS is off or unknown', () => {
    expect(
      renderIndexHtml(page, { SPEED_INSIGHTS: 'off', VERCEL: '1', WEB_ANALYTICS: 'off' }),
    ).toBe(page);
    expect(renderIndexHtml(page, { SPEED_INSIGHTS: '"><script>x</script>' })).toBe(page);
  });

  it('writes every tag once next to the map key and visit counting', () => {
    const html = renderIndexHtml(page, {
      VITE_CARTO_API_KEY: 'k',
      WEB_ANALYTICS: 'on',
      SPEED_INSIGHTS: 'on',
    });
    for (const name of ['carto-api-key', 'web-analytics', 'speed-insights']) {
      expect(html.match(new RegExp(`name="${name}"`, 'g'))).toHaveLength(1);
    }
    expect(html.indexOf('name="speed-insights"')).toBeLessThan(html.indexOf('</head>'));
  });
});

describe('renderIndexHtml speed insights visit label', () => {
  it('writes the visit label when measuring', () => {
    expect(renderIndexHtml(page, { SPEED_INSIGHTS: 'on' }, { visit: 'cold' })).toContain(
      '<meta name="speed-insights-visit" content="cold" />',
    );
    expect(renderIndexHtml(page, { SPEED_INSIGHTS: 'on' }, { visit: 'warm' })).toContain(
      '<meta name="speed-insights-visit" content="warm" />',
    );
  });

  it('defaults to warm when measuring with no label given', () => {
    expect(renderIndexHtml(page, { SPEED_INSIGHTS: 'on' })).toContain(
      '<meta name="speed-insights-visit" content="warm" />',
    );
  });

  it('writes no label in notice-only or off', () => {
    for (const SPEED_INSIGHTS of ['notice-only', 'off']) {
      const html = renderIndexHtml(page, { SPEED_INSIGHTS }, { visit: 'cold' });
      expect(html).not.toContain('speed-insights-visit');
    }
  });
});
