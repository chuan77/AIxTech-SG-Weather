import type { Request, Router } from 'express';
import { Router as createRouter } from 'express';
import {
  createLocation,
  deleteLocation,
  getLocation,
  listLocations,
  updateWeather,
} from '../db.js';
import { SingaporeWeatherClient, WeatherProviderError, type WeatherSnapshot } from '../weather.js';
import { logger } from '../logger.js';
import type { ProviderRequester } from '../providerHttp.js';
import {
  ensureVisitor,
  findVisitor,
  retentionSweep,
  touchVisitor,
  visitorKeyFrom,
} from '../visitors.js';

const NOT_FOUND = { detail: 'Location not found' };

/**
 * The requesting visitor's id (spec 013), or null with no valid key or no saved places yet. A known
 * visitor's use is recorded for the 90-day retention, and the sweep may start in the background;
 * neither delays the response's data. Another visitor's place is answered like a missing one.
 */
async function currentVisitor(request: Request): Promise<number | null> {
  void retentionSweep.maybeSweep();
  const key = visitorKeyFrom(request);
  if (!key) return null;
  const visitorId = await findVisitor(key);
  if (visitorId !== null) await touchVisitor(visitorId);
  return visitorId;
}

export interface WeatherClient {
  getCurrentWeather(latitude: number, longitude: number): Promise<WeatherSnapshot>;
}

interface LocationsRouterOptions {
  weatherClient?: WeatherClient;
  requester?: ProviderRequester;
}

export function createLocationsRouter(options: LocationsRouterOptions = {}): Router {
  const router: Router = createRouter();
  const weatherClient =
    options.weatherClient ??
    new SingaporeWeatherClient({
      apiKey: process.env.WEATHER_API_KEY,
      requester: options.requester,
    });

  router.get('/locations', async (request, response, next) => {
    try {
      const visitorId = await currentVisitor(request);
      response.json({ locations: visitorId === null ? [] : await listLocations(visitorId) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/locations', async (request, response, next) => {
    try {
      const latitude = Number(request.body?.latitude);
      const longitude = Number(request.body?.longitude);

      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        response.status(422).json({ detail: 'latitude and longitude are required' });
        return;
      }
      if (!(1.1 <= latitude && latitude <= 1.5 && 103.6 <= longitude && longitude <= 104.1)) {
        response.status(422).json({
          detail: 'Coordinates must be within Singapore (lat 1.1-1.5, lon 103.6-104.1)',
        });
        return;
      }

      const key = visitorKeyFrom(request);
      if (!key) {
        response.status(400).json({ detail: 'A visitor key is required' });
        return;
      }
      void retentionSweep.maybeSweep();
      const visitorId = await ensureVisitor(key);
      await touchVisitor(visitorId);
      const location = await createLocation(visitorId, latitude, longitude);

      try {
        const snapshot = await weatherClient.getCurrentWeather(
          location.latitude,
          location.longitude,
        );
        const updated = await updateWeather(visitorId, location.id, snapshot);
        response.status(201).json(updated ?? location);
      } catch (error) {
        // The location is already saved (FR-011): any refresh failure leaves it as "not refreshed".
        logger.warn(
          { err: error, locationId: location.id },
          'weather refresh failed after location create',
        );
        response.status(201).json(location);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'DuplicateLocationError') {
        logger.warn({ err: error }, 'duplicate location rejected');
        response.status(409).json({ detail: error.message });
        return;
      }
      next(error);
    }
  });

  router.get('/locations/:locationId', async (request, response, next) => {
    try {
      const visitorId = await currentVisitor(request);
      const location =
        visitorId === null ? null : await getLocation(visitorId, Number(request.params.locationId));
      if (!location) {
        response.status(404).json(NOT_FOUND);
        return;
      }
      response.json(location);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/locations/:locationId', async (request, response, next) => {
    try {
      const locationId = Number(request.params.locationId);
      const visitorId = await currentVisitor(request);
      if (visitorId === null || !Number.isSafeInteger(locationId) || locationId <= 0) {
        response.status(404).json(NOT_FOUND);
        return;
      }

      if (!(await deleteLocation(visitorId, locationId))) {
        response.status(404).json(NOT_FOUND);
        return;
      }

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post('/locations/:locationId/refresh', async (request, response, next) => {
    try {
      const locationId = Number(request.params.locationId);
      const visitorId = await currentVisitor(request);
      const location = visitorId === null ? null : await getLocation(visitorId, locationId);
      if (visitorId === null || !location) {
        response.status(404).json(NOT_FOUND);
        return;
      }

      const snapshot = await weatherClient.getCurrentWeather(location.latitude, location.longitude);
      const updated = await updateWeather(visitorId, locationId, snapshot);
      response.json(updated);
    } catch (error) {
      if (error instanceof WeatherProviderError) {
        response.status(502).json({ detail: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
