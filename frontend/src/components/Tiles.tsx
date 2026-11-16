import { CloudIcon, DropletIcon, SunIcon, ThermometerIcon, WindIcon } from './icons';
import { useId, useMemo, useState, type ReactNode } from 'react';
import type { Location, WeatherSnapshot } from '../types';
import { feelsLike, missingInputsText } from './feelsLike';
import { heatStressView, type HeatStressTone } from './heatStress';
import { heatReconcileLine } from './heatComfort';
import { useNow } from './map/useNow';
import { psiBand } from './outdoorSummary';
import { formatSgtTime, singaporeDate, sunTimes } from './sunTimes';
import {
  UV_GUIDANCE,
  UV_MODERATE_FROM,
  UV_PEAK_CAPTION,
  uvBandName,
  uvBarFraction,
  uvBarPosition,
  uvDayLabel,
  uvSourceText,
  uvStatusText,
  uvTrendView,
  type UvSlot,
} from './uvTrend';

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
      // Takes the full row on large screens, open or closed, below Rainfall | UV (spec 008).
      className="col-span-2 lg:col-span-4"
    >
      <div className="text-4xl font-light leading-none tabular-nums text-white/95">{psi}</div>
      <div className="mt-1 text-base text-white/85">
        {psiBand(weather?.psi_twenty_four_hourly) ?? 'Unavailable'}
      </div>
      <ScaleBar value={weather?.psi_twenty_four_hourly} max={300} scale="psi" />
      <p className="mt-3 text-xs leading-snug text-ink-muted">
        PM2.5 {pm25} µg/m³ · {weather?.air_quality_region ?? 'nearest'} region
        {asOf && ` · reading from ${asOf}`}
      </p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="air-quality-detail"
        onClick={() => setOpen((value) => !value)}
        className="mt-3 min-h-11 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-medium text-white/85 hover:bg-white/[0.12] md:pointer-fine:min-h-0 md:pointer-fine:px-3 md:pointer-fine:py-1"
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
                      {pollutantFormat.format(value)}{' '}
                      <span className="text-xs text-ink-muted">{unit}</span>
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
        <span className="text-base font-light leading-none tabular-nums text-white/90">
          {speed}
        </span>
        <span className="text-[11px] text-ink-muted">km/h</span>
      </div>
    </div>
  );
}

function uvLabel(value: number | null | undefined): string {
  return uvBandName(value) ?? 'Unavailable';
}

/** Plot height in px for a full (UV 11) bar; the UV 3 line sits at 3/11 of it. */
const UV_PLOT_PX = 48;
/** Hours labelled on the axis (all 13 would crowd a phone). */
const UV_AXIS_HOURS = new Set([7, 10, 13, 16, 19]);

function hourText(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** Today's (or the snapshot day's) hourly UV slots, 07:00 → 19:00 (spec 008, contracts/ui.md). */
function UvHourlyView({ slots, label }: { slots: UvSlot[]; label: string }) {
  const peakStart = slots.findIndex((slot) => slot.inPeakWindow);
  const peakCount = slots.filter((slot) => slot.inPeakWindow).length;
  return (
    // Below 340 px the slots get too narrow for a number each; the text lines still show (FR-015).
    <div className="uv-hourly mt-4">
      <div className="relative">
        {/* NEA's usual peak, 11 am – 3 pm: behind the 11, 12, 13 and 14 columns. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 rounded-sm bg-white/[0.06]"
          style={{
            left: `${(peakStart / slots.length) * 100}%`,
            width: `${(peakCount / slots.length) * 100}%`,
          }}
        />
        {/* UV 3, the start of Moderate. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-dashed border-white/40"
          style={{ bottom: Math.round((UV_MODERATE_FROM / 11) * UV_PLOT_PX) }}
        />
        <ol
          aria-label={label}
          className="relative grid grid-cols-[repeat(13,minmax(0,1fr))]"
          style={{ height: UV_PLOT_PX + 16 }}
        >
          {slots.map((slot) => (
            <li key={slot.hour} className="flex flex-col items-center justify-end gap-0.5">
              <span className="sr-only">
                {slot.value === null
                  ? `${hourText(slot.hour)}, no reading`
                  : `${hourText(slot.hour)}, UV ${slot.value}, ${slot.band}`}
              </span>
              {slot.value === null ? (
                <span aria-hidden="true" className="w-3/5 border-b border-dotted border-white/20" />
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className="text-[11px] leading-none tabular-nums text-white/85"
                  >
                    {slot.value}
                  </span>
                  <span
                    aria-hidden="true"
                    className="uv-bar w-3/5 rounded-t-sm"
                    style={{
                      height: Math.max(2, Math.round(uvBarFraction(slot.value) * UV_PLOT_PX)),
                      backgroundPositionX: uvBarPosition(slot.value),
                    }}
                  />
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div
        aria-hidden="true"
        className="mt-1 grid grid-cols-[repeat(13,minmax(0,1fr))] text-center text-[10px] tabular-nums text-ink-muted"
      >
        {slots.map((slot) => (
          <span key={slot.hour}>{UV_AXIS_HOURS.has(slot.hour) ? slot.hour : ''}</span>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] leading-tight text-ink-muted"
      >
        <span className="flex items-center gap-1">
          <span className="w-3 border-t border-dashed border-white/40" />
          UV {UV_MODERATE_FROM} (Moderate)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-white/[0.12]" />
          {UV_PEAK_CAPTION}
        </span>
      </div>
    </div>
  );
}

export function UVTile({ weather, asOf, className }: WeatherProps & { className?: string }) {
  const now = useNow(60_000, weather?.observed_at);
  const view = uvTrendView(weather?.uv_index, weather?.uv_hourly, new Date(now));

  return (
    <TileShell icon={<SunIcon className="h-3.5 w-3.5" />} title="UV Index" className={className}>
      <div className="text-4xl font-light leading-none tabular-nums text-white/95">
        {formatNumber(weather?.uv_index)}
      </div>
      <div className="mt-1 text-base text-white/85">{uvLabel(weather?.uv_index)}</div>
      <ScaleBar value={weather?.uv_index} max={11} scale="uv" />
      {view.kind === 'readings' && (
        <>
          <p className="mt-3 text-sm text-white/85">{uvStatusText(view)}</p>
          <UvHourlyView
            slots={view.slots}
            label={`Hourly UV, ${view.dayLabel ?? uvDayLabel(weather.uv_hourly?.date ?? '')}`}
          />
        </>
      )}
      {view.kind === 'pre-feature' && (
        <p className="mt-3 text-sm text-white/85">Hourly view appears after the next refresh.</p>
      )}
      {view.kind === 'empty' && <p className="mt-3 text-sm text-white/85">No UV readings yet.</p>}
      {view.kind !== 'unavailable' && (
        <p className="mt-3 text-xs leading-snug text-ink-muted">{UV_GUIDANCE}</p>
      )}
      <p
        className={`${view.kind === 'unavailable' ? 'mt-3' : 'mt-1'} text-xs leading-snug text-ink-muted`}
      >
        {view.kind === 'readings'
          ? uvSourceText(view.asOf, view.dayLabel)
          : // Pre-feature and empty: the tile's own stale time when set (contracts/ui.md item 6).
            uvSourceText(view.kind === 'unavailable' ? null : (asOf ?? null))}
      </p>
    </TileShell>
  );
}

export function PrecipitationTile({
  weather,
  asOf,
  className,
}: WeatherProps & { className?: string }) {
  return (
    <TileShell icon={<DropletIcon />} title="Rainfall" className={className}>
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
        {asOf
          ? `Nearest humidity station, reading from ${asOf}.`
          : 'Nearest realtime humidity station.'}
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

function FeelsLikeReading({ weather, asOf }: WeatherProps) {
  const result = feelsLike(weather);
  if (result.kind === 'no-reading') {
    return (
      <>
        <div className="text-xl font-light leading-tight text-white/85">No reading</div>
        <p className="mt-2 text-xs leading-snug text-ink-muted">
          {missingInputsText(result.missing)}.
        </p>
      </>
    );
  }
  return (
    <>
      {/* Supporting detail: smaller than heat stress, which is the verdict. */}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-light leading-none tabular-nums text-white/90">
          {result.value.toFixed(1)}&deg;
        </span>
        <span className="text-sm text-white/85">{result.band.label}</span>
      </div>
      {result.approx && (
        <p className="mt-1 text-xs text-ink-muted">
          Approximate: no wind reading, so still air is assumed.
        </p>
      )}
      {asOf ? (
        // Clothing advice is for now; an old reading only says what it was.
        <p className="mt-2 text-xs leading-snug text-ink-muted">Reading from {asOf}.</p>
      ) : (
        <p className="mt-2 text-xs leading-snug text-ink-muted">
          {result.band.advice}
          {result.umbrella && <span className="text-white/90"> Carry an umbrella.</span>}
        </p>
      )}
    </>
  );
}

function HeatStressReading({ weather, asOf }: WeatherProps) {
  const view = heatStressView(weather);
  if (view.kind === 'no-reading') {
    return (
      <>
        <div className="text-2xl font-light leading-tight text-white/85">No reading</div>
        <p className="mt-3 text-xs leading-snug text-ink-muted">
          No heat-stress reading came with this snapshot. Refresh to try again.
        </p>
      </>
    );
  }
  if (view.kind === 'no-nearby-station') {
    return (
      <>
        <div className="text-2xl font-light leading-tight text-white/85">No nearby station</div>
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
      <ScaleBar value={(weather.wbgt_c as number) - 25} max={10} scale="wbgt" />
      {/* NEA's guidance is for now; a stale reading keeps its level but not its instructions. */}
      {view.guidance && !asOf && (
        <p className="mt-3 text-xs leading-snug text-ink-muted">{view.guidance}</p>
      )}
      <p className="mt-3 flex flex-wrap gap-x-1 text-[11px] leading-snug text-ink-muted">
        <span>WBGT at {view.stationName ?? 'nearest station'}</span>
        <span>· {view.distanceKm} km</span>
        {asOf ? (
          <span>· reading from {asOf}</span>
        ) : (
          view.observedAt && <span>· {view.observedAt}</span>
        )}
      </p>
    </>
  );
}

/**
 * NEA heat stress and how it feels, read together, because in Singapore the question is rarely
 * "how hot" but "how hard is it to be out in". Heat stress (WBGT) leads: it is NEA's measure for
 * outdoor activity. Air temperature is the hero's number, so it isn't repeated here.
 */
export function HeatComfortPanel({
  weather,
  asOf,
  className = '',
}: WeatherProps & { className?: string }) {
  const feels = feelsLike(weather);
  const heat = heatStressView(weather);
  const reconcile =
    feels.kind === 'value' && heat.kind === 'reading'
      ? heatReconcileLine(feels.band.id, feels.band.label, heat.tone, heat.level, Boolean(asOf))
      : null;

  return (
    <TileShell icon={<ThermometerIcon />} title="Heat & Comfort" className={className}>
      {reconcile && <p className="mb-3 text-sm leading-snug text-white/90">{reconcile}</p>}
      <div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-[3fr_2fr] sm:divide-x sm:divide-y-0">
        <ReadingColumn label="Heat stress (WBGT)">
          <HeatStressReading weather={weather} asOf={asOf} />
        </ReadingColumn>
        <ReadingColumn label="Feels like">
          <FeelsLikeReading weather={weather} asOf={asOf} />
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
        <PrecipitationTile weather={weather} asOf={asOf} className="col-span-2" />
        <UVTile weather={weather} asOf={asOf} className="col-span-2" />
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
