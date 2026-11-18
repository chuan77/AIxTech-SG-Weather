// Only db-free imports up here: importing db.ts opens the database, so every check runs first.
import { INVALID_KEY_MESSAGE, isVisitorKey } from './visitorKeyFormat.js';

/**
 * `npm run claim-legacy -- <visitorKey> [--remote]` from the repo root (spec 013). Prints only
 * counts: never the key, its hash, coordinates or the database URL.
 *
 * Deliberately does NOT load `.env`: that file can hold the production Turso settings, and a
 * claim run there must be a conscious choice. Turso settings must be exported in the shell AND
 * `--remote` passed; otherwise it refuses before opening any database.
 */
const args = process.argv.slice(2);
const remote = args.includes('--remote');
const key = args.find((arg) => arg !== '--remote');

if (!isVisitorKey(key)) {
  console.error(INVALID_KEY_MESSAGE);
  process.exit(1);
}

const tursoConfigured = Boolean(process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN);
if (tursoConfigured && !remote) {
  console.error('Turso settings are set: pass --remote to claim in the hosted database.');
  process.exit(1);
}
if (remote && !tursoConfigured) {
  console.error('--remote needs TURSO_DATABASE_URL and TURSO_AUTH_TOKEN exported in this shell.');
  process.exit(1);
}

const { claimLegacy } = await import('./claimLegacy.js');
const { closeDatabase } = await import('./db.js');
try {
  console.log(`database: ${remote ? 'hosted (Turso)' : 'local file'}`);
  const { claimed, skipped } = await claimLegacy(key);
  console.log(`claimed ${claimed}, skipped ${skipped} (already in list)`);
} finally {
  closeDatabase();
}
