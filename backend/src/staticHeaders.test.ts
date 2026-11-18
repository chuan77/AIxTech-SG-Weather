import { describe, expect, it } from 'vitest';
import { headersFor } from './staticHeaders.js';

describe('headersFor', () => {
  it('asks browsers to revalidate the service worker and the manifest every time', () => {
    expect(headersFor('/sw.js')).toEqual({ 'Cache-Control': 'no-cache' });
    expect(headersFor('/manifest.webmanifest')).toEqual({ 'Cache-Control': 'no-cache' });
  });

  it('adds nothing for other static files', () => {
    expect(headersFor('/assets/index-abc.js')).toEqual({});
    expect(headersFor('/icons/icon-192.png')).toEqual({});
    expect(headersFor('/offline.html')).toEqual({});
    expect(headersFor('/')).toEqual({});
  });

  it('matches whole paths only', () => {
    expect(headersFor('/assets/sw.js')).toEqual({});
    expect(headersFor('/sw.js.map')).toEqual({});
  });
});
