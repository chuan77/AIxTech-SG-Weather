import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  listLocations,
  createLocation,
  deleteLocation,
  deleteLocationOnUnload,
  refreshLocation,
  refreshLightning,
  logInteraction,
} from '../api';
import {
  isFresh,
  LIGHTNING_STORAGE_KEY,
  parseEnabled,
  serialiseEnabled,
} from '../components/map/lightningHelpers';
import type {
  CreateLocationPayload,
  LightningObservation,
  LightningStatus,
  Location,
  LocationError,
  PendingDelete,
  ProviderProps,
  StoreValue,
} from '../types';

const StoreContext = createContext<StoreValue | null>(null);

/** How long a deleted location can be brought back before the server delete is sent. */
export const UNDO_DELETE_MS = 6000;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function locationName(location: Location): string {
  return (
    location.weather?.area || `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`
  );
}

function readLightningEnabled(): boolean {
  try {
    return parseEnabled(window.localStorage.getItem(LIGHTNING_STORAGE_KEY));
  } catch {
    return true;
  }
}

function writeLightningEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(LIGHTNING_STORAGE_KEY, serialiseEnabled(enabled));
  } catch {
    // Storage can be blocked; the choice then only lasts for this page session.
  }
}

export function StoreProvider({ children }: ProviderProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<LocationError | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingDeleteRef = useRef<{ id: number; wasSelected: boolean } | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lightningEnabled, setLightningEnabled] = useState(readLightningEnabled);
  const [lightningStatus, setLightningStatus] = useState<LightningStatus>('idle');
  const [lightningObservation, setLightningObservation] = useState<LightningObservation | null>(null);
  const lightningObservationRef = useRef<LightningObservation | null>(null);
  const lightningInFlightRef = useRef(false);

  const load = useCallback(async (): Promise<Location[]> => {
    try {
      const data = await listLocations();
      setLocations(data.locations);
      setError(null);
      setLoadError(null);
      return data.locations;
    } catch (err) {
      // Keep the locations already on screen; a failed load must not look like an empty list.
      setError(err);
      setLoadError(err instanceof Error ? err.message : 'Request failed');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load-on-mount syncs API → React state
    load().then((next) => {
      if (next.length > 0) setSelectedId((current) => current ?? next[0].id);
    });
  }, [load]);

  // A location waiting out its undo window is hidden everywhere but still held in state.
  const hiddenId = pendingDelete?.status === 'pending' ? pendingDelete.id : null;
  const visibleLocations =
    hiddenId === null ? locations : locations.filter((location) => location.id !== hiddenId);

  const effectiveSelectedId = (() => {
    if (visibleLocations.length === 0) return null;
    return visibleLocations.some((l) => l.id === selectedId) ? selectedId : visibleLocations[0].id;
  })();

  const create = useCallback(
    async (payload: CreateLocationPayload) => {
      setError(null);
      logInteraction('location_create_submitted', payload);
      try {
        const created = await createLocation(payload);
        const next = await load();
        const targetId = created?.id ?? next[next.length - 1]?.id;
        if (targetId) setSelectedId(targetId);
        setIsAdding(false);
        logInteraction('location_created', {
          locationId: targetId,
          latitude: created.latitude,
          longitude: created.longitude,
        });
      } catch (err) {
        setError(err);
        logInteraction('location_create_failed', {
          latitude: payload.latitude,
          longitude: payload.longitude,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        throw err;
      }
    },
    [load],
  );

  const refresh = useCallback(
    async (id: number) => {
      setRefreshingId(id);
      setError(null);
      setRefreshError(null);
      logInteraction('location_refresh_clicked', { locationId: id });
      try {
        await refreshLocation(id);
        await load();
        logInteraction('location_refreshed', { locationId: id });
      } catch (err) {
        setError(err);
        setRefreshError({ id, message: errorMessage(err, 'Could not reach the weather service.') });
        logInteraction('location_refresh_failed', {
          locationId: id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setRefreshingId(null);
      }
    },
    [load],
  );

  const clearDeleteTimer = useCallback(() => {
    if (deleteTimerRef.current !== null) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
  }, []);

  // Sends the delete for the location in its undo window. On failure the location reappears
  // and the toast switches to an error, so nothing is lost silently.
  const commitDelete = useCallback(() => {
    clearDeleteTimer();
    const entry = pendingDeleteRef.current;
    if (!entry) return;
    pendingDeleteRef.current = null;
    const { id } = entry;
    deleteLocation(id)
      .then(() => {
        setLocations((current) => current.filter((location) => location.id !== id));
        setPendingDelete((current) => (current?.id === id ? null : current));
        logInteraction('location_deleted', { locationId: id });
      })
      .catch((err) => {
        setError(err);
        setPendingDelete((current) =>
          current?.id === id
            ? { ...current, status: 'failed', message: errorMessage(err, 'Request failed') }
            : current,
        );
        logInteraction('location_delete_failed', {
          locationId: id,
          error: errorMessage(err, 'Unknown error'),
        });
      });
  }, [clearDeleteTimer]);

  const startDeleteTimer = useCallback(() => {
    clearDeleteTimer();
    deleteTimerRef.current = setTimeout(commitDelete, UNDO_DELETE_MS);
  }, [clearDeleteTimer, commitDelete]);

  const remove = useCallback(
    (id: number) => {
      const location = locations.find((l) => l.id === id);
      if (!location) return;
      // Only one delete waits at a time; a second delete sends the first straight away.
      if (pendingDeleteRef.current) commitDelete();
      setError(null);
      logInteraction('location_delete_clicked', { locationId: id });
      pendingDeleteRef.current = { id, wasSelected: effectiveSelectedId === id };
      setPendingDelete({ id, name: locationName(location), status: 'pending' });
      if (effectiveSelectedId === id) setSelectedId(null);
      startDeleteTimer();
    },
    [locations, effectiveSelectedId, commitDelete, startDeleteTimer],
  );

  const undoDelete = useCallback(() => {
    const entry = pendingDeleteRef.current;
    clearDeleteTimer();
    pendingDeleteRef.current = null;
    setPendingDelete(null);
    if (!entry) return;
    if (entry.wasSelected) setSelectedId(entry.id);
    logInteraction('location_delete_undone', { locationId: entry.id });
  }, [clearDeleteTimer]);

  const dismissDelete = useCallback(() => {
    if (pendingDeleteRef.current) commitDelete();
    else setPendingDelete(null);
  }, [commitDelete]);

  const holdDelete = useCallback(
    (held: boolean) => {
      if (!pendingDeleteRef.current) return;
      if (held) clearDeleteTimer();
      else startDeleteTimer();
    },
    [clearDeleteTimer, startDeleteTimer],
  );

  // Closing the tab inside the undo window still deletes: the user asked for it.
  useEffect(() => {
    const flush = () => {
      const entry = pendingDeleteRef.current;
      if (!entry) return;
      pendingDeleteRef.current = null;
      clearDeleteTimer();
      deleteLocationOnUnload(entry.id);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      clearDeleteTimer();
    };
  }, [clearDeleteTimer]);

  // Lightning is island-wide and fetched only on a user action (never on mount); see constitution I.
  const refreshLightningData = useCallback(async () => {
    if (lightningInFlightRef.current) return;
    if (isFresh(lightningObservationRef.current, Date.now())) return;

    lightningInFlightRef.current = true;
    setLightningStatus('loading');
    logInteraction('lightning_refreshed');
    try {
      const next = await refreshLightning();
      lightningObservationRef.current = next;
      setLightningObservation(next);
      if (next.stale) setLightningStatus('unavailable');
      else setLightningStatus(next.strikes.length > 0 ? 'ok' : 'empty');
    } catch {
      // Keep any strikes loaded earlier on screen; only the status changes.
      setLightningStatus('unavailable');
    } finally {
      lightningInFlightRef.current = false;
    }
  }, []);

  const setLightningEnabledAndLoad = useCallback(
    (enabled: boolean) => {
      setLightningEnabled(enabled);
      writeLightningEnabled(enabled);
      logInteraction('lightning_toggled', { enabled });
      if (enabled) void refreshLightningData();
    },
    [refreshLightningData],
  );

  const value: StoreValue = {
    locations: visibleLocations,
    selectedId: effectiveSelectedId,
    isAdding,
    isLoading,
    refreshingId,
    error,
    loadError,
    refreshError,
    pendingDelete,
    select: setSelectedId,
    setAdding: (nextIsAdding) => {
      setIsAdding(nextIsAdding);
      if (nextIsAdding) logInteraction('location_form_opened');
    },
    create,
    remove,
    undoDelete,
    dismissDelete,
    holdDelete,
    refresh,
    reload: async () => {
      const next = await load();
      if (next.length > 0) setSelectedId((current) => current ?? next[0].id);
    },
    lightning: {
      enabled: lightningEnabled,
      status: lightningStatus,
      observation: lightningObservation,
      setEnabled: setLightningEnabledAndLoad,
      refresh: refreshLightningData,
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function useSelectedLocation(): Location | null {
  const { locations, selectedId } = useStore();
  return locations.find((l) => l.id === selectedId) ?? null;
}
