import type { Router } from 'express';
import { Router as createRouter } from 'express';
import { logger } from '../logger.js';
import { WeatherProviderError, type ProviderRequester } from '../providerHttp.js';
import { SingaporeRainClient, type RainClient, type RainTiming } from '../rain.js';
import { formatServerTiming } from '../serverTiming.js';

interface RainRouterOptions {
  rainClient?: RainClient;
  requester?: ProviderRequester;
}

export function createRainRouter(options: RainRouterOptions = {}): Router {
  const router: Router = createRouter();
  const rainClient =
    options.rainClient ??
    new SingaporeRainClient({
      apiKey: process.env.WEATHER_API_KEY,
      requester: options.requester,
    });

  // POST (not GET) because this is an explicit user action, never a page-load read.
  router.post('/rain/refresh', async (_request, response, next) => {
    const timing: Partial<RainTiming> = {};
    const startedAt = performance.now();
    // Diagnostics for the owner (DevTools and the browser's timing log); never shown in the UI.
    const sendTiming = () =>
      response.setHeader(
        'Server-Timing',
        formatServerTiming({ ...timing, totalMs: performance.now() - startedAt }),
      );
    try {
      const observation = await rainClient.getRecentRain(undefined, timing);
      sendTiming();
      response.json(observation);
    } catch (error) {
      if (error instanceof WeatherProviderError) {
        sendTiming();
        logger.warn({ err: error }, 'rain refresh failed');
        response.status(502).json({ detail: 'Rain data is currently unavailable' });
        return;
      }
      next(error);
    }
  });

  return router;
}
