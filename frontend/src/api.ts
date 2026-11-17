import type {
  CreateLocationPayload,
  IslandRainObservation,
  LightningObservation,
  Location,
} from './types';

const API_BASE = '/api';

interface LocationsResponse {
  locations: Location[];
}

interface ApiError {
  detail?: string;
}

/** A failed request; `response` is kept so callers can read diagnostics such as Server-Timing. */
class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly response: Response | null,
  ) {
    super(message);
  }
}

async function send(endpoint: string, options: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  } catch {
    // fetch only rejects when the request never got a response; the browser's text ("Failed to fetch") means nothing to people.
    throw new ApiRequestError('The server couldn’t be reached. Check your connection.', null);
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiError;
    throw new ApiRequestError(error.detail || 'Request failed', response);
  }
  return response;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await send(endpoint, options);
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

/** The server's Server-Timing header from a lightning refresh, or null (developer diagnostics). */
export function serverTimingOf(error: unknown): string | null {
  return error instanceof ApiRequestError
    ? (error.response?.headers.get('Server-Timing') ?? null)
    : null;
}

export async function refreshLightning(): Promise<{
  observation: LightningObservation;
  serverTiming: string | null;
}> {
  const response = await send('/lightning/refresh', { method: 'POST' });
  return {
    observation: (await response.json()) as LightningObservation,
    serverTiming: response.headers.get('Server-Timing'),
  };
}

/** Island-wide rain (spec 011): an explicit user action, never called on page load. */
export async function refreshRain(): Promise<{
  observation: IslandRainObservation;
  serverTiming: string | null;
}> {
  const response = await send('/rain/refresh', { method: 'POST' });
  return {
    observation: (await response.json()) as IslandRainObservation,
    serverTiming: response.headers.get('Server-Timing'),
  };
}

export function logInteraction(event: string, metadata: object = {}) {
  const page = typeof window === 'undefined' ? undefined : window.location.pathname;
  void fetch(`${API_BASE}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, metadata, page }),
    keepalive: true,
  }).catch(() => {});
}
