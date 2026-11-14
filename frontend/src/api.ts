import type { CreateLocationPayload, LightningObservation, Location } from './types';

const API_BASE = '/api';

interface LocationsResponse {
  locations: Location[];
}

interface ApiError {
  detail?: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  } catch {
    // fetch only rejects when the request never got a response; the browser's text ("Failed to fetch") means nothing to people.
    throw new Error('The server couldn’t be reached. Check your connection.');
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(error.detail || 'Request failed');
  }
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

export const listLocations = () => request<LocationsResponse>('/locations');

export const createLocation = (payload: CreateLocationPayload) =>
  request<Location>('/locations', { method: 'POST', body: JSON.stringify(payload) });

export const deleteLocation = (id: number) =>
  request<void>(`/locations/${id}`, { method: 'DELETE' });

/** Fire-and-forget delete that survives the page closing (used to flush a pending undo window). */
export function deleteLocationOnUnload(id: number) {
  void fetch(`${API_BASE}/locations/${id}`, { method: 'DELETE', keepalive: true }).catch(() => {});
}

export const refreshLocation = (id: number) =>
  request<Location>(`/locations/${id}/refresh`, { method: 'POST' });

export const refreshLightning = () =>
  request<LightningObservation>('/lightning/refresh', { method: 'POST' });

export function logInteraction(event: string, metadata: object = {}) {
  const page = typeof window === 'undefined' ? undefined : window.location.pathname;
  void fetch(`${API_BASE}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, metadata, page }),
    keepalive: true,
  }).catch(() => {});
}
