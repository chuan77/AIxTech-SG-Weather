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

export interface CreateLocationOptions {
  source?: 'geolocation';
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

export interface LocationError {
  id: number;
  message: string;
}

export interface PendingDelete {
  id: number;
  name: string;
  status: 'pending' | 'failed';
  message?: string;
}

/** A failed refresh in a bulk run, named so the result can say which places missed out. */
export interface BulkRefreshFailure extends LocationError {
  name: string;
}

/** One "Refresh all" run: refreshes out-of-date places one at a time, stoppable between places. */
export interface BulkRefresh {
  status: 'running' | 'done' | 'stopped';
  total: number;
  /** Places attempted so far, successes and failures alike. */
  done: number;
  failed: BulkRefreshFailure[];
}

export interface StoreValue {
  locations: Location[];
  selectedId: number | null;
  isAdding: boolean;
  isLoading: boolean;
  refreshingId: number | null;
  error: unknown;
  loadError: string | null;
  /** The last failed refresh, tied to the location it was for. */
  refreshError: LocationError | null;
  /** A delete waiting out its undo window, or one that failed and was rolled back. */
  pendingDelete: PendingDelete | null;
  select: (id: number | null) => void;
  setAdding: (isAdding: boolean) => void;
  /** `source: 'geolocation'` keeps the position out of interaction logs (specs/003 FR-009). */
  create: (payload: CreateLocationPayload, options?: CreateLocationOptions) => Promise<void>;
  /** Hides the location at once and deletes it on the server after the undo window. */
  remove: (id: number) => void;
  undoDelete: () => void;
  dismissDelete: () => void;
  /** Pauses the undo window while the viewer is reading or focused on the toast. */
  holdDelete: (held: boolean) => void;
  refresh: (id: number) => Promise<void>;
  /** The current or last "Refresh all" run; null when there is nothing to show. */
  bulkRefresh: BulkRefresh | null;
  /** Refreshes each id in turn. Ignored while another bulk run is going. */
  refreshAll: (ids: number[]) => Promise<void>;
  /** Stops a bulk run after the place being refreshed now. */
  stopRefreshAll: () => void;
  clearBulkRefresh: () => void;
  reload: () => Promise<void>;
  lightning: LightningState;
}

export interface ProviderProps {
  children: ReactNode;
}
