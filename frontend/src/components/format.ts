export function formatTemperature(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}°` : '--°';
}

/** Ends a message with a full stop when it has no closing punctuation, so it can sit mid-paragraph. */
export function asSentence(message: string): string {
  const trimmed = message.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
