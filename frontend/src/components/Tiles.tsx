import { CloudIcon, DropletIcon, SunIcon, ThermometerIcon, WindIcon } from './icons';
import { useId, useMemo, useState, type ReactNode } from 'react';
import type { Location, WeatherSnapshot } from '../types';
import { feelsLike, missingInputsText } from './feelsLike';
import { heatStressView, type HeatStressTone } from './heatStress';
import { useNow } from './map/useNow';
import { psiBand } from './outdoorSummary';
import { formatSgtTime, singaporeDate, sunTimes } from './sunTimes';

interface WeatherProps {
  weather: WeatherSnapshot;
  /** Set when the snapshot is stale: when it was read ("11 Nov 18:37"). Replaces "latest"/"realtime" wording. */
  asOf?: string;
}

interface TileShellProps {
  icon: ReactNode;
  title: string;
  /** Tiles sit under the grid's "Current conditions" heading; standalone panels pass 2. */
  level?: 2 | 3;
  className?: string;
  children: ReactNode;
}

export function TileShell({ icon, title, level = 3, className = '', children }: TileShellProps) {
  const headingId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section
      aria-labelledby={headingId}
      className={`flex flex-col gap-3 rounded-card border border-white/15 bg-white/[0.08] p-4 backdrop-blur-xl ${className}`}
    >
      <Heading
        id={headingId}
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted"
      >
        {icon}
        <span>{title}</span>
      </Heading>
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
  /** Which data scale fills the bar; its colours come from the theme's --scale-* tokens. */
  scale: 'psi' | 'uv' | 'wbgt';
}

function ScaleBar({ value, max, scale }: ScaleBarProps) {
  const hasValue = isFiniteNumber(value);
  const pct = hasValue ? Math.max(0, Math.min(100, (value / max) * 100)) : null;
  return (
    <div className="relative mt-3 h-1.5">
      <div className={`h-1.5 rounded-full opacity-80 scale-bar--${scale}`} />
      {hasValue && (
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow shadow-black/40"
          style={{ left: `${pct}%` }}
        />
      )}
    </div>
  );
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

export function AirQualityTile({ weather, asOf }: WeatherProps) {
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
      <div className="text-4xl font-light leading-none tabular-nums text-white/95">{psi}</div>
      <div className="mt-1 text-base text-white/85">
        {psiBand(weather?.psi_twenty_four_hourly) ?? 'Unavailable'}
      </div>
      <ScaleBar
        value={weather?.psi_twenty_four_hourly}
        max={300}
        scale="psi"
      />
      <p className="mt-3 text-xs leading-snug text-ink-muted">
        PM2.5 {pm25} µg/m³ · {weather?.air_quality_region ?? 'nearest'} region
        {asOf && ` · reading from ${asOf}`}
      </p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="air-quality-detail"
        onClick={() => setOpen((value) => !value)}
        className="mt-3 min-h-11 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-medium text-white/85 hover:bg-white/[0.12] md:min-h-0 md:px-3 md:py-1"
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
                  <span className="text-xs text-ink-muted">{label}</span>
                  {isFiniteNumber(value) ? (
                    <span className="tabular-nums text-white/90">
                      {pollutantFormat.format(value)} <span className="text-xs text-ink-muted">{unit}</span>
                    </span>
                  ) : (
                    <span className="text-ink-muted">No reading</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            {readingTime && !Number.isNaN(readingTime.getTime())
              ? `Reading at ${formatSgtTime(readingTime)} SGT`
              : 'Reading time unavailable'}
          </p>
        </div>
      )}
    </TileShell>
  );
}

export function WindTile({ weather, asOf }: WeatherProps) {
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
            <span className="text-ink-muted">Wind</span>
            <span className="tabular-nums text-white/90">{speed} km/h</span>
          </li>
          {hasDirection && (
            <li className="flex justify-between">
              <span className="text-ink-muted">Direction</span>
              <span className="tabular-nums text-white/90">{direction}&deg;</span>
            </li>
          )}
        </ul>
        <Compass speed={speed} direction={weather?.wind_direction_degrees} />
      </div>
      {asOf && <p className="mt-3 text-xs leading-snug text-ink-muted">Reading from {asOf}.</p>}
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
      <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[11px] text-ink-muted">N</span>
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted">
        E
      </span>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-ink-muted">
        S
      </span>
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted">
        W
      </span>
      {hasDirection && (
        <div
          className="absolute left-1/2 top-2 h-7 w-px origin-[50%_30px] -translate-x-1/2 rounded-full bg-white/70"
          style={{ transform: `translateX(-50%) rotate(${direction}deg)` }}
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-light leading-none tabular-nums text-white/90">{speed}</span>
        <span className="text-[11px] text-ink-muted">km/h</span>
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

export function UVTile({ weather, asOf }: WeatherProps) {
  return (
    <TileShell icon={<SunIcon className="h-3.5 w-3.5" />} title="UV Index">
      <div className="text-4xl font-light leading-none tabular-nums text-white/95">
        {formatNumber(weather?.uv_index)}
      </div>
      <div className="mt-1 text-base text-white/85">{uvLabel(weather?.uv_index)}</div>
      <ScaleBar
        value={weather?.uv_index}
        max={11}
        scale="uv"
      />
      <p className="mt-3 text-xs leading-snug text-ink-muted">
        {asOf ? `Nationwide UVI reading from ${asOf}.` : 'Latest nationwide UVI reading.'}
      </p>
    </TileShell>
  );
}

export function PrecipitationTile({ weather, asOf }: WeatherProps) {
  return (
    <TileShell icon={<DropletIcon />} title="Rainfall">
      <div className="text-4xl font-light leading-none tabular-nums text-white/95">
        {formatNumber(weather?.rainfall_mm, 1)} mm
      </div>
      <div className="mt-1 text-sm text-white/85">
        {asOf ? `5-minute total at ${asOf}` : 'Latest 5-minute total'}
      </div>
      <p className="mt-3 text-xs leading-snug text-ink-muted">
        {asOf ? 'Nearest rainfall station.' : 'Nearest realtime rainfall station.'}
      </p>
    </TileShell>
  );
}

export function HumidityTile({ weather, asOf }: WeatherProps) {
  return (
    <TileShell icon={<DropletIcon />} title="Humidity">
      <div className="text-4xl font-light leading-none tabular-nums text-white/95">
        {formatNumber(weather?.humidity_percent)}%
      </div>
      <p className="mt-3 text-xs leading-snug text-ink-muted">
        {asOf ? `Nearest humidity station, reading from ${asOf}.` : 'Nearest realtime humidity station.'}
      </p>
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
          <span className="text-ink-muted">Sunrise</span>
          <span className="tabular-nums text-white/90">{formatSgtTime(times.sunrise)}</span>
        </li>
        <li className="flex justify-between">
          <span className="text-ink-muted">Sunset</span>
          <span className="tabular-nums text-white/90">{formatSgtTime(times.sunset)}</span>
        </li>
      </ul>
      <p className="mt-3 text-xs leading-snug text-ink-muted">Today, Singapore time.</p>
    </TileShell>
  );
}

const HEAT_STRESS_TONE_CLASS: Record<HeatStressTone, string> = {
  low: 'text-ink-muted',
  moderate: 'rounded-full bg-white/10 px-2 font-semibold text-white/90',
  high: 'rounded-full bg-white/20 px-2 font-bold text-white ring-1 ring-white/40',
  unknown: 'text-ink-muted',
};

interface ReadingColumnProps {
  label: string;
  children: ReactNode;
}

/** One measurement inside the Heat & Comfort panel: a small label over its reading. */
function ReadingColumn({ label, children }: ReadingColumnProps) {
  return (
    <div className="flex min-w-0 flex-col py-3 first:pt-0 last:pb-0 sm:px-4 sm:py-0 sm:first:pl-0 sm:last:pr-0">
      <h4 className="text-xs font-medium text-ink-muted">{label}</h4>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function AirTemperatureReading({ weather, asOf }: WeatherProps) {
  return (
    <>
      <div className="text-4xl font-light leading-none tabular-nums text-white/95">
        {formatTemperature(weather.temperature_c)}&deg;
      </div>
      <p className="mt-3 text-xs leading-snug text-ink-muted">
        {asOf ? `Nearest station, reading from ${asOf}.` : 'Nearest realtime station.'}
      </p>
    </>
  );
}

function FeelsLikeReading({ weather }: WeatherProps) {
  const result = feelsLike(weather);
  if (result.kind === 'no-reading') {
    return (
      <>
        <div className="text-2xl font-light leading-tight text-white/85">No reading</div>
        <p className="mt-3 text-xs leading-snug text-ink-muted">
          {missingInputsText(result.missing)}.
        </p>
      </>
    );
  }
  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-light leading-none tabular-nums text-white/95">
          {result.value.toFixed(1)}&deg;
        </span>
        {result.approx && (
          <span className="text-xs text-ink-muted" title="No wind reading; calculated for still air">
            approx.
          </span>
        )}
      </div>
      <div className="mt-1 text-base text-white/85">{result.band.label}</div>
      <p className="mt-3 text-xs leading-snug text-ink-muted">
        {result.band.advice}
        {result.umbrella && <span className="text-white/90"> Carry an umbrella.</span>}
      </p>
    </>
  );
}

function HeatStressReading({ weather }: WeatherProps) {
  const view = heatStressView(weather);
  if (view.kind === 'no-reading') {
    return <div className="text-2xl font-light leading-tight text-white/85">No reading</div>;
  }
  if (view.kind === 'no-nearby-station') {
    return (
      <>
        <div className="text-2xl font-light leading-tight text-white/85" title={view.tooltip}>
          No nearby station
        </div>
        <p className="mt-3 text-xs leading-snug text-ink-muted">{view.tooltip}.</p>
      </>
    );
  }
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-4xl font-light leading-none tabular-nums text-white/95">
          {view.value}&deg;
        </span>
        {view.level && (
          <span
            className={`heat-tone heat-tone--${view.tone} text-sm ${HEAT_STRESS_TONE_CLASS[view.tone]}`}
          >
            {view.level}
          </span>
        )}
      </div>
      <ScaleBar
        value={(weather.wbgt_c as number) - 25}
        max={10}
        scale="wbgt"
      />
      {view.guidance && <p className="mt-3 text-xs leading-snug text-ink-muted">{view.guidance}</p>}
      <p className="mt-3 flex flex-wrap gap-x-1 text-[11px] leading-snug text-ink-muted">
        <span>WBGT at {view.stationName ?? 'nearest station'}</span>
        <span>· {view.distanceKm} km</span>
        {view.observedAt && <span>· {view.observedAt}</span>}
      </p>
    </>
  );
}

/**
 * Air temperature, how it feels and NEA heat stress read together, because in Singapore
 * the question is rarely "how hot" but "how hard is it to be out in".
 */
export function HeatComfortPanel({
  weather,
  asOf,
  className = '',
}: WeatherProps & { className?: string }) {
  return (
    <TileShell icon={<ThermometerIcon />} title="Heat & Comfort" className={className}>
      <div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <ReadingColumn label="Air temperature">
          <AirTemperatureReading weather={weather} asOf={asOf} />
        </ReadingColumn>
        <ReadingColumn label="Feels like">
          <FeelsLikeReading weather={weather} />
        </ReadingColumn>
        <ReadingColumn label="Heat stress (WBGT)">
          <HeatStressReading weather={weather} />
        </ReadingColumn>
      </div>
    </TileShell>
  );
}

/** The outdoor-decision readings, straight after the 24-hour strip. */
export function OutdoorGrid({ weather, asOf }: WeatherProps) {
  return (
    <section aria-labelledby="outdoor-conditions-heading">
      <h2 id="outdoor-conditions-heading" className="sr-only">
        Outdoor conditions
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HeatComfortPanel weather={weather} asOf={asOf} className="col-span-2 lg:col-span-4" />
        <PrecipitationTile weather={weather} asOf={asOf} />
        <UVTile weather={weather} asOf={asOf} />
        <AirQualityTile weather={weather} asOf={asOf} />
      </div>
    </section>
  );
}

interface MoreReadingsGridProps {
  location: Location;
  asOf?: string;
}

/** Supporting readings below the map. */
export function MoreReadingsGrid({ location, asOf }: MoreReadingsGridProps) {
  const weather = location.weather;
  return (
    <section aria-labelledby="more-readings-heading">
      <h2 id="more-readings-heading" className="sr-only">
        More readings
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <WindTile weather={weather} asOf={asOf} />
        <HumidityTile weather={weather} asOf={asOf} />
        <SunTile latitude={location.latitude} longitude={location.longitude} />
      </div>
    </section>
  );
}
