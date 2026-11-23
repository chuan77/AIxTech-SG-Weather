import type { WeatherSnapshot } from '../types';
import { readingFreshness } from './freshness';
import { conditionToIcon } from './map/mapHelpers';
import { periodTimeLabel, shortenPeriodLabel, singaporeDayStart } from './periodLabel';

// When each stored forecast applies (spec 018). NEA's printed dates are often wrong, so only the
// clock words are read, and they are placed by the snapshot's reading time.

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * A forecast's first window starts no later than this after the reading: NEA issues periods up to
 * 49 minutes early (research R2).
 */
const ISSUE_LEAD_MS = 120 * MINUTE_MS;

export interface ForecastWindow {
  /** Inclusive, in ms. */
  start: number;
  /** Exclusive, in ms. */
  end: number;
}

export type ForecastKind = 'thunder' | 'rain' | 'other';

/** The state decides whether a window is known, so narrowing on it also narrows `window`. */
type Timing =
  | { state: 'unknown'; window: null }
  | { state: 'upcoming' | 'active' | 'ended'; window: ForecastWindow };

export type TimedForecast = Timing & {
  source: 'two-hour' | 'period';
  /** Raw text, for the strip's fallback label. */
  label: string;
  /** NEA's wording. */
  text: string;
  kind: ForecastKind;
  /** A period without wording. It keeps its window, and is no evidence of dry weather. */
  missing: boolean;
};

export interface ForecastOutlook {
  /** The time of viewing, for day words. */
  now: number;
  /** The time judged: `now`, or the reading time when stale. */
  at: number;
  fresh: boolean;
  nearTerm: TimedForecast;
  /** Same length and order as stored. */
  periods: TimedForecast[];
  thunderActive: boolean;
  stormSky: boolean;
}

// "Midday", "6 am", "11.30 pm", "12pm", "6:30 pm", optionally followed by a date to ignore.
const CLOCK_WORDS =
  /^(?:(midnight|midday)|(\d{1,2})(?:[.:](\d{2}))?\s*([ap]m))(?:\s+\d{1,2}\s+[a-z]{3,9}(?:\s+\d{4})?)?$/i;

/** Milliseconds after midnight for a clock phrase, or null when it can't be read. */
function readClock(text: string): number | null {
  const match = CLOCK_WORDS.exec(text.trim());
  if (!match) return null;
  const [, word, hourText, minuteText, meridiem] = match;
  if (word) return word.toLowerCase() === 'midnight' ? 0 : DAY_MS / 2;

  const hour = Number(hourText);
  const minute = Number(minuteText ?? 0);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const hour24 = (hour % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
  return (hour24 * 60 + minute) * MINUTE_MS;
}

/** The start clock time and length of "<time> to <time>", or null. */
function readSpan(text: string): { clock: number; length: number } | null {
  const ends = text.split(/\s+to\s+/i);
  if (ends.length !== 2) return null;
  const start = readClock(ends[0]);
  const end = readClock(ends[1]);
  if (start === null || end === null || start === end) return null;
  return { clock: start, length: (end - start + DAY_MS) % DAY_MS };
}

/** The latest occurrence that starts no later than the lead after the reading. */
function anchoredWindow(text: string, observed: number): ForecastWindow | null {
  const span = readSpan(text);
  if (!span || !Number.isFinite(observed)) return null;
  const latest = observed + ISSUE_LEAD_MS;
  let start = singaporeDayStart(latest) + span.clock;
  if (start > latest) start -= DAY_MS;
  return { start, end: start + span.length };
}

/** Periods run consecutively: each starts at the previous end, or it and the rest are unknown. */
function chainedWindows(labels: string[], observed: number): (ForecastWindow | null)[] {
  let previous: ForecastWindow | null = null;
  return labels.map((label, index) => {
    if (index === 0) {
      previous = anchoredWindow(label, observed);
    } else if (previous) {
      const span = readSpan(label);
      const start: number = previous.end;
      previous =
        span && singaporeDayStart(start) + span.clock === start
          ? { start, end: start + span.length }
          : null;
    }
    return previous;
  });
}

function timingAt(window: ForecastWindow | null, at: number): Timing {
  if (!window) return { state: 'unknown', window };
  if (at < window.start) return { state: 'upcoming', window };
  return { state: at < window.end ? 'active' : 'ended', window };
}

function kindOf(text: string): ForecastKind {
  const icon = conditionToIcon(text);
  return icon === 'thunder' || icon === 'rain' ? icon : 'other';
}

/**
 * The one reading of a snapshot's forecasts at `now` that the top line, strip and sky all use.
 * Pure: it never reads the clock. A stale reading is judged at its reading time.
 */
export function forecastOutlook(weather: WeatherSnapshot, now: number): ForecastOutlook {
  const observed = Date.parse(weather.observed_at ?? '');
  const freshness = readingFreshness(weather.observed_at, now).kind;
  const at = freshness === 'stale' ? observed : now;
  const fresh = freshness === 'fresh';

  const validity = weather.valid_period_text ?? '';
  const condition = weather.condition ?? '';
  const nearTerm: TimedForecast = {
    ...timingAt(anchoredWindow(validity, observed), at),
    source: 'two-hour',
    label: validity,
    text: condition,
    kind: kindOf(condition),
    missing: false,
  };

  const stored = weather.forecast_periods ?? [];
  const windows = chainedWindows(
    stored.map((period) => period.label ?? ''),
    observed,
  );
  const periods = stored.map((period, index): TimedForecast => {
    const text = period.forecast ?? '';
    return {
      ...timingAt(windows[index], at),
      source: 'period',
      label: period.label ?? '',
      text,
      kind: kindOf(text),
      missing: !text.trim(),
    };
  });

  const thunderActive = [nearTerm, ...periods].some(
    (forecast) => forecast.kind === 'thunder' && forecast.state === 'active',
  );
  return { now, at, fresh, nearTerm, periods, thunderActive, stormSky: fresh && thunderActive };
}

/** One label per period: "Now" for the one in force on a fresh reading, otherwise its start. */
export function stripLabels({ now, fresh, periods }: ForecastOutlook): string[] {
  return periods.map((period) => {
    if (fresh && period.state === 'active') return 'Now';
    if (period.window) return periodTimeLabel(period.window.start, now);
    return shortenPeriodLabel(period.label) || '--';
  });
}
