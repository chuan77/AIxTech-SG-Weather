import { join } from 'node:path';

/** A database setting is missing, partial or invalid. Messages name variables, never values. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export type DatabaseConfig =
  | { kind: 'local'; path: string }
  | { kind: 'turso'; url: string; authToken: string };

const TURSO_SCHEMES = new Set(['libsql:', 'https:', 'http:']);

function setting(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Chooses where saved locations live. Both Turso settings select the hosted database; neither
 * selects the local file (`DATABASE_PATH` or `backend/weather.db`). Anything in between, a
 * required remote that is missing, or a hosted database under tests is a ConfigError.
 */
export function resolveDatabaseConfig(env: NodeJS.ProcessEnv, cwd: string): DatabaseConfig {
  const url = setting(env.TURSO_DATABASE_URL);
  const authToken = setting(env.TURSO_AUTH_TOKEN);

  if (Boolean(url) !== Boolean(authToken)) {
    throw new ConfigError('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set together');
  }

  if (url && authToken) {
    let scheme: string;
    try {
      scheme = new URL(url).protocol;
    } catch {
      throw new ConfigError('TURSO_DATABASE_URL is not a valid URL');
    }
    if (!TURSO_SCHEMES.has(scheme)) {
      throw new ConfigError('TURSO_DATABASE_URL must start with libsql://, https:// or http://');
    }
    if (env.NODE_ENV === 'test') {
      throw new ConfigError('tests must not use a hosted database');
    }
    return { kind: 'turso', url, authToken };
  }

  if (setting(env.DATABASE_REQUIRE_REMOTE) === 'true') {
    throw new ConfigError('a hosted database is required here');
  }

  return { kind: 'local', path: setting(env.DATABASE_PATH) ?? join(cwd, 'backend', 'weather.db') };
}
