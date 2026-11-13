import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  listLocations,
  createLocation,
  deleteLocation,
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
  ProviderProps,
  StoreValue,
} from '../types';

const StoreContext = createContext<StoreValue | null>(null);

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

  const effectiveSelectedId = (() => {
    if (locations.length === 0) return null;
    return locations.some((l) => l.id === selectedId) ? selectedId : locations[0].id;
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
      logInteraction('location_refresh_clicked', { locationId: id });
      try {
        await refreshLocation(id);
        await load();
        logInteraction('location_refreshed', { locationId: id });
      } catch (err) {
        setError(err);
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

  const remove = useCallback(async (id: number) => {
    setError(null);
    logInteraction('location_delete_clicked', { locationId: id });
    try {
      await deleteLocation(id);
      setLocations((current) => current.filter((location) => location.id !== id));
      setSelectedId((selected) => (selected === id ? null : selected));
      logInteraction('location_deleted', { locationId: id });
    } catch (err) {
      setError(err);
      logInteraction('location_delete_failed', {
        locationId: id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw err;
    }
  }, []);

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
    locations,
    selectedId: effectiveSelectedId,
    isAdding,
    isLoading,
    refreshingId,
    error,
    loadError,
    select: setSelectedId,
    setAdding: (nextIsAdding) => {
      setIsAdding(nextIsAdding);
      if (nextIsAdding) logInteraction('location_form_opened');
    },
    create,
    remove,
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
