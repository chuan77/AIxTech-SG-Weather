const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// "6 pm 14 Nov", "6 pm 14 Nov 2026", "Midday 15 Nov": a time, then optionally "<day> <Mon> [year]".
const WITH_DATE = /^(.*?)\s+(\d{1,2})\s+([A-Za-z]{3})[a-z]*(?:\s+(\d{4}))?$/;

interface ParsedStart {
  time: string;
  day?: number;
  month?: number;
  year?: number;
}

function parsePart(part: string): ParsedStart {
  const match = WITH_DATE.exec(part.trim());
  if (!match) return { time: part.trim() };
  const month = MONTHS.indexOf(match[3].toLowerCase());
  if (month < 0) return { time: part.trim() };
  return {
    time: match[1].trim(),
    day: Number(match[2]),
    month,
    year: match[4] ? Number(match[4]) : undefined,
  };
}

/** UTC midnight of a Singapore calendar date, for whole-day arithmetic. */
function dayValue(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day);
}

const shortDate = new Intl.DateTimeFormat('en-SG', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/**
 * The start of an NEA forecast period, named relative to today in Singapore:
 * "6 am" today, "Tomorrow 6 am", "Yesterday 6 pm", or "12 Nov 6 am" further out.
 * NEA puts the date on the end of the label when the period starts and ends on the same day
 * ("6 am to Midday 15 Nov"), so a start without its own date takes the end's.
 *
 * @param today Singapore calendar date, `YYYY-MM-DD`.
 */
export function periodStartLabel(label: string, today: string): string {
  if (!label) return '';
  const [startText, endText = ''] = label.split(' to ');
  const start = parsePart(startText);
  const end = parsePart(endText);
  const day = start.day ?? end.day;
  const month = start.month ?? end.month;
  if (day === undefined || month === undefined) return start.time;

  const [ty, tm, td] = today.split('-').map(Number);
  const todayValue = dayValue(ty, tm - 1, td);
  // Without a year, pick the one that puts the date nearest today (a 31 Dec label read on 1 Jan).
  const explicitYear = start.year ?? end.year;
  const year =
    explicitYear ??
    [ty - 1, ty, ty + 1].reduce((best, candidate) =>
      Math.abs(dayValue(candidate, month, day) - todayValue) <
      Math.abs(dayValue(best, month, day) - todayValue)
        ? candidate
        : best,
    );

  const diffDays = Math.round((dayValue(year, month, day) - todayValue) / 86_400_000);
  if (diffDays === 0) return start.time;
  const time = start.time === 'Midday' ? 'midday' : start.time;
  if (diffDays === 1) return `Tomorrow ${time}`;
  if (diffDays === -1) return `Yesterday ${time}`;
  return `${shortDate.format(new Date(dayValue(year, month, day)))} ${time}`;
}

/** The same label for use mid-sentence ("from tomorrow midday"). */
export function periodStartPhrase(label: string, today: string): string {
  const text = periodStartLabel(label, today);
  return /^(Tomorrow|Yesterday|Midday|Midnight)/.test(text)
    ? text.charAt(0).toLowerCase() + text.slice(1)
    : text;
}
