import type { Router } from 'express';
import { Router as createRouter } from 'express';
import { SingaporeLightningClient, type LightningClient } from '../lightning.js';
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
    try {
      response.json(await lightningClient.getRecentLightning());
    } catch (error) {
      if (error instanceof WeatherProviderError) {
        logger.warn({ err: error }, 'lightning refresh failed');
        response.status(502).json({ detail: 'Lightning data is currently unavailable' });
        return;
      }
      next(error);
    }
  });

  return router;
}
