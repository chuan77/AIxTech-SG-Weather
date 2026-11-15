import { ConditionIcon } from './ConditionIcon';
import { ClockIcon } from './icons';
import { conditionToIcon } from './map/mapHelpers';
import { periodStartLabel } from './periodLabel';
import { singaporeDate } from './sunTimes';
import type { ForecastPeriod } from '../types';

interface HourlyStripProps {
  periods?: ForecastPeriod[];
  /** An old snapshot's first period isn't "now"; it keeps its own date and time label. */
  stale?: boolean;
}

/** Same Label style as every other panel header: icon, uppercase, wide tracking. */
function StripHeading() {
  return (
    <h2
      id="hourly-forecast-heading"
      className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted"
    >
      <ClockIcon />
      <span>24-Hour Regional Forecast</span>
    </h2>
  );
}

export function HourlyStrip({ periods = [], stale = false }: HourlyStripProps) {
  if (periods.length === 0) {
    return (
      <section
        aria-labelledby="hourly-forecast-heading"
        className="rounded-card border border-white/15 bg-white/[0.08] backdrop-blur-xl"
      >
        <StripHeading />
        <p className="flex min-h-[5rem] items-center justify-center px-4 text-sm text-ink-muted">
          No 24-hour forecast in this snapshot.
        </p>
      </section>
    );
  }

  const today = singaporeDate(new Date());
  const slots = periods.map((period, index) => ({
    key: `${period.label}-${index}`,
    label: index === 0 && !stale ? 'Now' : periodStartLabel(period.label, today),
    forecast: period.forecast,
  }));

  return (
    <section
      aria-labelledby="hourly-forecast-heading"
      className="rounded-card border border-white/15 bg-white/[0.08] backdrop-blur-xl"
    >
      <StripHeading />
      <div
        className="grid divide-x divide-white/5"
        style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
      >
        {slots.map((slot) => {
          // Sun keeps its warm tint; every other condition stays in ink.
          const isSun = conditionToIcon(slot.forecast) === 'sun';
          return (
            <div key={slot.key} className="flex flex-col items-center gap-2 px-2 py-4 text-center">
              <div className="text-xs font-medium text-white/85">{slot.label}</div>
              <ConditionIcon
                condition={slot.forecast}
                className={`h-7 w-7 ${isSun ? 'text-sun' : 'text-white/85'}`}
              />
              <div className="text-xs leading-snug text-white/90">{slot.forecast}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
