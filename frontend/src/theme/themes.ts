export type Basemap = 'voyager' | 'dark_all' | 'light_all';

export interface Theme {
  id: string;
  label: string;
  basemap: Basemap;
}

export const THEMES: readonly Theme[] = [
  { id: 'apple', label: 'Apple', basemap: 'voyager' },
  { id: 'glass', label: 'Apple Glass', basemap: 'voyager' },
  { id: 'radar', label: 'Midnight Radar', basemap: 'dark_all' },
  { id: 'sticker', label: 'Pastel Sticker', basemap: 'light_all' },
  { id: 'memphis', label: 'Neo-Memphis', basemap: 'light_all' },
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

export function applyTheme(id: string): void {
  document.documentElement.dataset.theme = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this session.
  }
}
