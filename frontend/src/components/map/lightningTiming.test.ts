import { describe, expect, it } from 'vitest';
import { buildReusedRecord, buildTimingRecord, parseServerTiming } from './lightningTiming';

// The header the backend sends (backend/src/serverTiming.ts).
const FULL =
  'total;dur=3521, provider;dur=3480;desc="fetch", pacing;dur=1717, retry;dur=10000, retries;desc="1", requests;desc="2", pages;desc="2"';

describe('parseServerTiming', () => {
  it('reads every metric the backend sends', () => {
    expect(parseServerTiming(FULL)).toEqual({
      totalMs: 3521,
      served: 'fetch',
      providerMs: 3480,
      pacingWaitMs: 1717,
      retryWaitMs: 10000,
      retries: 1,
      requests: 2,
      pages: 2,
    });
  });

  it('reads a total-only header', () => {
    expect(parseServerTiming('total;dur=5')).toEqual({ totalMs: 5 });
  });

  it('returns nothing for a missing or unreadable header', () => {
    expect(parseServerTiming(null)).toEqual({});
    expect(parseServerTiming('')).toEqual({});
    expect(parseServerTiming('garbage;;;,,dur=')).toEqual({});
  });

  it('ignores unknown metrics and unknown served values', () => {
    expect(parseServerTiming('cdn;dur=4, provider;dur=7;desc="other"')).toEqual({ providerMs: 7 });
  });
});

describe('buildTimingRecord', () => {
  it('splits the wait into network and drawing time', () => {
    const record = buildTimingRecord({
      trigger: 'refresh',
      startedAt: 1000,
      respondedAt: 4610.4,
      drawnAt: 4890.6,
      strikes: 370,
      groups: 12,
      bolts: 340,
      outcome: 'ok',
      serverTiming: 'total;dur=3521, provider;dur=3480;desc="fetch"',
    });
    expect(record).toEqual({
      trigger: 'refresh',
      served: 'network',
      totalMs: 3891,
      networkMs: 3610,
      drawMs: 280,
      strikes: 370,
      groups: 12,
      bolts: 340,
      outcome: 'ok',
      server: { totalMs: 3521, served: 'fetch', providerMs: 3480 },
    });
  });

  it('has no drawing time when nothing was drawn', () => {
    const record = buildTimingRecord({
      trigger: 'toggle',
      startedAt: 0,
      respondedAt: 120,
      drawnAt: null,
      strikes: 0,
      outcome: 'unavailable',
      serverTiming: null,
    });
    expect(record).toMatchObject({
      totalMs: 120,
      networkMs: 120,
      drawMs: null,
      groups: 0,
      bolts: 0,
      outcome: 'unavailable',
      server: {},
    });
  });
});

describe('buildReusedRecord', () => {
  it('records a refresh skipped because the data was under 2 minutes old', () => {
    expect(buildReusedRecord('prompt', 3, 'ok')).toEqual({
      trigger: 'prompt',
      served: 'reused',
      totalMs: 0,
      networkMs: 0,
      drawMs: 0,
      strikes: 3,
      groups: 0,
      bolts: 0,
      outcome: 'ok',
      server: {},
    });
  });

  it('carries the marks already on the map when given', () => {
    expect(buildReusedRecord('refresh', 3, 'ok', { groups: 1, bolts: 2 })).toMatchObject({ groups: 1, bolts: 2 });
  });
});
