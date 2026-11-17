import { describe, expect, it } from 'vitest';
import type { IslandRainObservation, RainStationReading } from '../../types';
import {
  combinedStatusSegments,
  formatRainPeriod,
  formatRainTotal,
  isRainOutOfDate,
  isWet,
  layersLabel,
  parseLegendSeen,
  parseRainEnabled,
  RAIN_LEGEND_SEEN_KEY,
  RAIN_LEVELS,
  RAIN_OUT_OF_DATE_MS,
  RAIN_STORAGE_KEY,
  rainCoverage,
  rainLevel,
  rainMarkKind,
  rainPopup,
  rainStatusMessage,
  serialiseRainEnabled,
  shouldAutoOpenLegend,
} from './rainHelpers';

const WINDOW_END = '2026-11-17T08:15:00+08:00';
const NOW = Date.parse(WINDOW_END) + 10 * 60_000; // 08:25 SGT

function reading(overrides: Partial<RainStationReading> = {}): RainStationReading {
  return {
    id: 'S1',
    name: 'Scotts Road',
    latitude: 1.31,
    longitude: 103.83,
    total_mm: 1.4,
    periods_covered: 3,
    ...overrides,
  };
}

function observation(overrides: Partial<IslandRainObservation> = {}): IslandRainObservation {
  return {
    stations: [reading(), reading({ id: 'S2', total_mm: 0 }), reading({ id: 'S3', total_mm: 0.2 })],
    window_minutes: 15,
    window_start: '2026-11-17T08:00:00+08:00',
    window_end: WINDOW_END,
    periods_found: 3,
    fetched_at: '2026-11-17T00:24:00.000Z',
    stale: false,
    ...overrides,
  };
}

describe('formatting (US1)', () => {
  it('formats totals without a trailing .0', () => {
    expect(formatRainTotal(0)).toBe('0 mm');
    expect(formatRainTotal(0.2)).toBe('0.2 mm');
    expect(formatRainTotal(12)).toBe('12 mm');
    expect(formatRainTotal(2.5)).toBe('2.5 mm');
  });

  it('formats the window in Singapore time', () => {
    expect(formatRainPeriod('2026-11-17T08:00:00+08:00', WINDOW_END)).toBe('8:00–8:15 am');
    expect(formatRainPeriod('2026-11-17T11:50:00+08:00', '2026-11-17T12:05:00+08:00')).toBe(
      '11:50 am–12:05 pm',
    );
    expect(formatRainPeriod(null, null)).toBe('time unknown');
  });

  it('calls a station wet only when rain fell', () => {
    expect(isWet(reading({ total_mm: 0.2 }))).toBe(true);
    expect(isWet(reading({ total_mm: 0 }))).toBe(false);
    expect(isWet(reading({ total_mm: null, periods_covered: 0 }))).toBe(false);
  });

  it('builds a popup from plain strings', () => {
    expect(rainPopup(reading(), observation())).toEqual({
      title: 'Scotts Road',
      total: '1.4 mm',
      level: 'Moderate',
      period: '8:00–8:15 am',
      note: null,
      source: 'Rainfall: NEA via data.gov.sg',
    });
  });
});

describe('levels (US2)', () => {
  it('uses the light / moderate / heavy thresholds at their boundaries', () => {
    expect(rainLevel(0)).toBe('dry');
    expect(rainLevel(0.2)).toBe('light');
    expect(rainLevel(0.4)).toBe('light');
    expect(rainLevel(0.59)).toBe('light');
    expect(rainLevel(0.6)).toBe('moderate');
    expect(rainLevel(2.4)).toBe('moderate');
    expect(rainLevel(2.5)).toBe('heavy');
    expect(rainLevel(2.6)).toBe('heavy');
    expect(rainLevel(12)).toBe('heavy');
  });

  it('describes each level in mm per 15 minutes and per hour, in order', () => {
    expect(RAIN_LEVELS).toEqual([
      { level: 'light', label: 'Light', rangeMm: 'under 0.6 mm', rangePerHour: 'under 2.5 mm/h' },
      { level: 'moderate', label: 'Moderate', rangeMm: '0.6–2.5 mm', rangePerHour: '2.5–10 mm/h' },
      {
        level: 'heavy',
        label: 'Heavy',
        rangeMm: '2.5 mm or more',
        rangePerHour: '10 mm/h or more',
      },
    ]);
  });

  it('labels a dry station in its popup', () => {
    expect(rainPopup(reading({ total_mm: 0 }), observation()).level).toBe('Dry');
  });
});

describe('coverage and freshness (US3)', () => {
  it('names full, partial and missing coverage', () => {
    expect(rainCoverage(reading())).toEqual({ kind: 'full', label: null });
    expect(rainCoverage(reading({ periods_covered: 2 }))).toEqual({
      kind: 'partial',
      label: '10 of 15 min',
    });
    expect(rainCoverage(reading({ periods_covered: 1 }))).toEqual({
      kind: 'partial',
      label: '5 of 15 min',
    });
    expect(rainCoverage(reading({ total_mm: null, periods_covered: 0 }))).toEqual({
      kind: 'none',
      label: 'No reading',
    });
  });

  it('never draws a station with no reading as dry', () => {
    expect(rainMarkKind(reading({ total_mm: null, periods_covered: 0 }))).toEqual({
      kind: 'missing',
      partial: false,
    });
    expect(rainMarkKind(reading({ total_mm: 0 }))).toEqual({ kind: 'dry', partial: false });
    expect(rainMarkKind(reading({ total_mm: 3, periods_covered: 1 }))).toEqual({
      kind: 'heavy',
      partial: true,
    });
  });

  it('gives a missing station a note and no level or total', () => {
    const popup = rainPopup(reading({ total_mm: null, periods_covered: 0 }), observation());
    expect(popup).toMatchObject({
      total: null,
      level: null,
      note: 'No reading in the last 15 minutes',
    });
  });

  it('notes a partial total', () => {
    expect(rainPopup(reading({ periods_covered: 2 }), observation()).note).toBe(
      'Partial: 10 of 15 min',
    );
  });

  it('is out of date after 20 minutes or when served stale', () => {
    const end = Date.parse(WINDOW_END);
    expect(RAIN_OUT_OF_DATE_MS).toBe(1_200_000);
    expect(isRainOutOfDate(observation(), end + 1_200_000)).toBe(false);
    expect(isRainOutOfDate(observation(), end + 1_200_001)).toBe(true);
    expect(isRainOutOfDate(observation({ stale: true }), end)).toBe(true);
    expect(isRainOutOfDate(observation({ window_end: null }), end)).toBe(true);
    expect(isRainOutOfDate(null, end)).toBe(false);
  });

  it('words every status distinctly', () => {
    expect(rainStatusMessage('idle', null, NOW)).toEqual({
      text: 'Show latest rain',
      updatedText: null,
    });
    expect(rainStatusMessage('loading', null, NOW).text).toBe('Loading rain…');
    expect(rainStatusMessage('ok', observation(), NOW).text).toBe('Rain at 2 stations');
    expect(rainStatusMessage('ok', observation({ stations: [reading()] }), NOW).text).toBe(
      'Rain at 1 station',
    );
    expect(rainStatusMessage('empty', observation(), NOW).text).toBe(
      'No rain in the last 15 minutes',
    );
    expect(rainStatusMessage('unavailable', null, NOW).text).toBe('Rain data unavailable');
  });

  it('gives the reading time and age, and flags out-of-date data', () => {
    expect(rainStatusMessage('ok', observation(), NOW).updatedText).toBe('to 8:15 am · 10 min ago');
    expect(
      rainStatusMessage('ok', observation(), Date.parse(WINDOW_END) + 25 * 60_000).updatedText,
    ).toBe('to 8:15 am · 25 min ago · out of date');
    expect(rainStatusMessage('unavailable', observation({ stale: true }), NOW).updatedText).toBe(
      'to 8:15 am · 10 min ago · out of date',
    );
  });
});

describe('remembered choice (US4)', () => {
  it('uses its own storage key', () => {
    expect(RAIN_STORAGE_KEY).toBe('weather-starter.rain.enabled');
  });

  it('is off unless "true" was stored', () => {
    expect(parseRainEnabled(null)).toBe(false);
    expect(parseRainEnabled('')).toBe(false);
    expect(parseRainEnabled('yes')).toBe(false);
    expect(parseRainEnabled('false')).toBe(false);
    expect(parseRainEnabled('true')).toBe(true);
  });

  it('round-trips', () => {
    expect(parseRainEnabled(serialiseRainEnabled(true))).toBe(true);
    expect(parseRainEnabled(serialiseRainEnabled(false))).toBe(false);
  });
});

describe('attribution (FR-017)', () => {
  it('names the dataset and links the Singapore Open Data Licence', async () => {
    const { RAIN_LICENCE_NOTICE, RAIN_LICENCE_NAME, RAIN_LICENCE_URL } =
      await import('./rainHelpers');
    expect(RAIN_LICENCE_NOTICE).toMatch(
      /^Contains information from Rainfall across Singapore \(NEA\)/,
    );
    expect(RAIN_LICENCE_NAME).toBe('Singapore Open Data Licence version 1.0');
    expect(RAIN_LICENCE_URL).toBe('https://data.gov.sg/open-data-licence');
  });
});

describe('card map strip and Layers button (Gate 2)', () => {
  it('joins rain and lightning into one line, leaving out layers that are off', () => {
    const rain = { enabled: true, status: 'ok' as const, observation: observation() };
    expect(combinedStatusSegments(rain, '1 strike in the last hour', NOW)).toEqual([
      'Rain at 2 stations · 10 min ago',
      'Lightning: 1 strike in the last hour',
    ]);
    expect(
      combinedStatusSegments({ ...rain, enabled: false }, '1 strike in the last hour', NOW),
    ).toEqual(['Lightning: 1 strike in the last hour']);
    expect(combinedStatusSegments(rain, null, NOW)).toEqual(['Rain at 2 stations · 10 min ago']);
    expect(combinedStatusSegments({ ...rain, enabled: false }, null, NOW)).toEqual([]);
  });

  it('keeps out-of-date and idle states visible on the card', () => {
    const stale = {
      enabled: true,
      status: 'unavailable' as const,
      observation: observation({ stale: true }),
    };
    expect(combinedStatusSegments(stale, null, NOW)).toEqual([
      'Rain data unavailable · out of date',
    ]);
    const idle = { enabled: true, status: 'idle' as const, observation: null };
    expect(combinedStatusSegments(idle, null, NOW)).toEqual(['Show latest rain']);
  });

  it('names the layers that are on for screen readers', () => {
    expect(layersLabel(true, true)).toBe('Map layers: rain and lightning on');
    expect(layersLabel(true, false)).toBe('Map layers: rain on');
    expect(layersLabel(false, true)).toBe('Map layers: lightning on');
    expect(layersLabel(false, false)).toBe('Map layers: all off');
  });
});

describe('legend opens by itself once', () => {
  it('uses its own storage key', () => {
    expect(RAIN_LEGEND_SEEN_KEY).toBe('weather-starter.rain.legendSeen');
  });

  it('counts as seen only when "true" was stored', () => {
    expect(parseLegendSeen(null)).toBe(false);
    expect(parseLegendSeen('false')).toBe(false);
    expect(parseLegendSeen('true')).toBe(true);
  });

  it('opens when readings first show, dry or wet', () => {
    expect(shouldAutoOpenLegend(false, 'ok')).toBe(true);
    expect(shouldAutoOpenLegend(false, 'empty')).toBe(true);
  });

  it('waits while nothing is drawn', () => {
    expect(shouldAutoOpenLegend(false, 'idle')).toBe(false);
    expect(shouldAutoOpenLegend(false, 'loading')).toBe(false);
    expect(shouldAutoOpenLegend(false, 'unavailable')).toBe(false);
  });

  it('never opens by itself again once seen', () => {
    expect(shouldAutoOpenLegend(true, 'ok')).toBe(false);
    expect(shouldAutoOpenLegend(true, 'empty')).toBe(false);
  });
});
