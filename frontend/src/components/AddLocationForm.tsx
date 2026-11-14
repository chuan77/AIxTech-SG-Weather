import { useId, useMemo, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { logInteraction } from '../api';
import { useStore } from '../state/store';
import { PlusIcon } from './icons';
import type { Town } from './towns';
import { searchTowns } from './townSearch';

const INPUT_CLASS =
  'w-full min-w-0 rounded-md border border-white/15 bg-white/10 px-2 py-1.5 text-sm text-white placeholder:text-white/40';

export function AddLocationForm() {
  const { isAdding, setAdding, create } = useStore();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [townQuery, setTownQuery] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pickedTown, setPickedTown] = useState<Town | null>(null);
  const idPrefix = useId();
  const townInputId = `${idPrefix}-town`;
  const listboxId = `${idPrefix}-towns`;
  const optionId = (index: number) => `${idPrefix}-town-${index}`;

  const matches = useMemo(() => searchTowns(townQuery), [townQuery]);
  const hasQuery = townQuery.trim() !== '';
  const showList = listOpen && matches.length > 0;
  const pickedStillMatches =
    pickedTown !== null &&
    latitude === String(pickedTown.latitude) &&
    longitude === String(pickedTown.longitude);

  const clearTown = () => {
    setTownQuery('');
    setPickedTown(null);
    setListOpen(false);
    setActiveIndex(-1);
  };

  const cancel = () => {
    setLatitude('');
    setLongitude('');
    clearTown();
    setSubmitError(null);
    setAdding(false);
  };

  const pick = (town: Town) => {
    setLatitude(String(town.latitude));
    setLongitude(String(town.longitude));
    setTownQuery(town.name);
    setPickedTown(town);
    setListOpen(false);
    setActiveIndex(-1);
    // Log the chosen town only, never the typed search text.
    logInteraction('location_town_picked', { town: town.name });
  };

  const onTownChange = (value: string) => {
    setTownQuery(value);
    setPickedTown(null);
    const next = searchTowns(value);
    setListOpen(value.trim() !== '');
    setActiveIndex(next.length > 0 ? 0 : -1);
  };

  const onTownKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (matches.length === 0) return;
      event.preventDefault();
      setListOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        if (current < 0) return step === 1 ? 0 : matches.length - 1;
        return (current + step + matches.length) % matches.length;
      });
    } else if (event.key === 'Enter') {
      if (showList && activeIndex >= 0 && activeIndex < matches.length) {
        // Enter picks the highlighted town; it must not submit the form.
        event.preventDefault();
        pick(matches[activeIndex].town);
      }
    } else if (event.key === 'Escape') {
      if (listOpen) {
        event.preventDefault();
        setListOpen(false);
      }
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await create({ latitude: Number(latitude), longitude: Number(longitude) });
      setLatitude('');
      setLongitude('');
      clearTown();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not add location');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex w-full items-center justify-center gap-2 rounded-card border border-white/15 bg-white/[0.07] px-3 py-2.5 text-sm font-medium text-white/85 backdrop-blur-xl hover:bg-white/[0.12]"
      >
        <PlusIcon />
        <span>Add Location</span>
      </button>
    );
  }

  const statusText = !hasQuery
    ? ''
    : matches.length === 0
      ? 'No matching town'
      : `${matches.length} ${matches.length === 1 ? 'town' : 'towns'} found`;

  return (
    <form
      onSubmit={onSubmit}
      className="relative z-10 grid gap-2.5 rounded-card border border-white/15 bg-white/[0.1] p-3 backdrop-blur-xl"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
        New coordinate
      </p>
      <div className="relative grid min-w-0 gap-1">
        <label htmlFor={townInputId} className="text-[11px] text-white/60">
          Town
        </label>
        <input
          id={townInputId}
          name="town"
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-activedescendant={showList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          value={townQuery}
          onChange={(e) => onTownChange(e.target.value)}
          onKeyDown={onTownKeyDown}
          onBlur={() => setListOpen(false)}
          onFocus={() => setListOpen(hasQuery && pickedTown === null)}
          placeholder="Search a town, e.g. Sengkang"
          className={INPUT_CLASS}
        />
        {showList && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Matching towns"
            className="app-popover absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-white/15 py-1 shadow-lg shadow-black/30"
          >
            {matches.map((match, index) => (
              <li
                key={match.town.name}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                // mousedown + preventDefault keeps focus so the pick runs before blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(match.town);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-2 py-1.5 text-sm text-white ${
                  index === activeIndex ? 'bg-white/20' : ''
                }`}
              >
                {match.town.name}
              </li>
            ))}
          </ul>
        )}
        <span className="sr-only" aria-live="polite">
          {statusText}
        </span>
        {hasQuery && matches.length === 0 && (
          <p className="text-xs text-white/60">No matching town</p>
        )}
        {pickedStillMatches && pickedTown && (
          <p className="text-xs text-white/60">Town: {pickedTown.name}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid min-w-0 gap-1">
          <span className="text-[11px] text-white/60">Latitude</span>
          <input
            name="latitude"
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => {
              setLatitude(e.target.value);
              setPickedTown(null);
            }}
            placeholder="1.3508"
            required
            className={INPUT_CLASS}
          />
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="text-[11px] text-white/60">Longitude</span>
          <input
            name="longitude"
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => {
              setLongitude(e.target.value);
              setPickedTown(null);
            }}
            placeholder="103.8390"
            required
            className={INPUT_CLASS}
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-white/70 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="app-primary-button rounded-md px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </div>
      {submitError && (
        <p className="rounded-md border border-red-300/30 bg-red-500/15 px-2.5 py-1.5 text-xs text-red-100">
          {submitError}
        </p>
      )}
    </form>
  );
}
