import { CloudIcon, DropletIcon, SunIcon, ThermometerIcon, TrendIcon, WindIcon } from './icons';
import { useMemo, useState, type ReactNode } from 'react';
import type { Location, WeatherSnapshot } from '../types';
import { feelsLike, missingInputsText } from './feelsLike';
import { heatStressView, type HeatStressTone } from './heatStress';
import { useNow } from './map/useNow';
import { formatSgtTime, singaporeDate, sunTimes } from './sunTimes';

interface WeatherProps {
  weather: WeatherSnapshot;
}

interface TileShellProps {
  icon: ReactNode;
  title: string;
  className?: string;
  children: ReactNode;
}

export function TileShell({ icon, title, className = '', children }: TileShellProps) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-card border border-white/15 bg-white/[0.08] p-4 backdrop-blur-xl ${className}`}
    >
      <header className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
        {icon}
        <span>{title}</span>
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function formatNumber(value: number | null | undefined, digits = 0): string {
  return isFiniteNumber(value) ? value.toFixed(digits) : '--';
}

function formatTemperature(value: number | null | undefined): number | string {
  return isFiniteNumber(value) ? Math.round(value) : '--';
}

function knotsToKmh(value: number | null | undefined): number | null {
  return isFiniteNumber(value) ? value * 1.852 : null;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

interface ScaleBarProps {
  value: number | null | undefined;
  max: number;
  gradientClass: string;
}

function ScaleBar({ value, max, gradientClass }: ScaleBarProps) {
  const hasValue = isFiniteNumber(value);
  const pct = hasValue ? Math.max(0, Math.min(100, (value / max) * 100)) : null;
  return (
    <div className="relative mt-3 h-1.5">
      <div className={`h-1.5 rounded-full opacity-80 ${gradientClass}`} />
      {hasValue && (
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow shadow-black/40"
          style={{ left: `${pct}%` }}
        />
      )}
    </div>
  );
}

function airQualityLabel(psi: number | null | undefined): string {
  if (!isFiniteNumber(psi)) return 'Unavailable';
  if (psi <= 50) return 'Good';
  if (psi <= 100) return 'Moderate';
  if (psi <= 200) return 'Unhealthy';
  if (psi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// Display units for NEA PSI pollutant concentrations (research R7; CO pending confirmation).
const POLLUTANTS = [
  { key: 'pm10_twenty_four_hourly', label: 'PM10', unit: 'µg/m³' },
  { key: 'o3_eight_hour_max', label: 'O₃', unit: 'µg/m³' },
  { key: 'no2_one_hour_max', label: 'NO₂', unit: 'µg/m³' },
  { key: 'so2_twenty_four_hourly', label: 'SO₂', unit: 'µg/m³' },
  { key: 'co_eight_hour_max', label: 'CO', unit: 'mg/m³' },
] as const;

// Show the provider's own precision (NEA often reports whole numbers, e.g. CO as 0).
const pollutantFormat = new Intl.NumberFormat('en-SG', { maximumFractionDigits: 2 });

export function AirQualityTile({ weather }: WeatherProps) {
  const psi = formatNumber(weather?.psi_twenty_four_hourly);
  const pm25 = formatNumber(weather?.pm25_one_hourly);
  const [open, setOpen] = useState(false);
  const readingTime = weather?.air_quality_observed_at
    ? new Date(weather.air_quality_observed_at)
    : null;

  return (
    <TileShell
      icon={<CloudIcon className="h-3.5 w-3.5" />}
      title="Air Quality"
      // Open detail takes the full row on large screens so it does not stretch neighbouring tiles.
      className={open ? 'col-span-2 lg:col-span-4' : 'col-span-2'}
    >
      <div className="text-4xl font-light leading-none text-white/95">{psi}</div>
      <div className="mt-1 text-base text-white/85">
        {airQualityLabel(weather?.psi_twenty_four_hourly)}
      </div>
      <ScaleBar
        value={weather?.psi_twenty_four_hourly}
        max={300}
        gradientClass="bg-gradient-to-r from-emerald-400 via-yellow-300 via-orange-400 to-red-500"
      />
      <p className="mt-3 text-xs leading-snug text-white/70">
        PM2.5 {pm25} ug/m3 · {weather?.air_quality_region ?? 'nearest'} region
      </p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="air-quality-detail"
        onClick={() => setOpen((value) => !value)}
        className="mt-3 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/85 hover:bg-white/[0.12]"
      >
        {open ? 'Hide details' : 'Details'}
      </button>
      {open && (
        <div id="air-quality-detail" className="mt-3 border-t border-white/10 pt-3">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
            {POLLUTANTS.map(({ key, label, unit }) => {
              const value = weather?.[key];
              return (
                <li key={key} className="flex flex-col">
                  <span className="text-xs text-white/60">{label}</span>
                  {isFiniteNumber(value) ? (
                    <span className="tabular-nums text-white/90">
                      {pollutantFormat.format(value)} <span className="text-xs text-white/60">{unit}</span>
                    </span>
                  ) : (
                    <span className="text-white/60">No reading</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-white/60">
            {readingTime && !Number.isNaN(readingTime.getTime())
              ? `Reading at ${formatSgtTime(readingTime)} SGT`
              : 'Reading time unavailable'}
          </p>
        </div>
      )}
    </TileShell>
  );
}

export function ConditionTile({ weather }: WeatherProps) {
  return (
    <TileShell
      icon={<CloudIcon className="h-3.5 w-3.5" />}
      title="Conditions"
      className="col-span-2"
    >
      <div className="text-2xl font-light leading-tight text-white/95">
        {weather.condition || 'Conditions unavailable'}
      </div>
      <p className="mt-1 text-sm text-white/75">{weather.area || 'Forecast area unavailable'}</p>
      {weather.valid_period_text && (
        <p className="mt-3 text-xs leading-snug text-white/65">{weather.valid_period_text}</p>
      )}
    </TileShell>
  );
}

export function WindTile({ weather }: WeatherProps) {
  const speedKmh = knotsToKmh(weather?.wind_speed_knots);
  const speed = formatNumber(speedKmh);
  const direction = formatNumber(weather?.wind_direction_degrees);
  const hasDirection = isFiniteNumber(weather?.wind_direction_degrees);

  return (
    <TileShell icon={<WindIcon />} title="Wind" className="col-span-2">
      <div className="grid grid-cols-[1fr_auto] items-center gap-4">
        <ul className="space-y-2 text-sm">
          <li
            className={`flex justify-between ${hasDirection ? 'border-b border-white/10 pb-2' : ''}`}
          >
            <span className="text-white/75">Wind</span>
            <span className="tabular-nums text-white/90">{speed} km/h</span>
          </li>
          {hasDirection && (
            <li className="flex justify-between">
              <span className="text-white/75">Direction</span>
              <span className="tabular-nums text-white/90">{direction}&deg;</span>
            </li>
          )}
        </ul>
        <Compass speed={speed} direction={weather?.wind_direction_degrees} />
      </div>
    </TileShell>
  );
}

interface CompassProps {
  speed: string;
  direction: number | null | undefined;
}

function Compass({ speed, direction }: CompassProps) {
  const hasDirection = isFiniteNumber(direction);

  return (
    <div className="relative h-20 w-20 rounded-full border border-white/20 bg-white/[0.04]">
      <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[10px] text-white/55">N</span>
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-white/55">
        E
      </span>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-white/55">
        S
      </span>
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-white/55">
        W
      </span>
      {hasDirection && (
        <div
          className="absolute left-1/2 top-2 h-7 w-px origin-[50%_30px] -translate-x-1/2 rounded-full bg-white/70"
          style={{ transform: `translateX(-50%) rotate(${direction}deg)` }}
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-light leading-none text-white/90">{speed}</span>
        <span className="text-[10px] text-white/55">km/h</span>
      </div>
    </div>
  );
}

function uvLabel(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return 'Unavailable';
  if (value <= 2) return 'Low';
  if (value <= 5) return 'Moderate';
  if (value <= 7) return 'High';
  if (value <= 10) return 'Very High';
  return 'Extreme';
}

export function UVTile({ weather }: WeatherProps) {
  return (
    <TileShell icon={<SunIcon className="h-3.5 w-3.5" />} title="UV Index">
      <div className="text-4xl font-light leading-none text-white/95">
        {formatNumber(weather?.uv_index)}
      </div>
      <div className="mt-1 text-base text-white/85">{uvLabel(weather?.uv_index)}</div>
      <ScaleBar
        value={weather?.uv_index}
        max={11}
        gradientClass="bg-gradient-to-r from-emerald-400 via-yellow-300 via-orange-400 to-fuchsia-500"
      />
      <p className="mt-3 text-xs leading-snug text-white/70">Latest nationwide UVI reading.</p>
    </TileShell>
  );
}

export function TemperatureTile({ weather }: WeatherProps) {
  return (
    <TileShell icon={<ThermometerIcon />} title="Temperature">
      <div className="text-4xl font-light leading-none tabular-nums text-white/95">
        {formatTemperature(weather?.temperature_c)}&deg;
      </div>
      <p className="mt-3 text-xs leading-snug text-white/70">
        Nearest realtime temperature station.
      </p>
    </TileShell>
  );
}

export function PrecipitationTile({ weather }: WeatherProps) {
  return (
    <TileShell icon={<DropletIcon />} title="Rainfall">
      <div className="text-4xl font-light leading-none tabular-nums text-white/95">
        {formatNumber(weather?.rainfall_mm, 1)} mm
      </div>
      <div className="mt-1 text-sm text-white/85">Latest 5-minute total</div>
      <p className="mt-3 text-xs leading-snug text-white/70">Nearest realtime rainfall station.</p>
    </TileShell>
  );
}

export function HumidityTile({ weather }: WeatherProps) {
  return (
    <TileShell icon={<DropletIcon />} title="Humidity">
      <div className="text-4xl font-light leading-none tabular-nums text-white/95">
        {formatNumber(weather?.humidity_percent)}%
      </div>
      <p className="mt-3 text-xs leading-snug text-white/70">Nearest realtime humidity station.</p>
    </TileShell>
  );
}

export function AveragesTile({ weather, className = '' }: WeatherProps & { className?: string }) {
  return (
    <TileShell icon={<TrendIcon />} title="Forecast High" className={className}>
      <div className="text-4xl font-light leading-none tabular-nums text-white/95">
        {formatTemperature(weather?.forecast_high_c)}&deg;
      </div>
      <div className="mt-1 text-xs leading-snug text-white/75">
        Today&apos;s high from the 24-hour forecast.
      </div>
      <ul className="mt-3 space-y-1 text-xs text-white/70">
        <li className="flex justify-between border-t border-white/10 pt-1.5">
          <span>Today</span>
          <span className="tabular-nums">H:{formatTemperature(weather?.forecast_high_c)}&deg;</span>
        </li>
      </ul>
    </TileShell>
  );
}

export function FeelsLikeTile({ weather }: WeatherProps) {
  const result = feelsLike(weather);

  return (
    <TileShell icon={<ThermometerIcon />} title="Feels Like" className="col-span-2">
      {result.kind === 'no-reading' ? (
        <>
          <div
            className="text-2xl font-light leading-tight text-white/85"
            title={missingInputsText(result.missing)}
          >
            No reading
          </div>
          <p className="mt-3 text-xs leading-snug text-white/65">
            {missingInputsText(result.missing)}.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-light leading-none tabular-nums text-white/95">
              {result.value.toFixed(1)}&deg;
            </span>
            {result.approx && (
              <span className="text-xs text-white/60" title="No wind reading; calculated for still air">
                approx.
              </span>
            )}
          </div>
          <div className="mt-1 text-base text-white/85">{result.band.label}</div>
          <p className="mt-3 text-xs leading-snug text-white/70">
            {result.band.advice}
            {result.umbrella && <span className="text-white/90"> Carry an umbrella.</span>}
          </p>
        </>
      )}
    </TileShell>
  );
}

const HEAT_STRESS_TONE_CLASS: Record<HeatStressTone, string> = {
  low: 'text-white/80',
  moderate: 'rounded-full bg-white/10 px-2 font-semibold text-white/90',
  high: 'rounded-full bg-white/20 px-2 font-bold text-white ring-1 ring-white/40',
  unknown: 'text-white/80',
};

export function HeatStressTile({ weather }: WeatherProps) {
  const view = heatStressView(weather);

  return (
    <TileShell icon={<ThermometerIcon />} title="Heat Stress">
      {view.kind === 'no-reading' && (
        <div className="text-2xl font-light leading-tight text-white/85">No reading</div>
      )}
      {view.kind === 'no-nearby-station' && (
        <>
          <div className="text-2xl font-light leading-tight text-white/85" title={view.tooltip}>
            No nearby station
          </div>
          <p className="mt-3 text-xs leading-snug text-white/65">{view.tooltip}.</p>
        </>
      )}
      {view.kind === 'reading' && (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-4xl font-light leading-none tabular-nums text-white/95">
              {view.value}&deg;
            </span>
            {view.level && (
              <span className={`text-sm ${HEAT_STRESS_TONE_CLASS[view.tone]}`}>{view.level}</span>
            )}
          </div>
          <ScaleBar
            value={(weather.wbgt_c as number) - 25}
            max={10}
            gradientClass="bg-gradient-to-r from-emerald-400 via-yellow-300 via-orange-400 to-red-500"
          />
          {view.guidance && (
            <p className="mt-3 text-xs leading-snug text-white/70">{view.guidance}</p>
          )}
          <p className="mt-3 flex flex-wrap gap-x-1 text-[11px] leading-snug text-white/50">
            <span>WBGT at {view.stationName ?? 'nearest station'}</span>
            <span>· {view.distanceKm} km</span>
            {view.observedAt && <span>· {view.observedAt}</span>}
          </p>
        </>
      )}
    </TileShell>
  );
}

interface SunTileProps {
  latitude: number;
  longitude: number;
  className?: string;
}

export function SunTile({ latitude, longitude, className = '' }: SunTileProps) {
  // A 60-second tick moves the times to the new day after midnight SGT without a refresh.
  const now = useNow(60_000);
  const today = singaporeDate(new Date(now));
  const times = useMemo(() => sunTimes(latitude, longitude, today), [latitude, longitude, today]);

  return (
    <TileShell icon={<SunIcon className="h-3.5 w-3.5" />} title="Sun" className={className}>
      <ul className="space-y-2 text-sm">
        <li className="flex justify-between border-b border-white/10 pb-2">
          <span className="text-white/75">Sunrise</span>
          <span className="tabular-nums text-white/90">{formatSgtTime(times.sunrise)}</span>
        </li>
        <li className="flex justify-between">
          <span className="text-white/75">Sunset</span>
          <span className="tabular-nums text-white/90">{formatSgtTime(times.sunset)}</span>
        </li>
      </ul>
      <p className="mt-3 text-xs leading-snug text-white/70">Today, Singapore time.</p>
    </TileShell>
  );
}

interface TileGridProps {
  location: Location;
}

export function TileGrid({ location }: TileGridProps) {
  const weather = location.weather;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <ConditionTile weather={weather} />
      <FeelsLikeTile weather={weather} />
      <HeatStressTile weather={weather} />
      <AirQualityTile weather={weather} />
      <WindTile weather={weather} />
      <UVTile weather={weather} />
      <TemperatureTile weather={weather} />
      <PrecipitationTile weather={weather} />
      <HumidityTile weather={weather} />
      <AveragesTile weather={weather} className="lg:col-span-2" />
      <SunTile
        latitude={location.latitude}
        longitude={location.longitude}
        className="lg:col-span-2"
      />
    </div>
  );
}
