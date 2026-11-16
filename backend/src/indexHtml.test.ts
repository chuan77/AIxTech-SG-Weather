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
