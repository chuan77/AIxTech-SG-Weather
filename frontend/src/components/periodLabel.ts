const shortDate = new Intl.DateTimeFormat('en-SG', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
// Singapore is UTC+8 all year, so its days need no time-zone lookup.
const SGT_OFFSET_MS = 8 * 60 * MINUTE_MS;

/** The instant the Singapore day containing `instant` began, whatever the device's time zone. */
export function singaporeDayStart(instant: number): number {
  return Math.floor((instant + SGT_OFFSET_MS) / DAY_MS) * DAY_MS - SGT_OFFSET_MS;
}

function clockWords(minuteOfDay: number): string {
  if (minuteOfDay === 0) return 'Midnight';
  if (minuteOfDay === 720) return 'Midday';
  const hour = Math.floor(minuteOfDay / 60) % 12 || 12;
  const minute = minuteOfDay % 60;
  const minutes = minute ? `.${String(minute).padStart(2, '0')}` : '';
  return `${hour}${minutes} ${minuteOfDay < 720 ? 'am' : 'pm'}`;
}

/**
 * A forecast time named relative to the day of viewing: "6 pm" today, "Tomorrow midday",
 * "Yesterday 6 pm", or "12 Nov 6 am" further away. Midnight belongs to the day that ends then, so
 * tonight's is "Midnight", and so is the one that began today.
 */
export function periodTimeLabel(instant: number, now: number): string {
  const minuteOfDay = Math.floor((instant - singaporeDayStart(instant)) / MINUTE_MS);
  const words = clockWords(minuteOfDay);
  const isMidnight = minuteOfDay === 0;
  const day = singaporeDayStart(isMidnight ? instant - 1 : instant);
  const days = (day - singaporeDayStart(now)) / DAY_MS;
  if (days === 0 || (isMidnight && days === -1)) return words;

  const time = words.startsWith('Mid') ? words.toLowerCase() : words;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  return `${shortDate.format(new Date(day + SGT_OFFSET_MS))} ${time}`;
}

/** The same time for use mid-sentence ("from tomorrow midday"). */
export function periodTimePhrase(instant: number, now: number): string {
  return periodTimeLabel(instant, now).replace(/^(Tomorrow|Yesterday|Midday|Midnight)/, (word) =>
    word.toLowerCase(),
  );
}

/** "6 pm 14 Nov 2026 to 12 am ..." → "6 pm 14 Nov": the start of a forecast period, without the year. */
export function shortenPeriodLabel(label: string): string {
  if (!label) return '';
  const start = label.split(' to ')[0];
  return start.replace(/\s\d{4}\b/, '');
}
