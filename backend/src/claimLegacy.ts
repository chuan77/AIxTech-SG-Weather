import { claimUnownedLocations } from './db.js';
import { ensureVisitor, touchVisitor } from './visitors.js';
import { INVALID_KEY_MESSAGE, isVisitorKey } from './visitorKeyFormat.js';

export { INVALID_KEY_MESSAGE } from './visitorKeyFormat.js';

/**
 * Spec 013, FR-011: gives the places saved before per-visitor lists (no owner) to the owner's
 * browser key, keeping their stored snapshots. A place whose coordinates the owner already has is
 * left unowned and counted as skipped. Running it again claims nothing new. Run by the owner only,
 * from a terminal with the database settings (`npm run claim-legacy -- <key>`); no route exposes it.
 */
export async function claimLegacy(
  key: string,
  now: Date = new Date(),
): Promise<{ claimed: number; skipped: number }> {
  if (!isVisitorKey(key)) throw new Error(INVALID_KEY_MESSAGE);
  const visitorId = await ensureVisitor(key, now);
  // A just-claimed list counts as used, so the 90-day sweep keeps it.
  await touchVisitor(visitorId, now);
  return claimUnownedLocations(visitorId);
}
