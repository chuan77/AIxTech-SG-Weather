import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createClient, type ResultSet } from '@libsql/client/web';

export type QueryMethod = 'run' | 'all' | 'values' | 'get';

/** What `db.ts` needs from a store: the shape Drizzle's sqlite-proxy driver expects. */
export interface DatabaseAdapter {
  /** One query. Rows are value arrays in column order; `get` with no match gives undefined rows. */
  query(sql: string, params: unknown[], method: QueryMethod): Promise<{ rows: unknown[] }>;
  /** Runs statements in order as one unit (used by the migrator). */
  batch(statements: string[]): Promise<void>;
  /** Runs one raw statement with no result. */
  execute(sql: string): Promise<void>;
  close(): void;
}

/** Local file through Node's built-in SQLite (development, tests, e2e). */
export function createLocalAdapter(path: string): DatabaseAdapter {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA journal_mode = WAL');

  return {
    async query(sql, params, method) {
      const statement = sqlite.prepare(sql);
      const bindings = params as never[];
      if (method === 'run') {
        statement.run(...bindings);
        return { rows: [] };
      }
      if (method === 'get') {
        const row = statement.get(...bindings) as Record<string, unknown> | undefined;
        return { rows: row ? Object.values(row) : (undefined as unknown as unknown[]) };
      }
      const rows = statement.all(...bindings) as Record<string, unknown>[];
      return { rows: rows.map((row) => Object.values(row)) };
    },
    async batch(statements) {
      for (const statement of statements) sqlite.exec(statement);
    },
    async execute(sql) {
      sqlite.exec(sql);
    },
    close() {
      sqlite.close();
    },
  };
}

/** Hosted Turso database over HTTP (pure JS, no native module). */
export function createTursoAdapter(url: string, authToken: string): DatabaseAdapter {
  const client = createClient({ url, authToken });

  return {
    async query(sql, params, method) {
      const result = await client.execute({ sql, args: params as never[] });
      return libsqlRowsToValues(result, method);
    },
    async batch(statements) {
      if (statements.length > 0) await client.batch(statements, 'write');
    },
    async execute(sql) {
      await client.execute(sql);
    },
    close() {
      client.close();
    },
  };
}

/**
 * Converts a libSQL result to sqlite-proxy rows. A libSQL Row also carries named keys, so values
 * are read by column index rather than with Object.values.
 */
export function libsqlRowsToValues(result: ResultSet, method: QueryMethod): { rows: unknown[] } {
  if (method === 'run') return { rows: [] };
  const toValues = (row: ResultSet['rows'][number]) => result.columns.map((_, index) => row[index]);
  if (method === 'get') {
    const first = result.rows[0];
    return { rows: first ? toValues(first) : (undefined as unknown as unknown[]) };
  }
  return { rows: result.rows.map(toValues) };
}
