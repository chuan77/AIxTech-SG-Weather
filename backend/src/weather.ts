import { logger } from './logger.js';

import { ProviderRequester, WeatherProviderError } from './providerHttp.js';

export { WeatherProviderError };

interface ForecastPayload {
  code?: number;
  errorMsg?: string;
  data?: ForecastRoot;
  area_metadata?: AreaMetadata[];
  items?: ForecastItem[];
}

interface ForecastRoot {
  area_metadata?: AreaMetadata[];
  items?: ForecastItem[];
}

interface AreaMetadata {
  name?: string;
  label_location?: {
    latitude?: number | string;
    longitude?: number | string;
  };
}

interface ForecastItem {
  update_timestamp?: string;
  timestamp?: string;
  valid_period?: {
    text?: string;
  };
  forecasts?: Array<{
    area?: string;
    forecast?: string;
  }>;
}

interface ReadingPayload {
  code?: number;
  errorMsg?: string;
  data?: {
    stations?: WeatherStation[];
    readings?: WeatherReading[];
    readingType?: string;
    readingUnit?: string;
  };
}

interface WeatherStation {
  id?: string;
  name?: string;
  location?: {
    latitude?: number | string;
    longitude?: number | string;
  };
}

interface WeatherReading {
  timestamp?: string;
  data?: Array<{
    stationId?: string;
    value?: number | string;
  }>;
}

interface RegionMetadata {
  name?: string;
  labelLocation?: {
    latitude?: number | string;
    longitude?: number | string;
  };
}

interface UvPayload {
  code?: number;
  errorMsg?: string;
  data?: {
    records?: Array<{
      timestamp?: string;
      updatedTimestamp?: string;
      index?: Array<{
        hour?: string;
        value?: number | string;
      }>;
    }>;
  };
}

interface PsiPayload {
  code?: number;
  errorMsg?: string;
  data?: {
    regionMetadata?: RegionMetadata[];
    items?: Array<{
      timestamp?: string;
      updatedTimestamp?: string;
      readings?: Record<string, Record<string, number | string>>;
    }>;
  };
}

interface TwentyFourHourPayload {
  code?: number;
  errorMsg?: string;
  data?: {
    records?: Array<{
      timestamp?: string;
      updatedTimestamp?: string;
      general?: {
        temperature?: {
          low?: number | string;
          high?: number | string;
        };
      };
      periods?: Array<{
        timePeriod?: {
          start?: string;
          text?: string;
        };
        regions?: Record<string, { text?: string; code?: string }>;
      }>;
    }>;
  };
}

interface FourDayPayload {
  code?: number;
  errorMsg?: string;
  items?: Array<{
    update_timestamp?: string;
    timestamp?: string;
    forecasts?: Array<{
      date?: string;
      timestamp?: string;
      forecast?: string;
      temperature?: {
        low?: number | string;
        high?: number | string;
      };
    }>;
  }>;
}

export interface ForecastPeriod {
  label: string;
  forecast: string;
}

export interface DailyForecast {
  date: string;
  forecast: string;
  temperature_low_c: number | null;
  temperature_high_c: number | null;
}

export interface WeatherSnapshot {
  condition: string;
  observed_at: string;
  source: string;
  area: string | null;
  valid_period_text: string | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  rainfall_mm: number | null;
  wind_speed_knots: number | null;
  wind_direction_degrees: number | null;
  forecast_low_c: number | null;
  forecast_high_c: number | null;
  uv_index: number | null;
  psi_twenty_four_hourly: number | null;
  pm25_one_hourly: number | null;
  air_quality_region: string | null;
  pm10_twenty_four_hourly: number | null;
  o3_eight_hour_max: number | null;
  no2_one_hour_max: number | null;
  so2_twenty_four_hourly: number | null;
  co_eight_hour_max: number | null;
  air_quality_observed_at: string | null;
  forecast_periods: ForecastPeriod[];
  daily_forecast: DailyForecast[];
}

interface AirQuality {
  psi: number | null;
  pm25: number | null;
  /** PSI pollutant concentrations for the region, from the same `psi` response. */
  pollutants: {
    pm10: number | null;
    o3: number | null;
    no2: number | null;
    so2: number | null;
    co: number | null;
  };
  psiObservedAt: string | null;
  region: string | null;
  timestamp: string | null;
}

const EMPTY_AIR_QUALITY: AirQuality = {
  psi: null,
  pm25: null,
  pollutants: { pm10: null, o3: null, no2: null, so2: null, co: null },
  psiObservedAt: null,
  region: null,
  timestamp: null,
};

export class SingaporeWeatherClient {
  private readonly requester: ProviderRequester;

  constructor(
    private readonly options: {
      baseUrl?: string;
      apiKey?: string;
      timeoutMs?: number;
      userAgent?: string;
    } = {},
  ) {
    this.requester = new ProviderRequester(options);
  }

  async getCurrentWeather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
    const [
      forecastPayload,
      temperature,
      humidity,
      rainfall,
      windSpeed,
      windDirection,
      uv,
      airQuality,
      forecast24Hour,
      forecastFourDay,
    ] = await Promise.all([
      this.fetchOptional('two-hr-forecast', () => this.fetchLatestForecastPayload(), null),
      this.fetchOptional(
        'air-temperature',
        () => this.fetchNearestReading('air-temperature', latitude, longitude),
        { value: null, timestamp: null },
      ),
      this.fetchOptional(
        'relative-humidity',
        () => this.fetchNearestReading('relative-humidity', latitude, longitude),
        { value: null, timestamp: null },
      ),
      this.fetchOptional(
        'rainfall',
        () => this.fetchNearestReading('rainfall', latitude, longitude),
        { value: null, timestamp: null },
      ),
      this.fetchOptional(
        'wind-speed',
        () => this.fetchNearestReading('wind-speed', latitude, longitude),
        { value: null, timestamp: null },
      ),
      this.fetchOptional(
        'wind-direction',
        () => this.fetchNearestReading('wind-direction', latitude, longitude),
        { value: null, timestamp: null },
      ),
      this.fetchOptional('uv', () => this.fetchUvIndex(), { value: null, timestamp: null }),
      this.fetchOptional(
        'air-quality',
        () => this.fetchAirQuality(latitude, longitude),
        EMPTY_AIR_QUALITY,
      ),
      this.fetchOptional(
        'twenty-four-hr-forecast',
        () => this.fetchTwentyFourHourForecast(latitude, longitude),
        { low: null, high: null, periods: [], timestamp: null },
      ),
      this.fetchOptional('four-day-weather-forecast', () => this.fetchFourDayForecast(), {
        days: [],
        timestamp: null,
      }),
    ]);

    let snapshot = this.emptyForecastSnapshot();
    if (forecastPayload) {
      try {
        snapshot = this.snapshotFromPayload(forecastPayload, latitude, longitude);
      } catch (error) {
        logger.warn({ err: error, endpoint: 'two-hr-forecast' }, 'weather data source unavailable');
      }
    }

    snapshot.observed_at =
      latestTimestamp([
        snapshot.observed_at,
        temperature.timestamp,
        humidity.timestamp,
        rainfall.timestamp,
        windSpeed.timestamp,
        windDirection.timestamp,
        uv.timestamp,
        airQuality.timestamp,
        forecast24Hour.timestamp,
        forecastFourDay.timestamp,
      ]) ?? snapshot.observed_at;
    snapshot.temperature_c = temperature.value;
    snapshot.humidity_percent = humidity.value;
    snapshot.rainfall_mm = rainfall.value;
    snapshot.wind_speed_knots = windSpeed.value;
    snapshot.wind_direction_degrees = windDirection.value;
    snapshot.uv_index = uv.value;
    snapshot.psi_twenty_four_hourly = airQuality.psi;
    snapshot.pm25_one_hourly = airQuality.pm25;
    snapshot.air_quality_region = airQuality.region;
    snapshot.pm10_twenty_four_hourly = airQuality.pollutants.pm10;
    snapshot.o3_eight_hour_max = airQuality.pollutants.o3;
    snapshot.no2_one_hour_max = airQuality.pollutants.no2;
    snapshot.so2_twenty_four_hourly = airQuality.pollutants.so2;
    snapshot.co_eight_hour_max = airQuality.pollutants.co;
    snapshot.air_quality_observed_at = airQuality.psiObservedAt;
    snapshot.forecast_low_c = forecast24Hour.low;
    snapshot.forecast_high_c = forecast24Hour.high;
    snapshot.forecast_periods = forecast24Hour.periods;
    snapshot.daily_forecast = forecastFourDay.days;

    return snapshot;
  }

  async fetchLatestForecastPayload(): Promise<ForecastPayload> {
    return this.fetchJson(`${this.apiBaseUrl()}/v2/real-time/api/two-hr-forecast`);
  }

  async fetchNearestReading(
    endpoint:
      | 'air-temperature'
      | 'relative-humidity'
      | 'rainfall'
      | 'wind-speed'
      | 'wind-direction',
    latitude: number,
    longitude: number,
  ): Promise<{ value: number | null; timestamp: string | null }> {
    const payload = await this.fetchReadingPayload(endpoint);
    if (payload.code !== undefined && payload.code !== 0) {
      throw new WeatherProviderError(
        payload.errorMsg ?? `Weather provider returned an error for ${endpoint}`,
      );
    }

    const stations = payload.data?.stations ?? [];
    const latestReading = payload.data?.readings?.[0];
    const values = latestReading?.data ?? [];
    if (stations.length === 0 || values.length === 0) {
      return { value: null, timestamp: latestReading?.timestamp ?? null };
    }

    const valueByStation = new Map(
      values
        .map((entry) => [entry.stationId, Number(entry.value)] as const)
        .filter((entry): entry is [string, number] => Boolean(entry[0]) && !Number.isNaN(entry[1])),
    );
    const station = nearestStation(stations, latitude, longitude, valueByStation);
    return {
      value: station ? (valueByStation.get(station.id) ?? null) : null,
      timestamp: latestReading?.timestamp ?? null,
    };
  }

  async fetchReadingPayload(endpoint: string): Promise<ReadingPayload> {
    return this.fetchJson(`${this.apiBaseUrl()}/v2/real-time/api/${endpoint}`);
  }

  async fetchUvIndex(): Promise<{ value: number | null; timestamp: string | null }> {
    const payload = await this.fetchJson<UvPayload>(`${this.apiBaseUrl()}/v2/real-time/api/uv`);
    if (payload.code !== undefined && payload.code !== 0) {
      throw new WeatherProviderError(
        payload.errorMsg ?? 'Weather provider returned an error for uv',
      );
    }

    const record = payload.data?.records?.[0];
    const latest = record?.index?.[0];
    return {
      value: numberOrNull(latest?.value),
      timestamp: record?.updatedTimestamp ?? latest?.hour ?? record?.timestamp ?? null,
    };
  }

  async fetchAirQuality(
    latitude: number,
    longitude: number,
  ): Promise<AirQuality> {
    const [psiPayload, pm25Payload] = await Promise.all([
      this.fetchOptional('psi', () => this.fetchAirQualityPayload('psi'), null),
      this.fetchOptional('pm25', () => this.fetchAirQualityPayload('pm25'), null),
    ]);

    const regionMetadata =
      psiPayload?.data?.regionMetadata ?? pm25Payload?.data?.regionMetadata ?? [];
    const region = nearestRegionName(regionMetadata, latitude, longitude);
    const psiItem = psiPayload?.data?.items?.[0];
    const pm25Item = pm25Payload?.data?.items?.[0];
    const psiReadings = psiItem?.readings;
    return {
      psi: valueForRegion(psiReadings?.psi_twenty_four_hourly, region),
      pm25: valueForRegion(pm25Item?.readings?.pm25_one_hourly, region),
      pollutants: {
        pm10: valueForRegion(psiReadings?.pm10_twenty_four_hourly, region),
        o3: valueForRegion(psiReadings?.o3_eight_hour_max, region),
        no2: valueForRegion(psiReadings?.no2_one_hour_max, region),
        so2: valueForRegion(psiReadings?.so2_twenty_four_hourly, region),
        co: valueForRegion(psiReadings?.co_eight_hour_max, region),
      },
      psiObservedAt: psiItem ? (psiItem.updatedTimestamp ?? psiItem.timestamp ?? null) : null,
      region,
      timestamp: latestTimestamp([
        psiItem?.updatedTimestamp ?? psiItem?.timestamp ?? null,
        pm25Item?.updatedTimestamp ?? pm25Item?.timestamp ?? null,
      ]),
    };
  }

  private async fetchAirQualityPayload(endpoint: 'psi' | 'pm25'): Promise<PsiPayload> {
    const payload = await this.fetchJson<PsiPayload>(
      `${this.apiBaseUrl()}/v2/real-time/api/${endpoint}`,
    );
    if (payload.code !== undefined && payload.code !== 0) {
      throw new WeatherProviderError(
        payload.errorMsg ?? `Weather provider returned an error for ${endpoint}`,
      );
    }
    return payload;
  }

  async fetchTwentyFourHourForecast(
    latitude: number,
    longitude: number,
  ): Promise<{
    low: number | null;
    high: number | null;
    periods: ForecastPeriod[];
    timestamp: string | null;
  }> {
    const payload = await this.fetchJson<TwentyFourHourPayload>(
      `${this.apiBaseUrl()}/v2/real-time/api/twenty-four-hr-forecast`,
    );
    if (payload.code !== undefined && payload.code !== 0) {
      throw new WeatherProviderError(
        payload.errorMsg ?? 'Weather provider returned a 24-hour forecast error',
      );
    }

    const record = payload.data?.records?.[0];
    const region = nearestRegionName(defaultRegions(), latitude, longitude) ?? 'central';
    return {
      low: numberOrNull(record?.general?.temperature?.low),
      high: numberOrNull(record?.general?.temperature?.high),
      periods: (record?.periods ?? [])
        .map((period) => ({
          label: period.timePeriod?.text ?? '',
          forecast: period.regions?.[region]?.text ?? period.regions?.central?.text ?? '',
        }))
        .filter((period) => period.label && period.forecast),
      timestamp: record?.updatedTimestamp ?? record?.timestamp ?? null,
    };
  }

  async fetchFourDayForecast(): Promise<{ days: DailyForecast[]; timestamp: string | null }> {
    const payload = await this.fetchJson<FourDayPayload>(
      `${this.legacyApiBaseUrl()}/v1/environment/4-day-weather-forecast`,
    );
    if (payload.code !== undefined && payload.code !== 0) {
      throw new WeatherProviderError(
        payload.errorMsg ?? 'Weather provider returned a 4-day forecast error',
      );
    }
    const item = payload.items?.[0];
    return {
      days: (item?.forecasts ?? [])
        .map((forecast) => ({
          date: forecast.date ?? forecast.timestamp ?? '',
          forecast: forecast.forecast ?? '',
          temperature_low_c: numberOrNull(forecast.temperature?.low),
          temperature_high_c: numberOrNull(forecast.temperature?.high),
        }))
        .filter((forecast) => forecast.date && forecast.forecast),
      timestamp: item?.update_timestamp ?? item?.timestamp ?? null,
    };
  }

  private apiBaseUrl(): string {
    return this.options.baseUrl ?? 'https://api-open.data.gov.sg';
  }

  private async fetchOptional<T>(
    endpoint: string,
    fetchData: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await fetchData();
    } catch (error) {
      logger.warn({ err: error, endpoint }, 'weather data source unavailable');
      return fallback;
    }
  }

  private legacyApiBaseUrl(): string {
    return 'https://api.data.gov.sg';
  }

  private async fetchJson<T>(url: string): Promise<T> {
    return this.requester.getJson<T>(url);
  }

  snapshotFromPayload(
    payload: ForecastPayload,
    latitude: number,
    longitude: number,
  ): WeatherSnapshot {
    if (payload.code !== undefined && payload.code !== 0) {
      throw new WeatherProviderError(payload.errorMsg ?? 'Weather provider returned an error');
    }

    const root = payload.data ?? payload;
    const areaMetadata = root.area_metadata ?? [];
    const items = root.items ?? [];
    if (items.length === 0) {
      throw new WeatherProviderError('Forecast response has no items');
    }

    const latestItem = items[0];
    const forecasts = latestItem.forecasts ?? [];
    if (forecasts.length === 0) {
      throw new WeatherProviderError('Forecast item has no area forecasts');
    }

    const forecastByArea = new Map(
      forecasts
        .filter((entry) => entry.area && entry.forecast)
        .map((entry) => [entry.area as string, entry.forecast as string]),
    );

    const nearestArea = nearestAreaName(areaMetadata, latitude, longitude);
    if (nearestArea && forecastByArea.has(nearestArea)) {
      return {
        condition: forecastByArea.get(nearestArea) as string,
        observed_at: latestItem.update_timestamp ?? latestItem.timestamp ?? '',
        source: 'api-open.data.gov.sg',
        area: nearestArea,
        valid_period_text: latestItem.valid_period?.text ?? null,
        temperature_c: null,
        humidity_percent: null,
        rainfall_mm: null,
        wind_speed_knots: null,
        wind_direction_degrees: null,
        forecast_low_c: null,
        forecast_high_c: null,
        uv_index: null,
        psi_twenty_four_hourly: null,
        pm25_one_hourly: null,
        air_quality_region: null,
        pm10_twenty_four_hourly: null,
        o3_eight_hour_max: null,
        no2_one_hour_max: null,
        so2_twenty_four_hourly: null,
        co_eight_hour_max: null,
        air_quality_observed_at: null,
        forecast_periods: [],
        daily_forecast: [],
      };
    }

    const fallback = forecasts[0];
    return {
      condition: fallback.forecast ?? 'Unknown',
      observed_at: latestItem.update_timestamp ?? latestItem.timestamp ?? '',
      source: 'api-open.data.gov.sg',
      area: fallback.area ?? null,
      valid_period_text: latestItem.valid_period?.text ?? null,
      temperature_c: null,
      humidity_percent: null,
      rainfall_mm: null,
      wind_speed_knots: null,
      wind_direction_degrees: null,
      forecast_low_c: null,
      forecast_high_c: null,
      uv_index: null,
      psi_twenty_four_hourly: null,
      pm25_one_hourly: null,
      air_quality_region: null,
      pm10_twenty_four_hourly: null,
      o3_eight_hour_max: null,
      no2_one_hour_max: null,
      so2_twenty_four_hourly: null,
      co_eight_hour_max: null,
      air_quality_observed_at: null,
      forecast_periods: [],
      daily_forecast: [],
    };
  }

  private emptyForecastSnapshot(): WeatherSnapshot {
    return {
      condition: 'Unavailable',
      observed_at: '',
      source: 'api-open.data.gov.sg',
      area: null,
      valid_period_text: null,
      temperature_c: null,
      humidity_percent: null,
      rainfall_mm: null,
      wind_speed_knots: null,
      wind_direction_degrees: null,
      forecast_low_c: null,
      forecast_high_c: null,
      uv_index: null,
      psi_twenty_four_hourly: null,
      pm25_one_hourly: null,
      air_quality_region: null,
      pm10_twenty_four_hourly: null,
      o3_eight_hour_max: null,
      no2_one_hour_max: null,
      so2_twenty_four_hourly: null,
      co_eight_hour_max: null,
      air_quality_observed_at: null,
      forecast_periods: [],
      daily_forecast: [],
    };
  }
}

function nearestAreaName(
  areaMetadata: AreaMetadata[],
  latitude: number,
  longitude: number,
): string | null {
  let nearest: { name: string; distance: number } | null = null;

  for (const area of areaMetadata) {
    const lat = Number(area.label_location?.latitude);
    const lon = Number(area.label_location?.longitude);
    if (!area.name || Number.isNaN(lat) || Number.isNaN(lon)) continue;

    const distance = (lat - latitude) ** 2 + (lon - longitude) ** 2;
    if (!nearest || distance < nearest.distance) {
      nearest = { name: area.name, distance };
    }
  }

  return nearest?.name ?? null;
}

function nearestRegionName(
  regions: RegionMetadata[],
  latitude: number,
  longitude: number,
): string | null {
  let nearest: { name: string; distance: number } | null = null;

  for (const region of regions) {
    const lat = Number(region.labelLocation?.latitude);
    const lon = Number(region.labelLocation?.longitude);
    if (!region.name || Number.isNaN(lat) || Number.isNaN(lon)) continue;

    const distance = (lat - latitude) ** 2 + (lon - longitude) ** 2;
    if (!nearest || distance < nearest.distance) {
      nearest = { name: region.name, distance };
    }
  }

  return nearest?.name ?? null;
}

function nearestStation(
  stations: WeatherStation[],
  latitude: number,
  longitude: number,
  valueByStation: Map<string, number>,
): { id: string; distance: number } | null {
  let nearest: { id: string; distance: number } | null = null;

  for (const station of stations) {
    const lat = Number(station.location?.latitude);
    const lon = Number(station.location?.longitude);
    if (!station.id || Number.isNaN(lat) || Number.isNaN(lon) || !valueByStation.has(station.id))
      continue;

    const distance = (lat - latitude) ** 2 + (lon - longitude) ** 2;
    if (!nearest || distance < nearest.distance) {
      nearest = { id: station.id, distance };
    }
  }

  return nearest;
}

function latestTimestamp(timestamps: Array<string | null>): string | null {
  return (
    timestamps
      .filter((timestamp): timestamp is string => Boolean(timestamp))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
  );
}

function numberOrNull(value: number | string | undefined): number | null {
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function valueForRegion(
  values: Record<string, number | string> | undefined,
  region: string | null,
): number | null {
  if (!values || !region) return null;
  return numberOrNull(values[region]);
}

function defaultRegions(): RegionMetadata[] {
  return [
    { name: 'west', labelLocation: { latitude: 1.35735, longitude: 103.7 } },
    { name: 'north', labelLocation: { latitude: 1.41803, longitude: 103.82 } },
    { name: 'central', labelLocation: { latitude: 1.35735, longitude: 103.82 } },
    { name: 'south', labelLocation: { latitude: 1.29587, longitude: 103.82 } },
    { name: 'east', labelLocation: { latitude: 1.35735, longitude: 103.94 } },
  ];
}
