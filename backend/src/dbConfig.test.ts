import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, resolveDatabaseConfig } from './dbConfig.js';

const CWD = '/srv/app';
const TOKEN = 'sentinel-token-value-123';
const URL = 'libsql://sentinel-db.example.turso.io';

function resolve(env: Record<string, string | undefined>) {
  return resolveDatabaseConfig({ NODE_ENV: 'production', ...env }, CWD);
}

function errorOf(env: Record<string, string | undefined>): ConfigError {
  try {
    resolve(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return error as ConfigError;
  }
  throw new Error('expected a ConfigError');
}

describe('resolveDatabaseConfig', () => {
  it('uses the local file under backend/ when nothing is set', () => {
    expect(resolve({})).toEqual({ kind: 'local', path: join(CWD, 'backend', 'weather.db') });
  });

  it('uses DATABASE_PATH in local mode', () => {
    expect(resolve({ DATABASE_PATH: '/tmp/x.db' })).toEqual({ kind: 'local', path: '/tmp/x.db' });
  });

  it('selects Turso when both URL and token are set', () => {
    expect(resolve({ TURSO_DATABASE_URL: URL, TURSO_AUTH_TOKEN: TOKEN })).toEqual({
      kind: 'turso',
      url: URL,
      authToken: TOKEN,
    });
  });

  it('accepts https and http (local turso dev) URLs', () => {
    for (const url of ['https://db.example.turso.io', 'http://127.0.0.1:8080']) {
      expect(resolve({ TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: TOKEN })).toMatchObject({
        kind: 'turso',
        url,
      });
    }
  });

  it('treats empty and whitespace-only values as unset', () => {
    expect(resolve({ TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '   ' }).kind).toBe('local');
  });

  it('rejects a URL without a token, and a token without a URL', () => {
    for (const env of [{ TURSO_DATABASE_URL: URL }, { TURSO_AUTH_TOKEN: TOKEN }]) {
      expect(errorOf(env).message).toBe(
        'TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set together',
      );
    }
  });

  it('rejects local mode when DATABASE_REQUIRE_REMOTE=true', () => {
    expect(errorOf({ DATABASE_REQUIRE_REMOTE: 'true' }).message).toBe(
      'a hosted database is required here',
    );
  });

  it('allows Turso when DATABASE_REQUIRE_REMOTE=true', () => {
    expect(
      resolve({ DATABASE_REQUIRE_REMOTE: 'true', TURSO_DATABASE_URL: URL, TURSO_AUTH_TOKEN: TOKEN })
        .kind,
    ).toBe('turso');
  });

  it('rejects other URL schemes', () => {
    for (const url of ['file:/tmp/x.db', 'postgres://db', 'not a url']) {
      expect(() => resolve({ TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: TOKEN })).toThrow(
        ConfigError,
      );
    }
  });

  it('refuses a hosted database while running tests', () => {
    expect(
      errorOf({ NODE_ENV: 'test', TURSO_DATABASE_URL: URL, TURSO_AUTH_TOKEN: TOKEN }).message,
    ).toBe('tests must not use a hosted database');
  });

  it('never puts the URL or token in an error message', () => {
    const cases = [
      { TURSO_AUTH_TOKEN: TOKEN },
      { TURSO_DATABASE_URL: URL },
      { TURSO_DATABASE_URL: `ftp://${TOKEN}`, TURSO_AUTH_TOKEN: TOKEN },
      { NODE_ENV: 'test', TURSO_DATABASE_URL: URL, TURSO_AUTH_TOKEN: TOKEN },
    ];
    for (const env of cases) {
      const message = errorOf(env).message;
      expect(message).not.toContain(TOKEN);
      expect(message).not.toContain('sentinel-db');
    }
  });
});
