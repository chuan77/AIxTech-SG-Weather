// Taxi vs rain study health (spec 017). Research only: not part of the app.
//
// Shows whether the live sampler is keeping up: time of the last sample, live samples in the last
// 24 h, the largest gap in that window (including the gap from the last sample to now), and slot
// coverage since the study start, with live and backfilled slots counted apart.
//
// Usage: node scripts/research/taxi-rain-health.mjs <live-csv|-> [backfill-csv]
// ('-' reads the live CSV from stdin.) Exits 1 when the last live sample is over 30 minutes old.

import { existsSync, readFileSync } from 'node:fs';
import { listSlots, runTimes, slotOf } from './taxi-rain-sample.mjs';

const STUDY_START_SLOT = '2026-11-18T13:45:00Z';
const DAY_MS = 24 * 3_600_000;
const STALE_MIN = 30;

const minutes = (ms) => Math.round(ms / 60_000);

/** live/backfill: ISO run times. now/from: ISO. Coverage counts slots from `from` up to now's slot. */
export function summarize({ live, backfill, now, from }) {
  const nowMs = new Date(now).getTime();
  const times = live.map((t) => new Date(t).getTime()).sort((a, b) => a - b);
  const last = times.at(-1);
  const recent = times.filter((t) => t > nowMs - DAY_MS && t <= nowMs);

  let largestGap = 0;
  let previous = nowMs - DAY_MS;
  for (const t of [...recent, nowMs]) {
    largestGap = Math.max(largestGap, t - previous);
    previous = t;
  }

  const slots = listSlots(from, slotOf(now));
  const liveSlots = new Set(live.map(slotOf));
  const backfillSlots = new Set(backfill.map(slotOf));
  const covered = slots.filter((s) => liveSlots.has(s) || backfillSlots.has(s)).length;

  return {
    last_sample_utc: last === undefined ? 'none' : new Date(last).toISOString(),
    minutes_since_last: last === undefined ? null : minutes(nowMs - last),
    samples_last_24h: recent.length,
    largest_gap_last_24h_min: minutes(largestGap),
    slots_so_far: slots.length,
    live_slots: slots.filter((s) => liveSlots.has(s)).length,
    backfill_slots: slots.filter((s) => !liveSlots.has(s) && backfillSlots.has(s)).length,
    slot_coverage_pct: slots.length ? Math.round((covered / slots.length) * 1000) / 10 : 0,
  };
}

function main() {
  const [liveFile, backfillFile] = process.argv.slice(2);
  if (!liveFile) {
    console.error('usage: taxi-rain-health.mjs <live-csv|-> [backfill-csv]');
    process.exit(2);
  }
  const liveText = readFileSync(liveFile === '-' ? 0 : liveFile, 'utf8');
  const backfillText =
    backfillFile && existsSync(backfillFile) ? readFileSync(backfillFile, 'utf8') : '';
  const summary = summarize({
    live: runTimes(liveText),
    backfill: runTimes(backfillText),
    now: new Date().toISOString(),
    from: STUDY_START_SLOT,
  });
  for (const [key, value] of Object.entries(summary)) console.log(`${key}: ${value ?? '-'}`);
  if (summary.minutes_since_last === null || summary.minutes_since_last > STALE_MIN) {
    console.error(`stale: no live sample in the last ${STALE_MIN} minutes`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
