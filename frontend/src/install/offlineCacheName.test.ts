import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OFFLINE_CACHE_PREFIX } from './offlineHelper';

// Browsers reinstall a service worker only when the bytes of sw.js change. The offline page's
// cache name carries a hash of offline.html, so editing that page forces a change to sw.js too;
// otherwise installed devices would keep the old offline page for good (spec 014).
const publicFile = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../public/${name}`, import.meta.url)), 'utf8');

describe('offline page cache name', () => {
  it('carries the hash of offline.html, so editing the page updates the worker', () => {
    const hash = createHash('sha256').update(publicFile('offline.html')).digest('hex').slice(0, 8);
    const cache = /const CACHE = '([^']+)';/.exec(publicFile('sw.js'))?.[1];
    expect(
      cache,
      'offline.html changed: set CACHE in frontend/public/sw.js to the expected name',
    ).toBe(`${OFFLINE_CACHE_PREFIX}${hash}`);
  });
});
