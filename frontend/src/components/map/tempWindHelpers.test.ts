import { describe, expect, it } from 'vitest';
import type { IslandConditionsObservation, TempWindStation } from '../../types';
import {
  arrowRotation,
  compassPoint,
  formatReadingTime,
  formatTemperature,
  isTempWindOutOfDate,
  markKind,
  parseTempWindEnabled,
  parseTempWindLegendSeen,
  readingTime,
  serialiseTempWindEnabled,
  shouldAutoOpenTempWindLegend,
  stationLabel,
  TEMP_WIND_LEGEND_SEEN_KEY,
  TEMP_WIND_LEVELS,
  TEMP_WIND_LICENCE_NOTICE,
  TEMP_WIND_OUT_OF_DATE_MS,
  TEMP_WIND_PROMPT,
  TEMP_WIND_STORAGE_KEY,
  tempWindAccessibleName,
  tempWindPopup,
  tempWindStatusMessage,
  windKmh,
  windLevel,
  windText,
} from './tempWindHelpers';

function station(overrides: Partial<TempWindStation> = {}): TempWindStation {
  return {
    id: 'S50',
    name: 'Clementi Road',
    latitude: 1.3337,
    longitude: 103.7768,
    temperature_c: 26.3,
    wind_speed_knots: 8.2, // 15 km/h
    wind_direction_deg: 228,
    ...overrides,
  };
}

const T_1333 = '2026-11-19T13:33:00+08:00';
const T_1334 = '2026-11-19T13:34:00+08:00';
const AT_1340 = Date.parse('2026-11-19T13:40:00+08:00');

function observation(
  overrides: Partial<IslandConditionsObservation> = {},
): IslandConditionsObservation {
  return {
    stations: [station()],
    measures: { temperature: 'ok', wind: 'ok' },
    temperature_at: T_1333,
    wind_at: T_1334,
    fetched_at: '2026-11-19T05:40:12.000Z',
    stale: false,
    ...overrides,
  };
}

describe('temperature and labels (US1)', () => {
  it('formats a temperature to one decimal, and missing as a dash', () => {
    expect(formatTemperature(27.4)).toBe('27.4°');
    expect(formatTemperature(27)).toBe('27.0°');
    expect(formatTemperature(null)).toBe('–°');
  });

  it('names a station, or "Station S199" when it has no name', () => {
    expect(stationLabel(station())).toBe('Clementi Road');
    expect(stationLabel(station({ id: 'S199', name: null }))).toBe('Station S199');
  });

  it('formats a reading time in Singapore time', () => {
    expect(formatReadingTime(T_1333)).toBe('1:33 pm');
    expect(formatReadingTime('2026-11-19T08:05:00+08:00')).toBe('8:05 am');
  });

  it('builds the popup as plain strings', () => {
    expect(tempWindPopup(station(), observation())).toEqual({
      title: 'Clementi Road',
      temperature: '26.3 °C',
      wind: '15 km/h, light, from SW (228°)',
      time: 'Readings at 1:33 pm',
      source: 'NEA via data.gov.sg',
    });
  });
});

describe('wind (US2)', () => {
  it('converts knots to whole km/h', () => {
    expect(windKmh(8.2)).toBe(15);
    expect(windKmh(0.4)).toBe(1);
  });

  it('bands km/h into calm, light, moderate and strong', () => {
    expect(windLevel(1.9)).toBe('calm');
    expect(windLevel(2)).toBe('light');
    expect(windLevel(19.9)).toBe('light');
    expect(windLevel(20)).toBe('moderate');
    expect(windLevel(38.9)).toBe('moderate');
    expect(windLevel(39)).toBe('strong');
  });

  it('turns the arrow to point the way the wind blows', () => {
    expect(arrowRotation(45)).toBe(225);
    expect(arrowRotation(270)).toBe(90);
    expect(arrowRotation(180)).toBe(0);
  });

  it('names one of 16 compass points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(45)).toBe('NE');
    expect(compassPoint(228)).toBe('SW');
    expect(compassPoint(253)).toBe('WSW');
    expect(compassPoint(359)).toBe('N');
  });

  it('picks the mark: arrow, calm or missing wind, and a value or missing temperature', () => {
    expect(markKind(station())).toEqual({ wind: 'arrow', level: 'light', temp: 'value' });
    expect(markKind(station({ wind_speed_knots: 25 }))).toMatchObject({ level: 'strong' });
    expect(markKind(station({ wind_speed_knots: 0.4, wind_direction_deg: null }))).toEqual({
      wind: 'calm',
      level: 'calm',
      temp: 'value',
    });
    // A speed with no direction gets no arrow (spec edge case).
    expect(markKind(station({ wind_direction_deg: null }))).toEqual({
      wind: 'missing',
      level: null,
      temp: 'value',
    });
    expect(markKind(station({ wind_speed_knots: null, temperature_c: null }))).toEqual({
      wind: 'missing',
      level: null,
      temp: 'missing',
    });
  });

  it('describes the wind for the popup', () => {
    expect(windText(station())).toBe('15 km/h, light, from SW (228°)');
    expect(windText(station({ wind_speed_knots: 0.4 }))).toBe('Calm (1 km/h)');
    expect(windText(station({ wind_direction_deg: null }))).toBe(
      '15 km/h, light, direction not reported',
    );
    expect(windText(station({ wind_speed_knots: null }))).toBe('No reading');
  });

  it('lists the key levels in order with their ranges', () => {
    expect(TEMP_WIND_LEVELS.map((entry) => entry.level)).toEqual([
      'calm',
      'light',
      'moderate',
      'strong',
    ]);
    expect(TEMP_WIND_LEVELS.map((entry) => entry.range)).toEqual([
      'under 2 km/h',
      '2–19 km/h',
      '20–38 km/h',
      '39 km/h or more',
    ]);
  });

  it('gives each mark a spoken name', () => {
    expect(tempWindAccessibleName(station())).toBe(
      'Clementi Road, 26.3 degrees, wind light from south-west',
    );
    expect(tempWindAccessibleName(station({ id: 'S199', name: null, temperature_c: null }))).toBe(
      'Station S199, no temperature reading, wind light from south-west',
    );
    expect(tempWindAccessibleName(station({ wind_speed_knots: 0.2 }))).toBe(
      'Clementi Road, 26.3 degrees, wind calm',
    );
    expect(tempWindAccessibleName(station({ wind_speed_knots: null }))).toBe(
      'Clementi Road, 26.3 degrees, no wind reading',
    );
  });

  it('credits all three datasets under the open data licence', () => {
    expect(TEMP_WIND_LICENCE_NOTICE).toContain('Air Temperature across Singapore');
    expect(TEMP_WIND_LICENCE_NOTICE).toContain('Wind Speed across Singapore');
    expect(TEMP_WIND_LICENCE_NOTICE).toContain('Wind Direction across Singapore');
    expect(TEMP_WIND_LICENCE_NOTICE).toContain('(NEA), accessed from data.gov.sg');
  });
});

describe('freshness and missing readings (US3)', () => {
  it('uses the older of the two reading times', () => {
    expect(readingTime(observation())).toBe(T_1333);
    expect(readingTime(observation({ temperature_at: null }))).toBe(T_1334);
    expect(readingTime(observation({ temperature_at: null, wind_at: null }))).toBeNull();
  });

  it('marks readings out of date after 15 minutes, or when stale', () => {
    expect(TEMP_WIND_OUT_OF_DATE_MS).toBe(15 * 60_000);
    const readAt = Date.parse(T_1333);
    expect(isTempWindOutOfDate(observation(), readAt + 14 * 60_000 + 59_000)).toBe(false);
    expect(isTempWindOutOfDate(observation(), readAt + 15 * 60_000 + 1_000)).toBe(true);
    expect(isTempWindOutOfDate(observation({ stale: true }), readAt + 60_000)).toBe(true);
    expect(isTempWindOutOfDate(null, readAt)).toBe(false);
  });

  it('shows the time and age once readings are on screen', () => {
    expect(tempWindStatusMessage('ready', observation(), AT_1340)).toEqual({
      text: 'Temp & wind at 1 station',
      updatedText: 'at 1:33 pm · 7 min ago',
    });
    expect(tempWindStatusMessage('ready', observation(), AT_1340 + 10 * 60_000).updatedText).toBe(
      'at 1:33 pm · 17 min ago · out of date',
    );
  });

  it('says when the whole island is calm', () => {
    const calm = observation({
      stations: [station({ wind_speed_knots: 0.3 }), station({ id: 'S1', wind_speed_knots: 0 })],
    });
    expect(tempWindStatusMessage('ready', calm, AT_1340).text).toBe('Calm across the island');
  });

  it('names a measure that failed', () => {
    const noWind = observation({
      measures: { temperature: 'ok', wind: 'unavailable' },
      wind_at: null,
    });
    expect(tempWindStatusMessage('ready', noWind, AT_1340).text).toBe(
      'Temp & wind at 1 station · Wind unavailable',
    );
    const noTemperature = observation({
      measures: { temperature: 'unavailable', wind: 'ok' },
      temperature_at: null,
    });
    expect(tempWindStatusMessage('ready', noTemperature, AT_1340).text).toBe(
      'Temp & wind at 1 station · Temperature unavailable',
    );
  });

  it('says "No reading" for both measures at a station that has neither', () => {
    const empty = station({
      temperature_c: null,
      wind_speed_knots: null,
      wind_direction_deg: null,
    });
    expect(tempWindPopup(empty, observation())).toMatchObject({
      temperature: 'No reading',
      wind: 'No reading',
    });
  });

  it('says "Unavailable" in the popup for a measure that failed', () => {
    const noWind = observation({ measures: { temperature: 'ok', wind: 'unavailable' } });
    expect(tempWindPopup(station({ wind_speed_knots: null }), noWind).wind).toBe('Unavailable');
  });
});

describe('switching on and off (US4)', () => {
  it('uses its own storage keys', () => {
    expect(TEMP_WIND_STORAGE_KEY).toBe('weather-starter.tempWind.enabled');
    expect(TEMP_WIND_LEGEND_SEEN_KEY).toBe('weather-starter.tempWind.legendSeen');
  });

  it('is off unless the device remembers "true"', () => {
    expect(parseTempWindEnabled(null)).toBe(false);
    expect(parseTempWindEnabled('')).toBe(false);
    expect(parseTempWindEnabled('1')).toBe(false);
    expect(parseTempWindEnabled('true')).toBe(true);
    expect(serialiseTempWindEnabled(true)).toBe('true');
    expect(serialiseTempWindEnabled(false)).toBe('false');
  });

  it('opens the legend by itself only the first time readings are ready', () => {
    expect(parseTempWindLegendSeen(null)).toBe(false);
    expect(parseTempWindLegendSeen('true')).toBe(true);
    expect(shouldAutoOpenTempWindLegend(false, 'ready')).toBe(true);
    expect(shouldAutoOpenTempWindLegend(true, 'ready')).toBe(false);
    expect(shouldAutoOpenTempWindLegend(false, 'loading')).toBe(false);
    expect(shouldAutoOpenTempWindLegend(false, 'idle')).toBe(false);
  });

  it('prompts after a reload instead of fetching, distinct from unavailable', () => {
    expect(TEMP_WIND_PROMPT).toBe('Show latest temperature & wind');
    expect(tempWindStatusMessage('idle', null, AT_1340)).toEqual({
      text: 'Show latest temperature & wind',
      updatedText: null,
    });
    expect(tempWindStatusMessage('unavailable', null, AT_1340).text).not.toBe(TEMP_WIND_PROMPT);
  });
});

describe('refresh and failure (US5)', () => {
  it('keeps the earlier time on screen while updating', () => {
    expect(tempWindStatusMessage('loading', observation(), AT_1340)).toEqual({
      text: 'Updating temperature & wind…',
      updatedText: 'at 1:33 pm · 7 min ago',
    });
    expect(tempWindStatusMessage('loading', null, AT_1340)).toEqual({
      text: 'Loading temperature & wind…',
      updatedText: null,
    });
  });

  it('keeps earlier readings, marked out of date, when a refresh fails', () => {
    expect(tempWindStatusMessage('unavailable', observation(), AT_1340)).toEqual({
      text: 'Fresh data unavailable, showing earlier readings',
      updatedText: 'at 1:33 pm · 7 min ago · out of date',
    });
  });

  it('says data is unavailable when there is nothing to show', () => {
    expect(tempWindStatusMessage('unavailable', null, AT_1340)).toEqual({
      text: 'Temperature and wind data is unavailable',
      updatedText: null,
    });
  });

  it('marks a stale copy out of date', () => {
    expect(tempWindStatusMessage('ready', observation({ stale: true }), AT_1340).updatedText).toBe(
      'at 1:33 pm · 7 min ago · out of date',
    );
  });
});
