import type { Router } from 'express';
import { Router as createRouter } from 'express';
import { logger } from '../logger.js';
import { WeatherProviderError, type ProviderRequester } from '../providerHttp.js';
import { formatServerTiming } from '../serverTiming.js';
import { SingaporeTempWindClient, type TempWindClient, type TempWindTiming } from '../tempWind.js';

interface TempWindRouterOptions {
  tempWindClient?: TempWindClient;
  requester?: ProviderRequester;
}

export function createTempWindRouter(options: TempWindRouterOptions = {}): Router {
  const router: Router = createRouter();
  const tempWindClient =
    options.tempWindClient ??
    new SingaporeTempWindClient({
      apiKey: process.env.WEATHER_API_KEY,
      requester: options.requester,
    });

  // POST (not GET) because this is an explicit user action, never a page-load read.
  router.post('/temp-wind/refresh', async (_request, response, next) => {
    const timing: Partial<TempWindTiming> = {};
    const startedAt = performance.now();
    // Diagnostics for the owner (DevTools); never shown in the UI.
    const sendTiming = () =>
      response.setHeader(
        'Server-Timing',
        formatServerTiming({ ...timing, totalMs: performance.now() - startedAt }),
      );
    try {
      const observation = await tempWindClient.getIslandConditions(undefined, timing);
      sendTiming();
      response.json(observation);
    } catch (error) {
      if (error instanceof WeatherProviderError) {
        sendTiming();
        logger.warn({ err: error }, 'temp-wind refresh failed');
        response.status(502).json({ detail: 'Temperature and wind data is currently unavailable' });
        return;
      }
      next(error);
    }
  });

  return router;
}
