export type Basemap = 'voyager' | 'dark_all' | 'light_all';

export interface Theme {
  id: string;
  label: string;
  basemap: Basemap;
  /** Google Fonts family query for a theme with its own face, loaded only when that theme is. */
  font?: string;
}

const FONTS_CSS = 'https://fonts.googleapis.com/css2';

export const THEMES: readonly Theme[] = [
  { id: 'apple', label: 'Apple', basemap: 'voyager' },
  { id: 'glass', label: 'Apple Glass', basemap: 'voyager' },
  { id: 'radar', label: 'Midnight Radar', basemap: 'dark_all', font: 'JetBrains+Mono:wght@300;400;600' },
  { id: 'sticker', label: 'Pastel Sticker', basemap: 'light_all', font: 'Nunito:wght@400;600;800' },
  { id: 'memphis', label: 'Neo-Memphis', basemap: 'light_all', font: 'Poppins:wght@400;500;700' },
  // Its sky follows the selected location's snapshot (storm, haze, heat or calm): see sky.ts.
  { id: 'singapore', label: 'Singapore Sky', basemap: 'dark_all' },
];

export const DEFAULT_THEME_ID = 'apple';

const STORAGE_KEY = 'weather-theme';

export function findTheme(id: string | null): Theme | undefined {
  return THEMES.find((theme) => theme.id === id);
}

export function loadThemeId(): string {
  try {
    return findTheme(window.localStorage.getItem(STORAGE_KEY))?.id ?? DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

/**
 * Adds the theme's web font stylesheet once, the first time the theme is used. Apple, Glass and
 * Singapore Sky use the system face, so most visits load no web font at all.
 */
export function loadThemeFont(theme: Theme | undefined): void {
  if (!theme?.font || typeof document === 'undefined') return;
  const id = `theme-font-${theme.id}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `${FONTS_CSS}?family=${theme.font}&display=swap`;
  document.head.appendChild(link);
}

export function applyTheme(id: string): void {
  loadThemeFont(findTheme(id));
  document.documentElement.dataset.theme = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this session.
  }
}
