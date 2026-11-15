import { describe, expect, it } from 'vitest';
import type { BulkRefresh } from '../types';
import { bulkRefreshMessage, joinPlaceNames } from './RefreshAll';

describe('joinPlaceNames', () => {
  it('names up to three places and counts the rest', () => {
    expect(joinPlaceNames([])).toBe('');
    expect(joinPlaceNames(['Bishan'])).toBe('Bishan');
    expect(joinPlaceNames(['Bishan', 'Jurong West'])).toBe('Bishan and Jurong West');
    expect(joinPlaceNames(['Bishan', 'Jurong West', 'Tampines'])).toBe(
      'Bishan, Jurong West and Tampines',
    );
    expect(joinPlaceNames(['Bishan', 'Jurong West', 'Tampines', 'Changi'])).toBe(
      'Bishan, Jurong West and 2 more',
    );
  });
});

describe('bulkRefreshMessage', () => {
  const run = (over: Partial<BulkRefresh>): BulkRefresh => ({
    status: 'done',
    total: 3,
    done: 3,
    failed: [],
    ...over,
  });

  it('counts progress, then reports the result', () => {
    expect(bulkRefreshMessage(null)).toBe('');
    expect(bulkRefreshMessage(run({ status: 'running', done: 0 }))).toBe('Refreshing 1 of 3…');
    expect(bulkRefreshMessage(run({}))).toBe('Refreshed 3 places.');
    expect(bulkRefreshMessage(run({ status: 'stopped', done: 1 }))).toBe('Stopped after 1 of 3.');
  });

  it('names failed places', () => {
    const failed = [{ id: 2, name: 'Bishan', message: 'timeout' }];
    expect(bulkRefreshMessage(run({ failed }))).toBe('Couldn’t refresh Bishan. 2 of 3 updated.');
  });
});
