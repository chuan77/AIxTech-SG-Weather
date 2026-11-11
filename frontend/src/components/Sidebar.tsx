import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { SearchIcon } from './icons';
import { SidebarCard } from './SidebarCard';
import { AddLocationForm } from './AddLocationForm';

export function Sidebar() {
  const { locations, isLoading, loadError, reload } = useStore();
  const [query, setQuery] = useState('');

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
    <aside className="flex w-full shrink-0 flex-col gap-3 border-b app-sidebar border-white/5 md:w-[22rem] md:border-b-0 md:border-r p-4 backdrop-blur-2xl">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="w-full rounded-lg border border-white/10 bg-white/[0.08] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/50"
        />
      </div>

      <AddLocationForm />

      {loadError && (
        <div
          role="alert"
          className="rounded-card flex items-center justify-between gap-3 border border-white/20 bg-white/[0.08] p-3 text-sm text-white"
        >
          <span>Could not load saved locations: {loadError}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="shrink-0 rounded-lg border border-white/20 px-3 py-1 text-white/90 hover:bg-white/10"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1 md:max-h-none">
        {isLoading && locations.length === 0 ? (
          <p className="rounded-card border border-white/10 bg-white/[0.06] p-4 text-sm text-white/70">
            Loading locations…
          </p>
        ) : filtered.length === 0 && locations.length > 0 ? (
          <p className="rounded-card border border-white/10 bg-white/[0.06] p-4 text-center text-sm text-white/60">
            No matches
          </p>
        ) : filtered.length === 0 && loadError ? null : filtered.length === 0 ? (
          <p className="rounded-card border border-dashed border-white/15 bg-white/[0.04] p-6 text-center text-sm text-white/60">
            No locations yet. Add one above.
          </p>
        ) : (
          filtered.map((location) => (
            <SidebarCard
              key={location.id}
              location={location}
              isHome={location.id === locations[0].id}
            />
          ))
        )}
      </div>
    </aside>
  );
}
