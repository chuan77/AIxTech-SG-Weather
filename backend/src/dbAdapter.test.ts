import type { ResultSet, Row } from '@libsql/client/web';
import { describe, expect, it } from 'vitest';
import { libsqlRowsToValues } from './dbAdapter.js';

/** A libSQL Row is array-like and also carries named keys for each column. */
function row(columns: string[], values: unknown[]): Row {
  const result: Record<string | number, unknown> = { length: values.length };
  values.forEach((value, index) => {
    result[index] = value;
    result[columns[index]] = value;
  });
  return result as unknown as Row;
}

function resultSet(columns: string[], rows: unknown[][]): ResultSet {
  return {
    columns,
    columnTypes: columns.map(() => ''),
    rows: rows.map((values) => row(columns, values)),
    rowsAffected: 0,
    lastInsertRowid: undefined,
    toJSON: () => ({}),
  };
}

const columns = ['id', 'latitude', 'condition'];
const twoRows = resultSet(columns, [
  [1, 1.35, 'Cloudy'],
  [2, 1.29, null],
]);

describe('libsqlRowsToValues', () => {
  it('maps all rows to value arrays in column order, without named keys', () => {
    expect(libsqlRowsToValues(twoRows, 'all')).toEqual({
      rows: [
        [1, 1.35, 'Cloudy'],
        [2, 1.29, null],
      ],
    });
  });

  it('maps values the same way as all', () => {
    expect(libsqlRowsToValues(twoRows, 'values')).toEqual(libsqlRowsToValues(twoRows, 'all'));
  });

  it('returns the first row for get', () => {
    expect(libsqlRowsToValues(twoRows, 'get')).toEqual({ rows: [1, 1.35, 'Cloudy'] });
  });

  it('returns undefined rows for get with no match', () => {
    expect(libsqlRowsToValues(resultSet(columns, []), 'get')).toEqual({ rows: undefined });
  });

  it('returns no rows for run', () => {
    expect(libsqlRowsToValues(twoRows, 'run')).toEqual({ rows: [] });
  });
});
