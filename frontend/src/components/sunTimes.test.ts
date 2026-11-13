import { describe, expect, it } from 'vitest';
import { formatSgtTime, singaporeDate, sunTimes } from './sunTimes';

const LAT = 1.3521;
const LON = 103.8198;
const TWO_MINUTES_MS = 2 * 60 * 1000;

// Reference values from https://api.sunrise-sunset.org/json?lat=1.3521&lng=103.8198&date=<date>&formatted=0
// fetched 2026-11-13 (UTC instants; SGT = UTC+8).
const REFERENCES = [
  { date: '2026-03-20', sunrise: '2026-03-19T23:08:52Z', sunset: '2026-03-20T11:15:39Z' },
  { date: '2026-06-21', sunrise: '2026-06-20T23:00:27Z', sunset: '2026-06-21T11:12:31Z' },
  { date: '2026-11-13', sunrise: '2026-11-12T22:47:07Z', sunset: '2026-11-13T10:50:47Z' },
];

describe('sunTimes', () => {
  it.each(REFERENCES)(
    'is within 2 minutes of the reference on $date',
    ({ date, sunrise, sunset }) => {
      const result = sunTimes(LAT, LON, date);
      expect(Math.abs(result.sunrise.getTime() - Date.parse(sunrise))).toBeLessThan(TWO_MINUTES_MS);
      expect(Math.abs(result.sunset.getTime() - Date.parse(sunset))).toBeLessThan(TWO_MINUTES_MS);
    },
  );
});

describe('singaporeDate', () => {
  it('uses the Singapore calendar date, not UTC', () => {
    expect(singaporeDate(new Date('2026-11-13T16:30:00Z'))).toBe('2026-11-14');
    expect(singaporeDate(new Date('2026-11-13T15:59:00Z'))).toBe('2026-11-13');
  });
});

describe('formatSgtTime', () => {
  it('formats HH:MM in Singapore time, rounded to the nearest minute', () => {
    expect(formatSgtTime(new Date('2026-11-12T22:47:07Z'))).toBe('06:47');
    expect(formatSgtTime(new Date('2026-11-13T10:50:47Z'))).toBe('18:51');
    expect(formatSgtTime(new Date('2026-11-13T15:59:40Z'))).toBe('00:00');
  });
});
