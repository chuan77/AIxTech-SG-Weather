import { describe, expect, it } from 'vitest';
import type { Location } from '../../types';
import { conditionToIcon, formatPinLabel, getBounds, SINGAPORE_BOUNDS } from './mapHelpers';

function makeLocation(overrides: Partial<Location> & { temperature_c?: number | null } = {}) {
  const { temperature_c = 29.4, ...rest } = overrides;
  return {
    id: 1,
    latitude: 1.3,
    longitude: 103.8,
    created_at: '2026-11-01T00:00:00Z',
    weather: { condition: 'Cloudy', temperature_c },
    ...rest,
  } as Location;
}

describe('conditionToIcon', () => {
  it.each([
    ['Thundery Showers', 'thunder'],
    ['Heavy Rain', 'rain'],
    ['Light Showers', 'rain'],
    ['Partly Cloudy (Day)', 'cloud'],
    ['Hazy', 'cloud'],
    ['Fair (Day)', 'sun'],
    ['Not refreshed', 'unknown'],
    [null, 'unknown'],
    [undefined, 'unknown'],
  ])('maps %s to %s', (condition, expected) => {
    expect(conditionToIcon(condition)).toBe(expected);
  });
});

describe('formatPinLabel', () => {
  it('rounds the temperature and adds a degree sign', () => {
    expect(formatPinLabel(makeLocation({ temperature_c: 29.6 }))).toBe('30°');
  });

  it('falls back to dashes when the location has not been refreshed', () => {
    expect(formatPinLabel(makeLocation({ temperature_c: null }))).toBe('--°');
  });
});

describe('getBounds', () => {
  it('falls back to Singapore bounds when there are no locations', () => {
    expect(getBounds([])).toEqual(SINGAPORE_BOUNDS);
  });

  it('pads a single location so the map does not zoom to the maximum', () => {
    const [[south, west], [north, east]] = getBounds([{ latitude: 1.3, longitude: 103.8 }]);
    expect(south).toBeLessThan(1.3);
    expect(north).toBeGreaterThan(1.3);
    expect(west).toBeLessThan(103.8);
    expect(east).toBeGreaterThan(103.8);
  });

  it('spans every location', () => {
    expect(
      getBounds([
        { latitude: 1.28, longitude: 103.85 },
        { latitude: 1.44, longitude: 103.7 },
        { latitude: 1.33, longitude: 103.95 },
      ]),
    ).toEqual([
      [1.28, 103.7],
      [1.44, 103.95],
    ]);
  });
});
