import { describe, expect, it } from 'vitest';
import { formatServerTiming } from './serverTiming.js';

describe('formatServerTiming', () => {
  it('formats a full timing as standard Server-Timing metrics', () => {
    expect(
      formatServerTiming({
        served: 'fetch',
        totalMs: 3521.4,
        providerMs: 3480.2,
        pages: 2,
        requests: 2,
        pacingWaitMs: 1717,
        retries: 0,
        retryWaitMs: 0,
        strikes: 370,
        outcome: 'ok',
      }),
    ).toBe(
      'total;dur=3521, provider;dur=3480;desc="fetch", pacing;dur=1717, retry;dur=0, requests;desc="2", pages;desc="2"',
    );
  });

  it('adds a retries metric only when a retry happened', () => {
    const header = formatServerTiming({ totalMs: 12000, served: 'fetch', providerMs: 11900, pacingWaitMs: 0, retries: 1, retryWaitMs: 10000, requests: 2, pages: 1 });
    expect(header).toContain('retry;dur=10000');
    expect(header).toContain('retries;desc="1"');
  });

  it('sends just the total when the client filled in nothing', () => {
    expect(formatServerTiming({ totalMs: 4.6 })).toBe('total;dur=5');
  });

  it('never puts anything but enums and digits in a desc', () => {
    const header = formatServerTiming({ totalMs: 1, served: 'cache', pages: 0, requests: 0, errorKind: 'https://x?key=1' });
    for (const [, desc] of header.matchAll(/desc="([^"]*)"/g)) {
      expect(desc).toMatch(/^(cache|shared|fetch|\d+)$/);
    }
    expect(header).not.toMatch(/http|\?|key/);
  });
});
