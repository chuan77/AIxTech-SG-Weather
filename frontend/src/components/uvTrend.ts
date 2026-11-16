/**
 * Today's UV trend for the UV tile (spec 008): pure view logic, no React.
 *
 * Built only from the stored snapshot (`uv_index`, `uv_hourly`) and the current time, so it is
 * unit-tested here and the tile just renders the result. The day comes from the data, so an
 * overnight snapshot (which carries the previous day's list) is labelled with that day.
 */
import type { UvDay } from '../types';
import { formatSgtTime, singaporeDate } from './sunTimes';

export type UvBand = 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme';
export type UvDirection = 'Rising' | 'Steady' | 'Falling';

/** Start of the Moderate band. Marked on the view; NEA and HealthHub state no "advised" level. */
export const UV_MODERATE_FROM = 3;

/** Published wording only (spec FR-008, research R1): NEA's usual peak, HealthHub's sunscreen advice. */
export const UV_GUIDANCE =
  'UV usually peaks 11 am – 3 pm (NEA). Use SPF 30+ sunscreen, applied 20–30 min before going into the sun (HealthHub).';

/** Caption for the peak band in the hourly view. */
export const UV_PEAK_CAPTION = 'NEA: usual peak 11 am – 3 pm';

/** 07:00 … 19:00 Singapore time: the hours NEA publishes UV for. */
export const UV_SLOT_HOURS: readonly number[] = Array.from({ length: 13 }, (_, i) => 7 + i);

export interface UvSlot {
  hour: number;
  /** null = no reading for this hour (not reported yet, or non-numeric). Never rendered as 0. */
  value: number | null;
  band: UvBand | null;
  /** Inside NEA's usual peak, 11 am – 3 pm. */
  inPeakWindow: boolean;
}

export type UvTrendView =
  | { kind: 'unavailable' }
  | { kind: 'pre-feature' }
  | { kind: 'empty' }
  | {
      kind: 'readings';
      isToday: boolean;
      /** null when today; '14 Nov' otherwise. */
      dayLabel: string | null;
      /** 'HH:MM' SGT of the provider's last update; null on previous days or when unknown. */
      asOf: string | null;
      slots: UvSlot[];
      direction: UvDirection | null;
      hoursAtModerateOrAbove: number;
    };

/** UV index bands (WHO / NEA scale). The tile label and the hourly slots share this. */
export function uvBandName(value: number | null | undefined): UvBand | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 2) return 'Low';
  if (value <= 5) return 'Moderate';
  if (value <= 7) return 'High';
  if (value <= 10) return 'Very High';
  return 'Extreme';
}

/** Width of the gauge slice a bar shows; must match `background-size: 2200%` on `.uv-bar`. */
const BAR_SLICE = 1 / 22;

/**
 * Inline `background-position-x` for a `.uv-bar` so its slice of `--scale-uv` is centred on the
 * value's place on the 0–11 gauge (12+ shows the Extreme end). A position, never a colour.
 */
export function uvBarPosition(value: number): string {
  const centre = Math.min(Math.max(value / 11, BAR_SLICE / 2), 1 - BAR_SLICE / 2);
  const offset = (centre - BAR_SLICE / 2) / (1 - BAR_SLICE);
  return `${Math.round(offset * 10000) / 100}%`;
}

/** Bar height as a fraction of the plot (0 still shows a baseline in the tile; 12+ is capped). */
export function uvBarFraction(value: number): number {
  return Math.min(Math.max(value, 0), 11) / 11;
}

const sgtHourFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Singapore',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** The Singapore hour (0–23) of an ISO time, or null when it doesn't parse. */
function sgtHour(iso: string): number | null {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : Number(sgtHourFormat.format(new Date(time)));
}

interface NumericReading {
  hour: number | null;
  value: number;
}

function directionOf(numeric: NumericReading[]): UvDirection | null {
  if (numeric.length < 2) return null;
  const latest = numeric[numeric.length - 1].value;
  const previous = numeric[numeric.length - 2].value;
  if (latest > previous) return 'Rising';
  if (latest < previous) return 'Falling';
  return 'Steady';
}

function sgtTimeOrNull(iso: string | null): string | null {
  const time = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(time) ? null : formatSgtTime(new Date(time));
}

const dayMonthFormat = new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore',
  day: 'numeric',
  month: 'short',
});

/** '14 Nov' for a 'YYYY-MM-DD' Singapore day (read at Singapore midday so no zone can shift it). */
export function uvDayLabel(date: string): string {
  const time = Date.parse(`${date}T12:00:00+08:00`);
  return Number.isNaN(time) ? date : dayMonthFormat.format(new Date(time));
}

type ReadingsView = Extract<UvTrendView, { kind: 'readings' }>;

/** e.g. 'Falling · 2 h at UV 3+ (Moderate or higher) so far' (contracts/ui.md item 3). */
export function uvStatusText(view: ReadingsView): string {
  // A previous day is complete, so its count isn't "so far" and it has no direction.
  const soFar = view.dayLabel ? '' : ' so far';
  const count =
    view.hoursAtModerateOrAbove === 0
      ? `No hours at UV ${UV_MODERATE_FROM}+${soFar}`
      : `${view.hoursAtModerateOrAbove} h at UV ${UV_MODERATE_FROM}+ (Moderate or higher)${soFar}`;
  const lead = view.dayLabel ?? view.direction;
  return lead ? `${lead} · ${count}` : count;
}

/**
 * e.g. 'Nationwide reading, measured at Changi · as of 15:11', or for a previous day
 * 'Readings for 14 Nov, measured at Changi' (contracts/ui.md item 6).
 */
export function uvSourceText(asOf: string | null, dayLabel: string | null = null): string {
  if (dayLabel) return `Readings for ${dayLabel}, measured at Changi`;
  const base = 'Nationwide reading, measured at Changi';
  return asOf ? `${base} · as of ${asOf}` : base;
}

export function uvTrendView(
  uvIndex: number | null | undefined,
  uvHourly: UvDay | null | undefined,
  now: Date,
): UvTrendView {
  if (!uvHourly) return uvIndex == null ? { kind: 'unavailable' } : { kind: 'pre-feature' };
  if (uvHourly.readings.length === 0) return { kind: 'empty' };

  const isToday = uvHourly.date === singaporeDate(now);
  const numeric: NumericReading[] = uvHourly.readings
    .filter((reading) => typeof reading.value === 'number' && Number.isFinite(reading.value))
    .map((reading) => ({ hour: sgtHour(reading.hour), value: reading.value as number }));

  const byHour = new Map<number, number | null>();
  for (const reading of uvHourly.readings) {
    const hour = sgtHour(reading.hour);
    if (hour !== null && !byHour.has(hour)) byHour.set(hour, reading.value);
  }

  const slots = UV_SLOT_HOURS.map((hour): UvSlot => {
    const value = byHour.get(hour) ?? null;
    return { hour, value, band: uvBandName(value), inPeakWindow: 11 <= hour && hour < 15 };
  });

  return {
    kind: 'readings',
    isToday,
    dayLabel: isToday ? null : uvDayLabel(uvHourly.date),
    asOf: isToday ? sgtTimeOrNull(uvHourly.as_of) : null,
    slots,
    direction: isToday ? directionOf(numeric) : null,
    hoursAtModerateOrAbove: numeric.filter((reading) => reading.value >= UV_MODERATE_FROM).length,
  };
}
