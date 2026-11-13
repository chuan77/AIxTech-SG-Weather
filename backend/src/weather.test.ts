import { afterEach, describe, expect, it, vi } from 'vitest';
import { SingaporeWeatherClient } from './weather.js';

const readingTimestamps = {
  temperature: '2026-11-01T10:01:00Z',
  humidity: '2026-11-01T10:02:00Z',
  rainfall: '2026-11-01T10:00:00Z',
  windSpeed: '2026-11-01T10:03:00Z',
  windDirection: '2026-11-01T10:04:00Z',
};

function installFetchMock(failedPath?: string, rateLimitedPath?: string) {
  const rateLimitAttempts = new Map<string, number>();
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input.toString());
    if (url.pathname === failedPath) {
      return new Response('provider error', { status: 503 });
    }
    if (url.pathname === rateLimitedPath && (rateLimitAttempts.get(url.pathname) ?? 0) === 0) {
      rateLimitAttempts.set(url.pathname, 1);
      return new Response('rate limited', { status: 429 });
    }

    return new Response(JSON.stringify(payloadFor(url.pathname)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function payloadFor(path: string) {
  if (path.endsWith('/two-hr-forecast')) {
    return {
      code: 0,
      data: {
        area_metadata: [{ name: 'Bishan', label_location: { latitude: 1.35, longitude: 103.85 } }],
        items: [
          {
            update_timestamp: '2026-11-01T10:00:00Z',
            valid_period: { text: '10am to 12pm' },
            forecasts: [{ area: 'Bishan', forecast: 'Light Rain' }],
          },
        ],
      },
    };
  }

  if (path.endsWith('/air-temperature')) {
    return stationReading(29.5, readingTimestamps.temperature);
  }
  if (path.endsWith('/relative-humidity')) {
    return stationReading(81, readingTimestamps.humidity);
  }
  if (path.endsWith('/rainfall')) {
    return stationReading(4.8, readingTimestamps.rainfall);
  }
  if (path.endsWith('/wind-speed')) {
    return stationReading(7.4, readingTimestamps.windSpeed);
  }
  if (path.endsWith('/wind-direction')) {
    return stationReading(180, readingTimestamps.windDirection);
  }
  if (path.endsWith('/uv')) {
    return {
      code: 0,
      data: {
        records: [
          {
            updatedTimestamp: '2026-11-01T10:05:00Z',
            index: [{ hour: '2026-11-01T10:00:00Z', value: 6 }],
          },
        ],
      },
    };
  }
  if (path.endsWith('/psi')) {
    return airQualityReadings({
      psi_twenty_four_hourly: 42,
      pm10_twenty_four_hourly: 18,
      o3_eight_hour_max: 34,
      no2_one_hour_max: 22,
      so2_twenty_four_hourly: 4,
      co_eight_hour_max: '0.4',
    });
  }
  if (path.endsWith('/pm25')) {
    return airQualityReading('pm25_one_hourly', 9);
  }
  if (path.endsWith('/twenty-four-hr-forecast')) {
    return {
      code: 0,
      data: {
        records: [
          {
            updatedTimestamp: '2026-11-01T10:06:00Z',
            general: { temperature: { low: 24, high: 31 } },
            periods: [
              {
                timePeriod: { text: '12pm to 6pm' },
                regions: { central: { text: 'Fair' } },
              },
            ],
          },
        ],
      },
    };
  }
  if (path.endsWith('/4-day-weather-forecast')) {
    return {
      items: [
        {
          update_timestamp: '2026-11-01T10:07:00Z',
          forecasts: [
            {
              date: '2026-11-01',
              forecast: 'Thundery Showers',
              temperature: { low: 24, high: 31 },
            },
          ],
        },
      ],
    };
  }

  throw new Error(`Unexpected weather API path: ${path}`);
}

function stationReading(value: number, timestamp: string) {
  return {
    code: 0,
    data: {
      stations: [
        { id: 'NEAR', location: { latitude: 1.35, longitude: 103.85 } },
        { id: 'FAR', location: { latitude: 1.45, longitude: 103.95 } },
      ],
      readings: [
        {
          timestamp,
          data: [
            { stationId: 'NEAR', value },
            { stationId: 'FAR', value: value + 100 },
          ],
        },
      ],
    },
  };
}

function airQualityReading(readingType: string, value: number) {
  return airQualityReadings({ [readingType]: value });
}

function airQualityReadings(values: Record<string, number | string>) {
  return {
    code: 0,
    data: {
      regionMetadata: [
        { name: 'central', labelLocation: { latitude: 1.35735, longitude: 103.82 } },
      ],
      items: [
        {
          updatedTimestamp: '2026-11-01T10:05:00Z',
          readings: Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, { central: value }]),
          ),
        },
      ],
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SingaporeWeatherClient', () => {
  it('combines the condition forecast with readings for the dashboard cards', async () => {
    const fetchMock = installFetchMock();
    const client = new SingaporeWeatherClient();

    const snapshot = await client.getCurrentWeather(1.35, 103.85);

    expect(snapshot).toMatchObject({
      condition: 'Light Rain',
      area: 'Bishan',
      valid_period_text: '10am to 12pm',
      temperature_c: 29.5,
      humidity_percent: 81,
      rainfall_mm: 4.8,
      wind_speed_knots: 7.4,
      wind_direction_degrees: 180,
      uv_index: 6,
      psi_twenty_four_hourly: 42,
      pm25_one_hourly: 9,
      air_quality_region: 'central',
      forecast_low_c: 24,
      forecast_high_c: 31,
      forecast_periods: [{ label: '12pm to 6pm', forecast: 'Fair' }],
      daily_forecast: [
        {
          date: '2026-11-01',
          forecast: 'Thundery Showers',
          temperature_low_c: 24,
          temperature_high_c: 31,
        },
      ],
      observed_at: '2026-11-01T10:07:00Z',
    });

    const requestUrls = fetchMock.mock.calls.map(([url]) => new URL(url.toString()));
    const paths = requestUrls.map((url) => url.pathname);
    expect(paths).toContain('/v2/real-time/api/two-hr-forecast');
    expect(paths).toContain('/v2/real-time/api/rainfall');
    expect(paths).toContain('/v2/real-time/api/wind-speed');
    expect(paths).toContain('/v2/real-time/api/air-temperature');
    expect(paths).toContain('/v2/real-time/api/relative-humidity');
    expect(paths).toContain('/v2/real-time/api/wind-direction');
    expect(paths).toContain('/v2/real-time/api/uv');
    expect(paths).toContain('/v2/real-time/api/psi');
    expect(paths).toContain('/v2/real-time/api/pm25');
    expect(
      requestUrls.some(
        (url) =>
          url.origin === 'https://api-open.data.gov.sg' &&
          url.pathname === '/v2/real-time/api/twenty-four-hr-forecast',
      ),
    ).toBe(true);
    expect(
      requestUrls.some(
        (url) =>
          url.origin === 'https://api.data.gov.sg' &&
          url.pathname === '/v1/environment/4-day-weather-forecast',
      ),
    ).toBe(true);
  });

  it('keeps available readings when an individual provider endpoint fails', async () => {
    installFetchMock('/v2/real-time/api/air-temperature');
    const client = new SingaporeWeatherClient();

    const snapshot = await client.getCurrentWeather(1.35, 103.85);

    expect(snapshot.condition).toBe('Light Rain');
    expect(snapshot.temperature_c).toBeNull();
    expect(snapshot.rainfall_mm).toBe(4.8);
    expect(snapshot.wind_speed_knots).toBe(7.4);
  });

  it('keeps PSI when the separate PM2.5 endpoint fails', async () => {
    installFetchMock('/v2/real-time/api/pm25');
    const client = new SingaporeWeatherClient();

    const snapshot = await client.getCurrentWeather(1.35, 103.85);

    expect(snapshot.psi_twenty_four_hourly).toBe(42);
    expect(snapshot.pm25_one_hourly).toBeNull();
    expect(snapshot.air_quality_region).toBe('central');
  });

  it('adds the PSI pollutant breakdown for the region from the existing psi call', async () => {
    const fetchMock = installFetchMock();
    const client = new SingaporeWeatherClient();

    const snapshot = await client.getCurrentWeather(1.35, 103.85);

    expect(snapshot).toMatchObject({
      pm10_twenty_four_hourly: 18,
      o3_eight_hour_max: 34,
      no2_one_hour_max: 22,
      so2_twenty_four_hourly: 4,
      co_eight_hour_max: 0.4,
      air_quality_observed_at: '2026-11-01T10:05:00Z',
    });
    // Same 11 upstream calls as before the pollutant breakdown existed.
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it('leaves only the missing pollutant null', async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      const payload = url.pathname.endsWith('/psi')
        ? airQualityReadings({ psi_twenty_four_hourly: 42, pm10_twenty_four_hourly: 18 })
        : payloadFor(url.pathname);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const client = new SingaporeWeatherClient();

    const snapshot = await client.getCurrentWeather(1.35, 103.85);

    expect(snapshot.pm10_twenty_four_hourly).toBe(18);
    expect(snapshot.o3_eight_hour_max).toBeNull();
    expect(snapshot.co_eight_hour_max).toBeNull();
    expect(snapshot.psi_twenty_four_hourly).toBe(42);
  });

  it('sets every pollutant to null when the psi call fails, without touching PM2.5', async () => {
    const fetchMock = installFetchMock('/v2/real-time/api/psi');
    const client = new SingaporeWeatherClient();

    const snapshot = await client.getCurrentWeather(1.35, 103.85);

    expect(snapshot).toMatchObject({
      psi_twenty_four_hourly: null,
      pm10_twenty_four_hourly: null,
      o3_eight_hour_max: null,
      no2_one_hour_max: null,
      so2_twenty_four_hourly: null,
      co_eight_hour_max: null,
      air_quality_observed_at: null,
      pm25_one_hourly: 9,
    });
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it('retries the temperature reading once after a rate limit response', async () => {
    const fetchMock = installFetchMock(undefined, '/v2/real-time/api/air-temperature');
    const client = new SingaporeWeatherClient();

    const snapshot = await client.getCurrentWeather(1.35, 103.85);

    expect(snapshot.temperature_c).toBe(29.5);
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => new URL(url.toString()).pathname === '/v2/real-time/api/air-temperature',
      ),
    ).toHaveLength(2);
  });
});
