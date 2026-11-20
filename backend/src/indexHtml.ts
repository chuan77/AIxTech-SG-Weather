// The frontend's runtime settings travel in index.html, filled in when the server sends the page.
// Vite inlines VITE_* values at build time, but Vercel does not pass project environment variables
// into a container image build, so the production container reads them here at runtime instead.
// Three settings travel this way: the CARTO map key, the web analytics mode (spec 012) and the
// speed insights mode (spec 016). Both modes are always one of two fixed literals and never text
// taken from the environment.

import { resolveAnalyticsMode, resolveSpeedInsightsMode } from './analyticsMode.js';
import type { VisitLabel } from './speedInsights.js';

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
  options: { visit?: VisitLabel } = {},
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
  const speed = resolveSpeedInsightsMode(env).mode;
  if (speed !== 'off') {
    meta += `<meta name="speed-insights" content="${speed}" />\n`;
  }
  if (speed === 'measure') {
    // Per request (spec 016): the server pre-renders a cold and a warm page and picks one.
    const visit: VisitLabel = options.visit === 'cold' ? 'cold' : 'warm';
    meta += `<meta name="speed-insights-visit" content="${visit}" />\n`;
  }
  return meta ? html.replace('</head>', `${meta}</head>`) : html;
}
