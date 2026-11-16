import pinoHttpModule from 'pino-http';
import type { Logger } from 'pino';

const pinoHttp = pinoHttpModule.default ?? pinoHttpModule;

// Request logs keep only what is needed to debug: no headers and no client address. Behind Vercel the
// headers carry each visitor's IP, city and postcode plus platform tokens (protection bypass, OIDC),
// which must not end up in the logs (spec 010 review).
export function createRequestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    serializers: {
      req: (req: { id?: unknown; method?: string; url?: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
