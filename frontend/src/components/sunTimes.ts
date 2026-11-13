/**
 * Sunrise and sunset from position and date, using NOAA's general solar position approximation
 * (fractional year → equation of time and declination → hour angle at zenith 90.833°).
 * Accurate to about a minute near the equator; no network call.
 */

const SINGAPORE_TZ = 'Asia/Singapore';
const SUN_ZENITH_DEG = 90.833; // includes atmospheric refraction and the solar disc radius

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

/** Today's calendar date in Singapore as YYYY-MM-DD, whatever the browser's own time zone. */
export function singaporeDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SINGAPORE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** HH:MM (24-hour) in Singapore time, rounded to the nearest minute. */
export function formatSgtTime(date: Date): string {
  const rounded = new Date(Math.round(date.getTime() / 60_000) * 60_000);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SINGAPORE_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(rounded);
}

export function sunTimes(latitude: number, longitude: number, isoDate: string): SunTimes {
  const [year, month, day] = isoDate.split('-').map(Number);
  const midnightUtc = Date.UTC(year, month - 1, day);
  const dayOfYear = (midnightUtc - Date.UTC(year, 0, 1)) / 86_400_000 + 1;
  const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;

  // Fractional year (radians) at local solar noon.
  const gamma = ((2 * Math.PI) / daysInYear) * (dayOfYear - 1);

  const equationOfTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const lat = toRad(latitude);
  const hourAngleDeg = toDeg(
    Math.acos(
      Math.cos(toRad(SUN_ZENITH_DEG)) / (Math.cos(lat) * Math.cos(declination)) -
        Math.tan(lat) * Math.tan(declination),
    ),
  );

  const sunriseMinUtc = 720 - 4 * (longitude + hourAngleDeg) - equationOfTimeMin;
  const sunsetMinUtc = 720 - 4 * (longitude - hourAngleDeg) - equationOfTimeMin;

  return {
    sunrise: new Date(midnightUtc + sunriseMinUtc * 60_000),
    sunset: new Date(midnightUtc + sunsetMinUtc * 60_000),
  };
}
