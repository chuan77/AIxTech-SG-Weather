export interface ListenConfig {
  host: string;
  port: number;
}

/**
 * Where the server listens. Locally it stays on loopback; the container image sets HOST=0.0.0.0
 * so the hosting platform can reach it, and PORT to the port the platform routes to.
 */
export function resolveListenConfig(env: NodeJS.ProcessEnv): ListenConfig {
  const host = env.HOST?.trim() || '127.0.0.1';
  const rawPort = env.PORT?.trim() || '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
    throw new Error('PORT must be a whole number from 1 to 65535');
  }
  return { host, port };
}
