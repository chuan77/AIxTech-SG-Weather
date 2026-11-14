import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Hero } from './Hero';
import { ThemeSelector } from './ThemeSelector';
import { DeleteToast } from './DeleteToast';
import { PhoneDock } from './PhoneDock';
import { useSelectedLocation } from '../state/store';
import { applySky, skyState } from '../theme/sky';
import { readingFreshness } from './freshness';
import { useNow } from './map/useNow';

export function Layout() {
  // The Singapore theme paints the selected location's sky; other themes ignore data-sky.
  const weather = useSelectedLocation()?.weather;
  const now = useNow(60_000, weather?.observed_at);
  // A stale reading can't vouch for the sky now, so it paints calm, the same as a missing one.
  const isStale = readingFreshness(weather?.observed_at, now).kind === 'stale';
  const sky = skyState(isStale ? null : weather);
  useEffect(() => applySky(sky), [sky]);

  return (
    // Below md the document scrolls as one page; from md up the sidebar and main panel scroll independently.
    <div className="flex min-h-full w-full flex-col md:h-full md:flex-row">
      {/* Keyboard users skip the search, the form and every saved card. */}
      <a
        href="#weather"
        className="app-popover sr-only rounded-full border border-white/15 text-sm font-medium text-white shadow-lg shadow-black/30 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:px-4 focus:py-2"
      >
        Skip to weather
      </a>
      <Sidebar />
      <Hero />
      <ThemeSelector placement="page-end" />
      <PhoneDock />
      <DeleteToast />
    </div>
  );
}
