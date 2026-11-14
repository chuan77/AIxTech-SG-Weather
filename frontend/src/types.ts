import type { ReactNode } from 'react';

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
  condition: string | null;
  observed_at: string | null;
  source: string | null;
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
  wbgt_c: number | null;
  heat_stress_level: string | null;
  wbgt_station_name: string | null;
  wbgt_station_distance_km: number | null;
  wbgt_observed_at: string | null;
  forecast_periods: ForecastPeriod[];
  daily_forecast: DailyForecast[];
}

export interface Location {
  id: number;
  latitude: number;
  longitude: number;
  created_at: string;
  weather: WeatherSnapshot;
}

export interface CreateLocationPayload {
  latitude: number;
  longitude: number;
}

export interface LightningStrike {
  id: string;
  latitude: number;
  longitude: number;
  occurred_at: string;
  type: string;
  label: string;
}

export interface LightningObservation {
  strikes: LightningStrike[];
  window_minutes: number;
  fetched_at: string;
  provider_updated_at: string | null;
  stale: boolean;
}

export type LightningStatus = 'idle' | 'loading' | 'ok' | 'empty' | 'unavailable';

export interface LightningState {
  enabled: boolean;
  status: LightningStatus;
  observation: LightningObservation | null;
  setEnabled: (enabled: boolean) => void;
  /** Loads the last hour of strikes; a no-op while the data is under 2 minutes old. */
  refresh: () => Promise<void>;
}

export interface StoreValue {
  locations: Location[];
  selectedId: number | null;
  isAdding: boolean;
  isLoading: boolean;
  refreshingId: number | null;
  error: unknown;
  loadError: string | null;
  select: (id: number | null) => void;
  setAdding: (isAdding: boolean) => void;
  create: (payload: CreateLocationPayload) => Promise<void>;
  remove: (id: number) => Promise<void>;
  refresh: (id: number) => Promise<void>;
  reload: () => Promise<void>;
  lightning: LightningState;
}

export interface ProviderProps {
  children: ReactNode;
}
