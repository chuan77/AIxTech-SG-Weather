// Extra headers for files served from frontend/dist (spec 014).
// The service worker and the web app manifest must never be reused from the HTTP cache: the
// browser checks /sw.js for a new version on each navigation, and a cached copy would delay a
// fix, a deploy or a rollback (and the kill switch) from reaching installed users.

const NO_CACHE = new Set(['/sw.js', '/manifest.webmanifest']);

/** Headers to add for a static file, given its URL path from the site root. */
export function headersFor(path: string): Record<string, string> {
  return NO_CACHE.has(path) ? { 'Cache-Control': 'no-cache' } : {};
}
