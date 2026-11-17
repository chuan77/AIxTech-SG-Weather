// The frontend's runtime settings travel in index.html, filled in when the server sends the page.
// Vite inlines VITE_* values at build time, but Vercel does not pass project environment variables
// into a container image build, so the production container reads them here at runtime instead.
// Two settings travel this way: the CARTO map key, and the web analytics mode (spec 012), which is
// always one of two fixed literals and never text taken from the environment.

import { resolveAnalyticsMode } from './analyticsMode.js';

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderIndexHtml(
  html: string,
  env: Record<string, string | undefined> = process.env,
): string {
  let meta = '';
  const cartoKey = env.VITE_CARTO_API_KEY?.trim();
  if (cartoKey) {
    // Public by design: CARTO keys are used by the browser to fetch map tiles.
    meta += `<meta name="carto-api-key" content="${escapeAttribute(cartoKey)}" />\n`;
  }
  const { mode } = resolveAnalyticsMode(env);
  if (mode !== 'off') {
    meta += `<meta name="web-analytics" content="${mode}" />\n`;
  }
  return meta ? html.replace('</head>', `${meta}</head>`) : html;
}
