import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { SearchIcon } from './icons';
import { SidebarCard } from './SidebarCard';
import { AddLocationForm } from './AddLocationForm';
import { UseMyLocation } from './UseMyLocation';
import { InstallHint } from './InstallHint';
import { useNow } from './map/useNow';
import { RefreshAll } from './RefreshAll';

export function Sidebar() {
  const { locations, isLoading, loadError, reload } = useStore();
  const [query, setQuery] = useState('');
  // One clock for every card, so a reading turns stale on screen without a refresh.
  const now = useNow(60_000);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((location) => {
      const area = location.weather.area?.toLowerCase() ?? '';
      const condition = location.weather.condition?.toLowerCase() ?? '';
      return area.includes(q) || condition.includes(q);
    });
  }, [locations, query]);

  return (
    <aside
      // A named landmark, not a heading: the page's first heading is the place's h1.
      aria-label="Saved locations"
      className="flex w-full shrink-0 flex-col gap-3 border-b app-sidebar border-white/5 md:w-[22rem] md:border-b-0 md:border-r p-4 backdrop-blur-2xl"
    >
      {/* Phones switch places from the bottom dock, so this filter for the card list is desktop-only. */}
      <div className="relative hidden md:block">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search saved locations"
          className="min-h-11 w-full rounded-lg border border-white/10 bg-white/[0.08] py-2 pl-9 pr-3 text-sm text-white placeholder:text-ink-muted md:pointer-fine:min-h-0"
        />
      </div>

      {/* Two ways in, side by side: the browser's position, or a town / coordinates. */}
      <div className="flex flex-wrap gap-2">
        <UseMyLocation />
        <AddLocationForm />
        {/* iPhone/iPad Safari only (spec 014): in the row, so phones see it too. */}
        <InstallHint savedCount={locations.length} />
      </div>

      <RefreshAll placement="sidebar" now={now} />

      {loadError && (
        <div
          role="alert"
          className="rounded-card flex items-center justify-between gap-3 border border-white/20 bg-white/[0.08] p-3 text-sm text-white"
        >
          <span>Could not load saved locations: {loadError}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="min-h-11 shrink-0 rounded-lg border border-white/20 px-3 py-1 text-white/90 hover:bg-white/10 md:pointer-fine:min-h-0"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 md:overflow-y-auto md:pr-1">
        {isLoading && locations.length === 0 ? (
          <p className="rounded-card shrink-0 border border-white/10 bg-white/[0.06] p-4 text-sm text-ink-muted">
            Loading locations…
          </p>
        ) : filtered.length === 0 && locations.length > 0 ? (
          <p className="rounded-card shrink-0 border border-white/10 bg-white/[0.06] p-4 text-center text-sm text-ink-muted">
            No matches
          </p>
        ) : filtered.length === 0 && loadError ? null : filtered.length === 0 ? (
          <p className="rounded-card shrink-0 border border-dashed border-white/15 bg-white/[0.04] p-6 text-center text-sm text-ink-muted">
            No locations yet. Add one above.
          </p>
        ) : (
          filtered.map((location) => (
            <div key={location.id} className="hidden shrink-0 md:block">
              <SidebarCard location={location} isHome={location.id === locations[0].id} now={now} />
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
