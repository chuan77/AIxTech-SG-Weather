import type { Location } from '../../types';
import { CONDITION_GLYPHS } from '../ConditionIcon';
import { weatherGlyphMarkup } from '../icons';
import { conditionToIcon, formatPinLabel } from './mapHelpers';

export function pinName(location: Location, isSelected: boolean): string {
  const area =
    location.weather?.area || `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`;
  const parts = [area, formatPinLabel(location), location.weather?.condition].filter(Boolean);
  return `${parts.join(', ')}${isSelected ? ', selected' : ''}`;
}

/** Escapes text placed into the pin's HTML string; area names and conditions come from the API. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/**
 * The pin's HTML for Leaflet's divIcon, built as a string so react-dom/server stays out of the
 * bundle. The pin is a button; its hidden name says which place, not just "30°".
 */
export function pinMarkup(location: Location, isSelected: boolean): string {
  const glyph = weatherGlyphMarkup(
    CONDITION_GLYPHS[conditionToIcon(location.weather?.condition)],
    'h-3.5 w-3.5',
  );
  return (
    `<div class="weather-pin${isSelected ? ' weather-pin--selected' : ''}">` +
    `<span class="sr-only">${escapeHtml(pinName(location, isSelected))}</span>` +
    `<div class="weather-pin__label" aria-hidden="true">${glyph}` +
    `<span>${escapeHtml(formatPinLabel(location))}</span></div>` +
    '<div class="weather-pin__dot"></div></div>'
  );
}
