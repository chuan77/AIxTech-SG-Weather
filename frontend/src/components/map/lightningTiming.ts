/**
 * Lightning refresh timing for the owner, in the browser's developer console only (spec 007,
 * FR-012): how long from the action to strikes drawn, and how much of that was the network, the
 * provider (from the server's Server-Timing header) and drawing.
 */

export type LightningTrigger = 'toggle' | 'refresh' | 'prompt';
export type LightningTimingOutcome = 'ok' | 'empty' | 'unavailable';

export interface ServerTimingSummary {
  totalMs?: number;
  served?: 'cache' | 'shared' | 'fetch';
  providerMs?: number;
  pacingWaitMs?: number;
  retryWaitMs?: number;
  retries?: number;
  requests?: number;
  pages?: number;
}

export interface LightningTimingRecord {
  trigger: LightningTrigger;
  /** reused: the 2-minute freshness check skipped the request. */
  served: 'network' | 'reused';
  totalMs: number;
  networkMs: number;
  /** null when no map drew the strikes (for example the map is not on screen). */
  drawMs: number | null;
  strikes: number;
  outcome: LightningTimingOutcome;
  server: ServerTimingSummary;
}

const DURATIONS: Record<string, keyof ServerTimingSummary> = {
  total: 'totalMs',
  provider: 'providerMs',
  pacing: 'pacingWaitMs',
  retry: 'retryWaitMs',
};
const COUNTS: Record<string, keyof ServerTimingSummary> = {
  retries: 'retries',
  requests: 'requests',
  pages: 'pages',
};
const SERVED = new Set(['cache', 'shared', 'fetch']);

/** Reads the backend's Server-Timing header; anything unknown or unreadable is left out. */
export function parseServerTiming(header: string | null): ServerTimingSummary {
  const summary: ServerTimingSummary = {};
  if (!header) return summary;
  const target = summary as Record<string, unknown>;

  for (const metric of header.split(',')) {
    const [rawName, ...params] = metric.split(';').map((part) => part.trim());
    let duration: number | null = null;
    let desc: string | null = null;
    for (const param of params) {
      const [key, value = ''] = param.split('=');
      if (key === 'dur' && value !== '' && Number.isFinite(Number(value))) duration = Number(value);
      if (key === 'desc') desc = value.replace(/^"|"$/g, '');
    }

    const durationKey = DURATIONS[rawName];
    if (durationKey && duration !== null) {
      target[durationKey] = duration;
      if (rawName === 'provider' && desc && SERVED.has(desc))
        summary.served = desc as ServerTimingSummary['served'];
    }
    const countKey = COUNTS[rawName];
    if (countKey && desc !== null && /^\d+$/.test(desc)) target[countKey] = Number(desc);
  }
  return summary;
}

export function buildTimingRecord(input: {
  trigger: LightningTrigger;
  startedAt: number;
  respondedAt: number;
  drawnAt: number | null;
  strikes: number;
  outcome: LightningTimingOutcome;
  serverTiming: string | null;
}): LightningTimingRecord {
  const end = input.drawnAt ?? input.respondedAt;
  return {
    trigger: input.trigger,
    served: 'network',
    totalMs: Math.round(end - input.startedAt),
    networkMs: Math.round(input.respondedAt - input.startedAt),
    drawMs: input.drawnAt === null ? null : Math.round(input.drawnAt - input.respondedAt),
    strikes: input.strikes,
    outcome: input.outcome,
    server: parseServerTiming(input.serverTiming),
  };
}

export function buildReusedRecord(
  trigger: LightningTrigger,
  strikes: number,
  outcome: LightningTimingOutcome,
): LightningTimingRecord {
  return {
    trigger,
    served: 'reused',
    totalMs: 0,
    networkMs: 0,
    drawMs: 0,
    strikes,
    outcome,
    server: {},
  };
}

/** Developer console only: never console.error, which the browser checks treat as a failure. */
export function logRefreshTiming(record: LightningTimingRecord): void {
  console.info('[lightning] refresh timing', record);
}
