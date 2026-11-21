import { describe, expect, it } from 'vitest';
import { missingSlots, pastUrls, sgtLocal } from './taxi-rain-backfill.mjs';
import { HEADER, listSlots } from './taxi-rain-sample.mjs';

const header = `${HEADER.join(',')}\n`;

describe('taxi-rain backfill', () => {
  it('turns a UTC slot into SGT local time without an offset', () => {
    expect(sgtLocal('2026-11-18T16:00:00Z')).toBe('2026-11-19T00:00:00');
    expect(sgtLocal('2026-11-19T04:15:00Z')).toBe('2026-11-19T12:15:00');
  });

  it('builds past-time URLs for both sources', () => {
    const { taxi, rain } = pastUrls('2026-11-19T04:00:00Z');
    expect(taxi).toBe(
      'https://api.data.gov.sg/v1/transport/taxi-availability?date_time=2026-11-19T12%3A00%3A00',
    );
    expect(rain).toBe(
      'https://api-open.data.gov.sg/v2/real-time/api/rainfall?date=2026-11-19T12%3A00%3A00',
    );
  });

  it('skips slots that already have a live or a backfilled row', () => {
    const slots = listSlots('2026-11-18T13:45:00Z', '2026-11-18T14:45:00Z');
    const live = `${header}2026-11-18T13:56:34.293Z,x\n`;
    const backfill = `${header}2026-11-18T14:15:00Z,y\n`;
    expect(missingSlots(slots, live, backfill)).toEqual([
      '2026-11-18T14:00:00Z',
      '2026-11-18T14:30:00Z',
    ]);
  });

  it('finds nothing to do on a re-run that has filled every slot', () => {
    const slots = listSlots('2026-11-18T14:00:00Z', '2026-11-18T14:30:00Z');
    const backfill = `${header}2026-11-18T14:00:00Z,a\n2026-11-18T14:15:00Z,b\n`;
    expect(missingSlots(slots, '', backfill)).toEqual([]);
  });
});
