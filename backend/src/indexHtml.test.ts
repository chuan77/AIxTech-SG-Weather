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
    expect(renderIndexHtml(page, { WEB_ANALYTICS: 'off', VERCEL: '1' })).toBe(page);
    expect(renderIndexHtml(page, { WEB_ANALYTICS: '"><script>x</script>' })).toBe(page);
  });

  it('writes both tags once each next to the map key', () => {
    const html = renderIndexHtml(page, { VITE_CARTO_API_KEY: 'k', WEB_ANALYTICS: 'on' });
    expect(html.match(/name="carto-api-key"/g)).toHaveLength(1);
    expect(html.match(/name="web-analytics"/g)).toHaveLength(1);
    expect(html.indexOf('web-analytics')).toBeLessThan(html.indexOf('</head>'));
  });
});
