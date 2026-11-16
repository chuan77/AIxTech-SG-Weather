// The frontend's runtime settings travel in index.html, filled in when the server sends the page.
// Vite inlines VITE_* values at build time, but Vercel does not pass project environment variables
// into a container image build, so the production container reads them here at runtime instead.

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
  const cartoKey = env.VITE_CARTO_API_KEY?.trim();
  if (!cartoKey) return html;
  // Public by design: CARTO keys are used by the browser to fetch map tiles.
  const meta = `<meta name="carto-api-key" content="${escapeAttribute(cartoKey)}" />\n`;
  return html.replace('</head>', `${meta}</head>`);
}
