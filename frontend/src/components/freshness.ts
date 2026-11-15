import { formatSgtTime, singaporeDate } from './sunTimes';

/**
 * A snapshot older than this is labelled stale. Singapore weather turns within a couple of
 * hours (afternoon storms), so a reading from this morning no longer answers "can I go out now?".
 */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export type Freshness =
  | { kind: 'none' }
  | {
      kind: 'fresh' | 'stale';
      /** When the reading was taken, in Singapore time: "18:53", "Yesterday 18:39" or "11 Nov 18:36". */
      when: string;
      /** How old it is, for stale readings: "4 h ago", "Yesterday", "3 days ago". */
      age: string;
    };

const DAY_MS = 24 * 60 * 60 * 1000;

const dayMonth = new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore',
  day: 'numeric',
  month: 'short',
});

/** Whole Singapore calendar days between two instants (0 = same day, 1 = yesterday). */
function calendarDaysBetween(earlier: Date, later: Date): number {
  const a = Date.parse(`${singaporeDate(earlier)}T00:00:00Z`);
  const b = Date.parse(`${singaporeDate(later)}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

/**
 * Saved places whose reading is stale or missing, in list order: what "Refresh all" renews.
 * Fresh places are left alone, so a bulk run never re-fetches a reading that still answers "now".
 */
export function staleLocationIds(
  locations: { id: number; weather?: { observed_at?: string | null } | null }[],
  now: number,
): number[] {
  return locations
    .filter((location) => readingFreshness(location.weather?.observed_at, now).kind !== 'fresh')
    .map((location) => location.id);
}

/** Describes how old a stored reading is, so old snapshots never pass for current ones. */
export function readingFreshness(iso: string | null | undefined, now: number): Freshness {
  if (!iso) return { kind: 'none' };
  const observed = new Date(iso);
  if (Number.isNaN(observed.getTime())) return { kind: 'none' };

  const days = calendarDaysBetween(observed, new Date(now));
  const time = formatSgtTime(observed);
  const when =
    days <= 0 ? time : days === 1 ? `Yesterday ${time}` : `${dayMonth.format(observed)} ${time}`;

  const ageMs = Math.max(0, now - observed.getTime());
  if (ageMs < STALE_AFTER_MS) return { kind: 'fresh', when, age: '' };

  const age =
    days <= 0
      ? `${Math.floor(ageMs / 3_600_000)} h ago`
      : days === 1
        ? 'Yesterday'
        : `${days} days ago`;
  return { kind: 'stale', when, age };
}
