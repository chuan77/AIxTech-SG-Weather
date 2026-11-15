import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { logInteraction } from '../api';
import { useStore } from '../state/store';
import { PlusIcon } from './icons';
import type { Town } from './towns';
import { searchTowns } from './townSearch';
import { savedNear } from './nearbySaved';

const INPUT_CLASS =
  'min-h-11 w-full min-w-0 rounded-md border border-white/15 bg-white/10 px-2 py-1.5 text-sm text-white placeholder:text-ink-muted md:pointer-fine:min-h-0';

export function AddLocationForm() {
  const { isAdding, setAdding, create, locations, select } = useStore();
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
  const townInputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const formId = `${idPrefix}-form`;
  // Set when the form closes from inside it, so focus goes back to "Add Location", not <body>.
  const returnFocus = useRef(false);

  useEffect(() => {
    if (isAdding) {
      townInputRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      openButtonRef.current?.focus();
    }
  }, [isAdding]);

  const matches = useMemo(() => searchTowns(townQuery), [townQuery]);
  const hasQuery = townQuery.trim() !== '';
  const showList = listOpen && matches.length > 0;
  const pickedStillMatches =
    pickedTown !== null &&
    latitude === String(pickedTown.latitude) &&
    longitude === String(pickedTown.longitude);
  const hasCoordinates = latitude.trim() !== '' && longitude.trim() !== '';
  // A town was typed but not picked, and there are no coordinates to fall back on.
  const needsPick = hasQuery && pickedTown === null && !hasCoordinates;
  const alreadySaved = pickedStillMatches
    ? savedNear(locations, pickedTown.latitude, pickedTown.longitude)
    : null;

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
    returnFocus.current = true;
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
    // Editing a picked town drops its coordinates, so Add can never save a place the field no
    // longer names. Coordinates typed by hand (no pick) are left alone.
    if (pickedStillMatches) {
      setLatitude('');
      setLongitude('');
    }
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
      returnFocus.current = true;
      await create({ latitude: Number(latitude), longitude: Number(longitude) });
      setLatitude('');
      setLongitude('');
      clearTown();
    } catch (err) {
      returnFocus.current = false;
      setSubmitError(err instanceof Error ? err.message : 'Could not add location');
    } finally {
      setSubmitting(false);
    }
  };

  // Stays in the row while the form is open (pressed, and a second press closes it), so the
  // row never reflows under the pointer. Sized from its label so the row wraps, not truncates.
  const openButton = (
    <button
      ref={openButtonRef}
      type="button"
      onClick={() => (isAdding ? cancel() : setAdding(true))}
      aria-expanded={isAdding}
      aria-controls={isAdding ? formId : undefined}
      className={`flex min-h-11 flex-auto items-center justify-center gap-2 whitespace-nowrap rounded-card border px-3 py-2.5 text-sm font-medium backdrop-blur-xl ${
        isAdding
          ? 'border-white/30 bg-white/20 text-white'
          : 'border-white/15 bg-white/[0.07] text-white/85 hover:bg-white/[0.12]'
      }`}
    >
      <PlusIcon />
      <span>Add Location</span>
    </button>
  );

  if (!isAdding) return openButton;

  const statusText = !hasQuery
    ? ''
    : matches.length === 0
      ? 'No matching town'
      : `${matches.length} ${matches.length === 1 ? 'town' : 'towns'} found`;

  return (
    <>
      {openButton}
      <form
        id={formId}
        onSubmit={onSubmit}
        // Escape closes the form, unless the town list took it first to close itself.
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault();
            cancel();
          }
        }}
        // Its own full-width line, after the button row and any "Use my location" message.
        className="relative z-10 order-2 grid basis-full gap-2.5 rounded-card border border-white/15 bg-white/[0.1] p-3 backdrop-blur-xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          New location
        </p>
        <div className="relative grid min-w-0 gap-1">
          <label htmlFor={townInputId} className="text-[11px] text-ink-muted">
            Town
          </label>
          <input
            ref={townInputRef}
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
                  className={`flex min-h-11 cursor-pointer items-center px-2 py-1.5 text-sm text-white md:pointer-fine:min-h-0 ${
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
            <p className="text-xs text-ink-muted">No matching town</p>
          )}
          {needsPick && matches.length > 0 && (
            <p className="text-xs text-ink-muted">
              Pick a town from the list, or enter coordinates.
            </p>
          )}
          {alreadySaved && (
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-white/90">
              <span>{pickedTown?.name} is already saved.</span>
              <button
                type="button"
                onClick={() => {
                  select(alreadySaved.id);
                  cancel();
                }}
                className="min-h-11 font-semibold underline underline-offset-2 md:pointer-fine:min-h-0"
              >
                Show it
              </button>
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid min-w-0 gap-1">
            <span className="text-[11px] text-ink-muted">Latitude</span>
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
            <span className="text-[11px] text-ink-muted">Longitude</span>
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
            className="min-h-11 rounded-md px-3 text-xs font-medium text-ink-muted hover:text-white md:pointer-fine:min-h-0 md:pointer-fine:px-2.5 md:pointer-fine:py-1.5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || needsPick}
            className="app-primary-button min-h-11 rounded-md px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 md:pointer-fine:min-h-0 md:pointer-fine:px-3 md:pointer-fine:py-1.5"
          >
            {submitting ? 'Adding…' : 'Add'}
          </button>
        </div>
        {submitError && (
          <p className="rounded-md app-error px-2.5 py-1.5 text-xs">
            {submitError}
          </p>
        )}
      </form>
    </>
  );
}
