import type { LightningObservation, LightningStatus, LightningStrike } from '../../types';

export const LIGHTNING_FRESH_MS = 120_000;
export const LIGHTNING_WINDOW_MS = 3_600_000;
export const LIGHTNING_STORAGE_KEY = 'weather-starter.lightning.enabled';

const MINUTE_MS = 60_000;
const SGT_OFFSET_MS = 8 * 3_600_000;
const MAX_RADIUS = 8;
const MIN_RADIUS = 5;
const MIN_OPACITY = 0.15;

/** True when the data was fetched under 2 minutes ago, so a repeat action can reuse it. */
export function isFresh(
  observation: Pick<LightningObservation, 'fetched_at'> | null | undefined,
  now: number,
): boolean {
  if (!observation) return false;
  const fetchedAt = Date.parse(observation.fetched_at);
  return Number.isFinite(fetchedAt) && now - fetchedAt < LIGHTNING_FRESH_MS;
}

/** Drops strikes older than 60 minutes; tolerates future times and unparseable dates. */
export function visibleStrikes(strikes: LightningStrike[], now: number): LightningStrike[] {
  return strikes.filter((strike) => {
    const occurredAt = Date.parse(strike.occurred_at);
    return Number.isFinite(occurredAt) && now - occurredAt <= LIGHTNING_WINDOW_MS;
  });
}

function ageMinutes(occurredAt: string, now: number): number {
  const occurred = Date.parse(occurredAt);
  if (!Number.isFinite(occurred)) return 60;
  return Math.min(60, Math.max(0, (now - occurred) / MINUTE_MS));
}

/** Newer strikes are larger and more opaque; both fade linearly over the 60-minute window. */
export function strikeStyle(occurredAt: string, now: number): { opacity: number; radius: number } {
  const fraction = ageMinutes(occurredAt, now) / 60;
  return {
    opacity: 1 - (1 - MIN_OPACITY) * fraction,
    radius: MAX_RADIUS - (MAX_RADIUS - MIN_RADIUS) * fraction,
  };
}

/** Clock time in Singapore (the map only covers Singapore), for example "9:38 pm". */
export function formatStrikeTime(isoTime: string): string {
  const time = Date.parse(isoTime);
  if (!Number.isFinite(time)) return 'unknown time';
  const sgt = new Date(time + SGT_OFFSET_MS);
  const hours = sgt.getUTCHours();
  const minutes = String(sgt.getUTCMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'pm' : 'am';
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${suffix}`;
}

export function formatStrikePopup(
  strike: LightningStrike,
  now: number,
): { title: string; time: string; relative: string } {
  const minutes = Math.floor(ageMinutes(strike.occurred_at, now));
  return {
    title: strike.label,
    time: formatStrikeTime(strike.occurred_at),
    relative: minutes < 1 ? 'just now' : `${minutes} min ago`,
  };
}

export function statusMessage(
  status: LightningStatus,
  observation: LightningObservation | null,
  now: number,
): { text: string; updatedText: string | null } {
  const updatedText = observation ? `Updated ${formatStrikeTime(observation.fetched_at)}` : null;
  const count = observation ? visibleStrikes(observation.strikes, now).length : 0;

  switch (status) {
    case 'idle':
      return { text: 'Show latest lightning', updatedText };
    case 'loading':
      return { text: 'Loading lightning…', updatedText };
    case 'unavailable':
      return { text: 'Lightning data is currently unavailable', updatedText };
    case 'empty':
      return { text: 'No lightning in the last hour', updatedText };
    case 'ok':
      return count === 0
        ? { text: 'No lightning in the last hour', updatedText }
        : { text: `${count} ${count === 1 ? 'strike' : 'strikes'} in the last hour`, updatedText };
  }
}

/** Missing, unreadable or any value other than "false" means on (the default). */
export function parseEnabled(raw: string | null): boolean {
  return raw !== 'false';
}

export function serialiseEnabled(enabled: boolean): string {
  return enabled ? 'true' : 'false';
}
