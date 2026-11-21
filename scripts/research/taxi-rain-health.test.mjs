import { describe, expect, it } from 'vitest';
import { summarize } from './taxi-rain-health.mjs';

const now = '2026-11-21T12:00:00Z';
const from = '2026-11-20T12:00:00Z'; // 96 slots before now

function everyQuarter(startIso, count, offsetSec = 30) {
  const start = new Date(startIso).getTime();
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 15 * 60_000 + offsetSec * 1000).toISOString(),
  );
}

describe('taxi-rain health', () => {
  it('reports nothing collected for empty input', () => {
    const s = summarize({ live: [], backfill: [], now, from });
    expect(s.last_sample_utc).toBe('none');
    expect(s.samples_last_24h).toBe(0);
    expect(s.slot_coverage_pct).toBe(0);
  });

  it('shows on-time sampling: 96 samples in 24 h, largest gap about 15 minutes', () => {
    const live = everyQuarter(from, 96);
    const s = summarize({ live, backfill: [], now, from });
    expect(s.samples_last_24h).toBe(96);
    expect(s.largest_gap_last_24h_min).toBeLessThanOrEqual(15);
    expect(s.slot_coverage_pct).toBe(100);
    expect(s.live_slots).toBe(96);
  });

  it('shows a stall, counting the gap from the last sample to now', () => {
    const live = everyQuarter(from, 92); // stops 60 min before now
    const s = summarize({ live, backfill: [], now, from });
    expect(s.minutes_since_last).toBeGreaterThanOrEqual(60);
    expect(s.largest_gap_last_24h_min).toBeGreaterThanOrEqual(60);
  });

  it('counts backfilled slots apart from live ones in coverage', () => {
    const live = everyQuarter(from, 48, 30);
    const backfill = everyQuarter('2026-11-21T00:00:00Z', 48, 0);
    const s = summarize({ live, backfill, now, from });
    expect(s.live_slots).toBe(48);
    expect(s.backfill_slots).toBe(48);
    expect(s.slot_coverage_pct).toBe(100);
    expect(s.samples_last_24h).toBe(48); // live samples only
  });
});
