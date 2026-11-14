import { ConditionIcon } from './ConditionIcon';
import { CalendarIcon } from './icons';
import { formatTemperature } from './format';
import { singaporeDate } from './sunTimes';
import type { DailyForecast, WeatherSnapshot } from '../types';

interface TenDayForecastProps {
  weather: WeatherSnapshot;
  /** Set when the snapshot is stale: when it was read. The list then says when it was issued. */
  asOf?: string;
}

interface WeekRange {
  min: number;
  max: number;
}

function labelForDate(date: string, today: string | null): string {
  if (date === today) return 'Today';
  // NEA dates are plain YYYY-MM-DD; read them as UTC so a viewer west of Greenwich
  // doesn't see the previous weekday.
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-SG', { weekday: 'short', timeZone: 'UTC' }).format(parsed);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function computeWeekRange(days: DailyForecast[]): WeekRange | null {
  const lows = days.map((day) => day.temperature_low_c).filter(isFiniteNumber);
  const highs = days.map((day) => day.temperature_high_c).filter(isFiniteNumber);
  if (lows.length === 0 || highs.length === 0) return null;
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  if (max === min) return null;
  return { min, max };
}

function barOffsets(day: DailyForecast, range: WeekRange | null) {
  if (!range) return null;
  const { min, max } = range;
  const span = max - min;
  const low = day.temperature_low_c;
  const high = day.temperature_high_c;
  if (!isFiniteNumber(low) || !isFiniteNumber(high)) return null;
  const left = ((low - min) / span) * 100;
  const right = ((max - high) / span) * 100;
  return { left, right };
}

export function TenDayForecast({ weather, asOf }: TenDayForecastProps) {
  const today = singaporeDate(new Date());
  // An old snapshot's forecast can include days already gone; show only today onwards.
  const allDays = weather.daily_forecast;
  const days = allDays.filter((day) => day.date >= today);
  const range = computeWeekRange(days);

  return (
    <section
      aria-labelledby="daily-forecast-heading"
      className="rounded-card border border-white/15 bg-white/[0.08] backdrop-blur-xl"
    >
      <h2
        id="daily-forecast-heading"
        className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted"
      >
        <CalendarIcon />
        <span>
          {asOf
            ? `Forecast issued ${asOf}`
            : days.length > 0
              ? `${days.length}-Day Forecast`
              : 'Daily Forecast'}
        </span>
      </h2>
      <ul className="divide-y divide-white/5">
        {days.length > 0 ? (
          days.map((day) => {
            const offsets = barOffsets(day, range);
            return (
              <li
                key={day.date}
                className="grid grid-cols-[5rem_2rem_3rem_1fr_3rem] items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="font-medium text-white/95">{labelForDate(day.date, asOf ? null : today)}</span>
                <ConditionIcon condition={day.forecast} className="h-5 w-5 text-ink-muted" />
                <span className="tabular-nums text-ink-muted">
                  {formatTemperature(day.temperature_low_c)}
                </span>
                <div className="relative h-1.5 rounded-full bg-white/10">
                  {offsets && (
                    <div
                      className="absolute top-0 h-1.5 rounded-full bg-gradient-to-r from-sky-300/80 via-amber-300/70 to-orange-300/80"
                      style={{ left: `${offsets.left}%`, right: `${offsets.right}%` }}
                    />
                  )}
                </div>
                <span className="text-right tabular-nums text-white/95">
                  {formatTemperature(day.temperature_high_c)}
                </span>
                {day.forecast && (
                  <span className="col-span-5 -mt-1 truncate text-xs text-ink-muted">
                    {day.forecast}
                  </span>
                )}
              </li>
            );
          })
        ) : (
          <li className="px-4 py-4 text-sm text-ink-muted">
            {allDays.length > 0
              ? 'Every day in this forecast has passed. Refresh for a new one.'
              : 'Forecast unavailable.'}
          </li>
        )}
      </ul>
    </section>
  );
}
