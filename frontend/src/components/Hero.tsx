import { useStore, useSelectedLocation } from '../state/store';
import { ClockIcon, LocationIcon, RefreshIcon, ThunderIcon } from './icons';
import { HourlyStrip } from './HourlyStrip';
import { TenDayForecast } from './TenDayForecast';
import { LazyMapCard } from './map/LazyMapCard';
import { ConditionIcon } from './ConditionIcon';
import { MoreReadingsGrid, OutdoorGrid } from './Tiles';
import { ThemeSelector } from './ThemeSelector';
import { outdoorSummaryParts } from './outdoorSummary';
import { asSentence, formatTemperature } from './format';
import { readingFreshness } from './freshness';
import { formatSgtTime, singaporeDate } from './sunTimes';
import { nearestStrike } from './map/lightningHelpers';
import { useNow } from './map/useNow';
import { PrivacyNotice } from './PrivacyNotice';
import { readAnalyticsMode } from '../analytics/analyticsMode';
import { readSpeedInsightsMode } from '../analytics/speedInsightsMode';
import { privacyCopy } from '../analytics/privacyCopy';

// The notice follows measurement (specs 012 and 016): shown only where visits are counted or page
// speed is measured, and it names only what is active. null means neither, so no notice.
const privacy = privacyCopy({
  visits: readAnalyticsMode() !== 'off',
  speed: readSpeedInsightsMode() !== 'off',
});

export function Hero() {
  const { locations, refresh, refreshingId, refreshError, remove, bulkRefresh, lightning } =
    useStore();
  const selected = useSelectedLocation();
  // A one-minute tick lets a reading turn stale while the page stays open.
  const now = useNow(60_000, selected?.weather?.observed_at);

  if (!selected) {
    return (
      <main id="weather" tabIndex={-1} className="relative flex flex-1 flex-col px-4 py-10 outline-none md:p-10">
        <ThemeSelector placement="panel" />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-light text-white/85">Select a location</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Add a Singapore town or coordinates from the sidebar to see its weather.
            </p>
            {privacy && (
              <div className="mt-4">
                <PrivacyNotice copy={privacy} />
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  const isHome = locations[0]?.id === selected.id;
  const area =
    selected.weather?.area || `${selected.latitude.toFixed(3)}, ${selected.longitude.toFixed(3)}`;
  const freshness = readingFreshness(selected.weather?.observed_at, now);
  const observed = freshness.kind === 'none' ? null : freshness.when;
  const isStale = freshness.kind === 'stale';
  const asOfWhen = freshness.kind === 'stale' ? freshness.when : undefined;
  const source = selected.weather?.source;
  const isRefreshing = refreshingId === selected.id;
  const temperature = formatTemperature(selected.weather?.temperature_c);
  const high = formatTemperature(selected.weather?.forecast_high_c);
  const low = formatTemperature(selected.weather?.forecast_low_c);
  const condition = selected.weather?.condition;
  const summary = selected.weather
    ? outdoorSummaryParts(selected.weather, singaporeDate(new Date(now)))
    : [];
  // A stale summary is dated and quieter, so it reads as what was forecast then, not a verdict now.
  const asOf =
    freshness.kind === 'stale'
      ? `As of ${freshness.when.startsWith('Yesterday') ? 'y' + freshness.when.slice(1) : freshness.when}:`
      : null;
  const failure = refreshError?.id === selected.id && !isRefreshing ? refreshError.message : null;
  const strike = lightning.enabled
    ? nearestStrike(lightning.observation, selected.latitude, selected.longitude, now)
    : null;

  return (
    <main id="weather" tabIndex={-1} className="relative flex-1 outline-none md:overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 p-6 lg:p-8">
        {/* Short screens (a phone held sideways) drop the hero's top air so the reading clears the dock. */}
        <header className="flex flex-col items-center pt-6 pb-2 text-center [@media(max-height:500px)]:pt-0">
          {isHome && (
            <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
              <LocationIcon className="h-3 w-3" />
              <span>Home</span>
            </div>
          )}
          <h1 className="text-4xl font-light leading-tight text-white">{area}</h1>
          {/* An old snapshot says so before its verdict is read as today's answer. */}
          {isStale && !isRefreshing && (
            <p className="mt-3 inline-flex max-w-md items-center gap-2 rounded-card border border-white/20 bg-white/10 px-3 py-1.5 text-left text-xs font-medium text-white/90">
              <ClockIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="text-balance">
                Reading from {freshness.age === 'Yesterday' ? 'yesterday' : freshness.age}. Refresh
                for current conditions.
              </span>
            </p>
          )}
          {/* Lightning near the place outranks everything. It carries its own time: it comes from
              its own check, not from this place's snapshot, so a stale snapshot can't date it. */}
          {strike && (
            <p className="hero-lightning mt-3 inline-flex items-center gap-2 text-xl font-medium leading-snug text-white md:text-2xl">
              <ThunderIcon className="h-5 w-5 shrink-0 md:h-6 md:w-6" />
              <span>
                Lightning {strike.km < 1 ? 'under 1' : strike.km.toFixed(0)} km away
                <span className="font-normal text-ink-muted">
                  {' '}
                  at {formatSgtTime(new Date(strike.occurredAt))}
                </span>
              </span>
            </p>
          )}
          {/* The verdict leads: "can I go out?" is the question, not "how hot". Each part is one
              unbreakable unit that ends with its separator, so a wrap leaves the "·" at the end of
              a line and never starts one with it. */}
          {summary.length > 0 && (
            <p
              className={`hero-verdict mt-3 max-w-xl text-balance text-xl leading-snug md:text-2xl ${asOf ? 'text-ink-muted' : 'text-white'}`}
            >
              {asOf && <span className="font-medium">{asOf} </span>}
              {summary.map((part, i) => (
                <span key={part.text} className="inline-block">
                  {/* Only a heat warning earns a flag here; "low" stays plain so it never
                      outshouts a storm in the same line. The WBGT tile shows every band. */}
                  {part.heatTone === 'moderate' || part.heatTone === 'high' ? (
                    <span className={`heat-tone heat-tone--${part.heatTone}`}>{part.text}</span>
                  ) : (
                    part.text
                  )}
                  {i < summary.length - 1 && (
                    <>
                      <span className="sr-only">,</span>
                      <span aria-hidden="true">&nbsp;·&nbsp;</span>
                    </>
                  )}
                </span>
              ))}
            </p>
          )}
          {/* Still the one display-size number, but second: in Singapore it barely moves. */}
          <div
            className={`hero-temperature mt-4 text-[5rem] leading-none tracking-tight text-white md:text-[5.5rem] ${isStale ? 'hero-temperature--stale' : ''}`}
          >
            {temperature}
          </div>
          {condition && (
            <div className="mt-2 flex items-center gap-2 text-lg font-normal text-white/95">
              <ConditionIcon condition={condition} className="h-5 w-5 shrink-0" />
              <span>{condition}</span>
            </div>
          )}
          <div className="mt-0.5 text-sm text-ink-muted tabular-nums">
            H:{high} L:{low}
          </div>
          {/* Refresh sits beside the time it renews. Phones refresh from the bottom dock instead. */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <p className="text-xs text-ink-muted tabular-nums" aria-live="polite">
              {/* Naming the place makes a switch audible: this line changes with the selection. */}
              <span className="sr-only">{area}, </span>
              {observed ? <>Updated {observed}</> : 'Not refreshed yet'}
              {isStale && !isRefreshing && <span className="sr-only">, {freshness.age}</span>}
              {isRefreshing && ' · Refreshing…'}
            </p>
            <button
              type="button"
              onClick={() => void refresh(selected.id)}
              // A "Refresh all" run reaches this place in its turn.
              disabled={isRefreshing || bulkRefresh?.status === 'running'}
              className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-medium pointer-coarse:min-h-11 pointer-coarse:px-4 text-white/85 backdrop-blur-xl hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
            >
              <RefreshIcon className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
          {failure && (
            <div
              role="alert"
              className="mt-3 flex max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-card app-error px-4 py-2.5 text-sm"
            >
              <p className="min-w-0 text-balance">
                Couldn’t refresh {area}. {asSentence(failure)}
                {observed ? ` Showing the ${observed} reading.` : ''}
              </p>
              <button
                type="button"
                onClick={() => void refresh(selected.id)}
                className="min-h-11 shrink-0 rounded-full border border-[color:var(--error-border)] px-4 font-medium hover:bg-white/10 md:pointer-fine:min-h-9"
              >
                Retry
              </button>
            </div>
          )}
        </header>

        {/* Singapore's questions first: rain and storms, heat, UV and haze, then the detail. */}
        <HourlyStrip periods={selected.weather?.forecast_periods} stale={isStale} />
        <OutdoorGrid weather={selected.weather} asOf={asOfWhen} />
        <TenDayForecast weather={selected.weather} asOf={asOfWhen} />
        <LazyMapCard />
        <MoreReadingsGrid location={selected} asOf={asOfWhen} />

        <footer className="mt-2 flex flex-col items-center pb-4 text-xs text-ink-muted md:pb-8">
          {/* Phones: removing a place sits at the end of its page, far from the dock where
              places are switched, and still offers Undo. Desktop cards keep their own ×. */}
          <button
            type="button"
            onClick={() => remove(selected.id)}
            className="mb-3 min-h-11 rounded-full px-4 text-xs font-medium text-ink-muted hover:bg-white/10 hover:text-white md:hidden"
          >
            Remove {area} from saved places
          </button>
          <p>
            Weather for {area}
            {source ? ` · ${source}` : ''}
          </p>
          {privacy && <PrivacyNotice copy={privacy} />}
        </footer>
      </div>
      {/* Last in the DOM so the tab order reaches the weather and Refresh first; it still
          renders top-right of the panel. */}
      <ThemeSelector placement="panel" />
    </main>
  );
}
