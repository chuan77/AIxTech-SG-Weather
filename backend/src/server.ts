import 'dotenv/config';
import compression from 'compression';
import express from 'express';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLocationsRouter, type WeatherClient } from './routes/locations.js';
import { createLightningRouter } from './routes/lightning.js';
import { createRainRouter } from './routes/rain.js';
import type { LightningClient } from './lightning.js';
import type { RainClient } from './rain.js';
import { createFixtureRainClient } from './rainFixture.js';
import {
  createBusyLightningClient,
  createFixtureLightningClient,
  createStormLightningClient,
} from './lightningFixture.js';
import { resolveListenConfig } from './listenConfig.js';
import { logger } from './logger.js';
import { createRequestLogger } from './requestLogging.js';
import { renderIndexHtml } from './indexHtml.js';
import { resolveAnalyticsMode } from './analyticsMode.js';
import { ProviderRequester } from './providerHttp.js';
import { createRateLimiter } from './rateLimit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_EVENT_PATTERN = /^[a-z][a-z0-9_.:-]{1,63}$/;
const MAX_LOG_METADATA_BYTES = 2048;

interface AppOptions {
  serveFrontend?: boolean;
  enableRequestLogging?: boolean;
  /** Per-device limits on routes that spend the data.gov.sg key and on /api/logs. From RATE_LIMITS=on by default. */
  enableRateLimits?: boolean;
  /** Proxy hops to trust for the client address (Express `trust proxy`). From TRUST_PROXY by default. */
  trustProxyHops?: number;
  weatherClient?: WeatherClient;
  lightningClient?: LightningClient;
  rainClient?: RainClient;
}

export async function createApp(options: AppOptions = {}) {
  const app = express();
  const serveFrontend = options.serveFrontend ?? process.env.NODE_ENV !== 'test';
  const enableRequestLogging = options.enableRequestLogging ?? process.env.NODE_ENV !== 'test';
  // On in the container image (RATE_LIMITS=on), where the URL is public; off for local dev and e2e.
  const enableRateLimits = options.enableRateLimits ?? process.env.RATE_LIMITS === 'on';
  const trustProxyHops = options.trustProxyHops ?? Number(process.env.TRUST_PROXY);
  if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
    // Behind Vercel the client address arrives in X-Forwarded-For (the container image sets 1).
    app.set('trust proxy', trustProxyHops);
  }

  if (enableRequestLogging) {
    app.use(createRequestLogger(logger));
  }

  // gzip or brotli when the browser accepts it: a storm's lightning window is about 6.4 MB as plain
  // JSON and about 0.5 MB compressed (spec 009). The body itself is unchanged.
  app.use(compression());
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.json({ status: 'healthy' });
  });

  if (enableRateLimits || app.get('trust proxy')) {
    logger.info(
      { rateLimits: enableRateLimits, trustProxy: app.get('trust proxy') },
      'public limits',
    );
  }
  if (enableRateLimits) {
    // The public URL lets anyone trigger weather fetches, and each one makes about 12 data.gov.sg
    // calls on the shared key. 30 per device per 10 minutes covers refreshing ten places three times.
    const weatherLimit = createRateLimiter({
      windowMs: 10 * 60_000,
      max: 30,
      detail: 'Too many weather updates from this device. Try again in a few minutes.',
    });
    app.post(['/api/locations', '/api/locations/:locationId/refresh'], weatherLimit);
    app.post(
      '/api/logs',
      createRateLimiter({ windowMs: 60_000, max: 60, detail: 'Too many log events' }),
    );
  }

  app.post('/api/logs', (request, response) => {
    const event = request.body?.event;
    const metadata = request.body?.metadata;
    if (typeof event !== 'string' || !FRONTEND_EVENT_PATTERN.test(event)) {
      response.status(422).json({ detail: 'event is required' });
      return;
    }
    if (metadata !== undefined && JSON.stringify(metadata).length > MAX_LOG_METADATA_BYTES) {
      response.status(413).json({ detail: 'metadata is too large' });
      return;
    }
    logger.info(
      {
        source: 'frontend',
        event,
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
        page: typeof request.body?.page === 'string' ? request.body.page : undefined,
      },
      'frontend interaction',
    );
    response.status(204).end();
  });

  let lightningClient = options.lightningClient;
  if (
    !lightningClient &&
    process.env.LIGHTNING_FIXTURE === 'demo' &&
    process.env.NODE_ENV !== 'production'
  ) {
    logger.warn('LIGHTNING_FIXTURE=demo: serving fake lightning strikes (development only)');
    lightningClient = createFixtureLightningClient();
  }
  if (
    !lightningClient &&
    process.env.LIGHTNING_FIXTURE === 'busy' &&
    process.env.NODE_ENV !== 'production'
  ) {
    logger.warn('LIGHTNING_FIXTURE=busy: serving ~370 fake lightning strikes (development only)');
    lightningClient = createBusyLightningClient();
  }
  if (
    !lightningClient &&
    process.env.LIGHTNING_FIXTURE === 'storm' &&
    process.env.NODE_ENV !== 'production'
  ) {
    logger.warn(
      'LIGHTNING_FIXTURE=storm: serving the 2026-11-16 storm (37,242 strikes, development only)',
    );
    lightningClient = createStormLightningClient();
  }

  let rainClient = options.rainClient;
  if (!rainClient && process.env.RAIN_FIXTURE === 'demo' && process.env.NODE_ENV !== 'production') {
    logger.warn('RAIN_FIXTURE=demo: serving fake rain readings (development only)');
    rainClient = createFixtureRainClient();
  }

  // The provider's rate limit is per key, so every default client shares one paced requester.
  const requester =
    !options.weatherClient || !lightningClient || !rainClient
      ? new ProviderRequester({ apiKey: process.env.WEATHER_API_KEY })
      : undefined;
  app.use('/api', createLocationsRouter({ weatherClient: options.weatherClient, requester }));
  app.use('/api', createLightningRouter({ lightningClient, requester }));
  // No per-device limiter here, as for lightning: the rain client's 2-minute shared cache already
  // caps data.gov.sg at one rain fetch per 2 minutes, and a failure is remembered for 2 minutes too.
  app.use('/api', createRainRouter({ rainClient, requester }));

  if (serveFrontend) {
    if (process.env.NODE_ENV === 'production') {
      const staticPath = resolve(__dirname, '..', '..', 'frontend', 'dist');
      // index.html is never served as a static file: it gets runtime settings (the map key) first.
      const indexHtml = renderIndexHtml(readFileSync(resolve(staticPath, 'index.html'), 'utf8'));
      // Logs the mode only (and the rejected WEB_ANALYTICS value), never other settings.
      const analytics = resolveAnalyticsMode();
      if (analytics.invalid !== undefined) {
        logger.warn(
          `WEB_ANALYTICS=${analytics.invalid} is not on, off or notice-only; measurement is off`,
        );
      }
      logger.info(
        { webAnalytics: analytics.mode, vercel: process.env.VERCEL === '1' },
        'web analytics mode',
      );
      app.get('/index.html', (_request, response) => {
        response.type('html').send(indexHtml);
      });
      app.use(express.static(staticPath, { index: false }));
      app.get('*', (_request, response) => {
        response.type('html').send(indexHtml);
      });
    } else {
      const { createServer } = await import('vite');
      const vite = await createServer({
        root: resolve(__dirname, '..', '..', 'frontend'),
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }
  }

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error({ err: error }, 'request failed');
      response.status(500).json({ detail: 'Internal server error' });
    },
  );

  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { host, port } = resolveListenConfig(process.env);
  const app = await createApp();

  const server = app.listen(port, host, () => {
    logger.info({ url: `http://${host}:${port}` }, 'Weather Starter listening');
  });

  // Spec 013: remove lists unused for 90 days once at start, then at most every 6 hours on use.
  // In the background; a failure is logged and retried later. Tests never reach this block.
  const { retentionSweep } = await import('./visitors.js');
  void retentionSweep.maybeSweep();

  // The hosting platform sends SIGTERM before stopping an idle or replaced instance and allows
  // 30 s: stop taking requests, let in-flight ones finish, close the database, exit. Ctrl+C
  // (SIGINT) keeps Node's default so local development stops at once.
  process.once('SIGTERM', () => {
    logger.info('shutting down');
    setTimeout(() => process.exit(1), 25_000).unref();
    server.close(async () => {
      const { closeDatabase } = await import('./db.js');
      closeDatabase();
      process.exit(0);
    });
    server.closeIdleConnections();
  });
}
