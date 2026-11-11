import { useTheme } from '../theme/ThemeContext';
import { THEMES } from '../theme/themes';

export function ThemeSelector() {
  const { theme, setThemeId } = useTheme();

  return (
    <div className="fixed right-4 top-4 z-30">
      <label className="sr-only" htmlFor="theme-select">
        Theme
      </label>
      <select
        id="theme-select"
        value={theme.id}
        onChange={(event) => setThemeId(event.target.value)}
        className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur-xl hover:bg-white/[0.14]"
      >
        {THEMES.map((option) => (
          <option key={option.id} value={option.id} className="text-slate-900">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
