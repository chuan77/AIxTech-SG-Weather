import type { LightningTiming } from './lightning.js';

const SERVED = new Set(['cache', 'shared', 'fetch']);

/** The cost fields lightning and rain timings share (`RainTiming` has the same ones). */
type ProviderCost =
  | 'served'
  | 'providerMs'
  | 'pacingWaitMs'
  | 'retryWaitMs'
  | 'retries'
  | 'requests'
  | 'pages';

function ms(value: number): number {
  return Math.max(0, Math.round(value));
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * A lightning or rain refresh's timing as a standard Server-Timing header (shown in DevTools' Network tab
 * and read by the browser's timing log). Only numbers and the fixed `served` enum are ever written,
 * so no URL, key or provider text can reach it.
 */
export function formatServerTiming(
  // Other fields (strikes, stations, outcome, errorKind) may be present and are ignored.
  timing: Partial<Pick<LightningTiming, ProviderCost>> & { totalMs: number } & Record<
      string,
      unknown
    >,
): string {
  const metrics = [`total;dur=${ms(timing.totalMs)}`];
  if (isCount(timing.providerMs)) {
    const served = timing.served && SERVED.has(timing.served) ? `;desc="${timing.served}"` : '';
    metrics.push(`provider;dur=${ms(timing.providerMs)}${served}`);
  }
  if (isCount(timing.pacingWaitMs)) metrics.push(`pacing;dur=${ms(timing.pacingWaitMs)}`);
  if (isCount(timing.retryWaitMs)) metrics.push(`retry;dur=${ms(timing.retryWaitMs)}`);
  if (isCount(timing.retries) && timing.retries > 0) {
    metrics.push(`retries;desc="${Math.round(timing.retries)}"`);
  }
  if (isCount(timing.requests)) metrics.push(`requests;desc="${Math.round(timing.requests)}"`);
  if (isCount(timing.pages)) metrics.push(`pages;desc="${Math.round(timing.pages)}"`);
  return metrics.join(', ');
}
