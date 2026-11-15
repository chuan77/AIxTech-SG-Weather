import { useId } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { THEMES } from '../theme/themes';

interface ThemeSelectorProps {
  /**
   * `panel` (md and up): top-right of the main panel, scrolling away with it so it never sits
   * over a reading. `page-end` (phones): in flow at the end of the page, clear of the dock.
   */
  placement: 'panel' | 'page-end';
}

const PLACEMENT_CLASS: Record<ThemeSelectorProps['placement'], string> = {
  panel: 'absolute right-4 top-4 z-30 hidden md:flex',
  'page-end': 'flex justify-center px-4 pb-[calc(var(--dock-height,4.25rem)+0.75rem)] md:hidden',
};

export function ThemeSelector({ placement }: ThemeSelectorProps) {
  const { theme, setThemeId } = useTheme();
  const selectId = useId();

  return (
    <div className={`items-center gap-2 ${PLACEMENT_CLASS[placement]}`}>
      <label className="text-xs text-ink-muted md:sr-only" htmlFor={selectId}>
        Theme
      </label>
      <select
        id={selectId}
        value={theme.id}
        onChange={(event) => setThemeId(event.target.value)}
        className="min-h-11 rounded-full border border-white/15 bg-white/[0.08] px-4 text-sm font-medium text-white/85 backdrop-blur-xl hover:bg-white/[0.14] md:min-h-0 md:px-3 md:py-1.5 md:text-xs"
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
