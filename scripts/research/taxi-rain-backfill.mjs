// Taxi vs rain backfill (assessment sg-transport-data, spec 017). Research only: not part of the app.
//
// GitHub's schedule ran the live sampler only every 6–8 hours at first, so most 15-minute slots
// were missed. Both sources answer past-time queries (checked 2026-11-20, spec 017 research R4):
// taxi-availability?date_time= and rainfall?date=, each read as SGT local time. For every slot with
// no row in either file, this makes the same two keyless calls for that past time and appends a row
// built exactly like a live one, with run_at_utc set to the slot start. Rows are marked as
// backfilled by living in their own file, not by a column. Nothing is interpolated: a source with
// no value leaves its columns empty and notes it in errors.
//
// Run locally, then push the file to the research/taxi-rain-data branch (quickstart.md section 2):
//   node scripts/research/taxi-rain-backfill.mjs <live-csv> <backfill-csv> [--from ISO] [--to ISO]
// Re-running is safe: filled slots are skipped.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  HEADER,
  RAIN_URL,
  STUDY_END,
  TAXI_URL,
  buildRow,
  getJson,
  listSlots,
  parseRain,
  parseTaxis,
  slotOf,
  slotTaken,
} from './taxi-rain-sample.mjs';

const STUDY_START_SLOT = '2026-11-18T13:45:00Z'; // slot of the first live row
const PAUSE_MS = 6_000;
const MAX_FAILED_IN_A_ROW = 3;

/** UTC slot → SGT local time without an offset, e.g. '2026-11-19T00:00:00'. */
export function sgtLocal(slot) {
  return new Date(new Date(slot).getTime() + 8 * 3_600_000).toISOString().slice(0, 19);
}

export function pastUrls(slot) {
  const at = encodeURIComponent(sgtLocal(slot));
  return { taxi: `${TAXI_URL}?date_time=${at}`, rain: `${RAIN_URL}?date=${at}` };
}

export function missingSlots(slots, liveCsv, backfillCsv) {
  return slots.filter((slot) => !slotTaken(liveCsv, slot) && !slotTaken(backfillCsv, slot));
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : undefined;
}

const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');

async function main() {
  const [liveFile, backfillFile] = process.argv.slice(2);
  if (!liveFile || !backfillFile || liveFile.startsWith('--') || backfillFile.startsWith('--')) {
    console.error(
      'usage: taxi-rain-backfill.mjs <live-csv> <backfill-csv> [--from ISO] [--to ISO]',
    );
    process.exit(2);
  }
  const from = argValue('--from') ?? STUDY_START_SLOT;
  // The current slot belongs to the live sampler, so stop before it.
  const nowSlot = slotOf(new Date().toISOString());
  const to = argValue('--to') ?? (nowSlot < STUDY_END ? nowSlot : STUDY_END);
  const todo = missingSlots(listSlots(from, to), readText(liveFile), readText(backfillFile));
  console.log(`${todo.length} missing slots from ${from} to ${to}`);

  let failedInARow = 0;
  for (const [index, slot] of todo.entries()) {
    const urls = pastUrls(slot);
    const errors = [];
    let taxis = null;
    let rain = null;
    try {
      taxis = parseTaxis(await getJson(urls.taxi));
    } catch (error) {
      errors.push(`taxi: ${String(error?.message ?? error).slice(0, 80)}`);
    }
    try {
      rain = parseRain(await getJson(urls.rain));
    } catch (error) {
      errors.push(`rain: ${String(error?.message ?? error).slice(0, 80)}`);
    }
    if (!taxis && !rain) {
      failedInARow += 1;
      console.error(`${slot}: both sources failed (${errors.join('; ')})`);
      if (failedInARow >= MAX_FAILED_IN_A_ROW) {
        console.error(`stopping after ${failedInARow} failed slots in a row; re-run to resume`);
        process.exit(1);
      }
    } else {
      failedInARow = 0;
      const head = existsSync(backfillFile) ? '' : `${HEADER.join(',')}\n`;
      appendFileSync(backfillFile, `${head}${buildRow(slot, taxis, rain, errors).join(',')}\n`);
    }
    if ((index + 1) % 10 === 0) console.log(`${index + 1}/${todo.length} done (at ${slot})`);
    if (index < todo.length - 1) await sleep(PAUSE_MS);
  }
  console.log('backfill finished');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
