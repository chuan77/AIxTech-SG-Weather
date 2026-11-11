import { createContext, useContext, useState, type ReactNode } from 'react';
import { DEFAULT_THEME_ID, applyTheme, findTheme, loadThemeId, type Theme } from './themes';

interface ThemeContextValue {
  theme: Theme;
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setId] = useState(loadThemeId);
  const theme = findTheme(themeId) ?? findTheme(DEFAULT_THEME_ID)!;

  function setThemeId(id: string) {
    setId(id);
    applyTheme(id);
  }

  return <ThemeContext.Provider value={{ theme, setThemeId }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
