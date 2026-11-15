import type { Router } from 'express';
import { Router as createRouter } from 'express';
import {
  SingaporeLightningClient,
  type LightningClient,
  type LightningTiming,
} from '../lightning.js';
import { formatServerTiming } from '../serverTiming.js';
import { WeatherProviderError, type ProviderRequester } from '../providerHttp.js';
import { logger } from '../logger.js';

interface LightningRouterOptions {
  lightningClient?: LightningClient;
  requester?: ProviderRequester;
}

export function createLightningRouter(options: LightningRouterOptions = {}): Router {
  const router: Router = createRouter();
  const lightningClient =
    options.lightningClient ??
    new SingaporeLightningClient({
      apiKey: process.env.WEATHER_API_KEY,
      requester: options.requester,
    });

  // POST (not GET) because this is an explicit user action, never a page-load read.
  router.post('/lightning/refresh', async (_request, response, next) => {
    const timing: Partial<LightningTiming> = {};
    const startedAt = performance.now();
    // Diagnostics for the owner (DevTools and the browser's timing log); never shown in the UI.
    const sendTiming = () =>
      response.setHeader(
        'Server-Timing',
        formatServerTiming({ ...timing, totalMs: performance.now() - startedAt }),
      );
    try {
      const observation = await lightningClient.getRecentLightning(undefined, timing);
      sendTiming();
      response.json(observation);
    } catch (error) {
      if (error instanceof WeatherProviderError) {
        sendTiming();
        logger.warn({ err: error }, 'lightning refresh failed');
        response.status(502).json({ detail: 'Lightning data is currently unavailable' });
        return;
      }
      next(error);
    }
  });

  return router;
}
