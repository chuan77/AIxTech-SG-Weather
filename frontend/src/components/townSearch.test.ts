import { describe, expect, it } from 'vitest';
import { TOWNS } from './towns';
import { searchTowns } from './townSearch';

const names = (query: string, limit?: number) =>
  searchTowns(query, TOWNS, limit).map((match) => match.town.name);

describe('TOWNS', () => {
  it('holds the 47 NEA two-hour forecast areas', () => {
    expect(TOWNS).toHaveLength(47);
  });

  it('has unique names (case-insensitive) and unique coordinate pairs', () => {
    expect(new Set(TOWNS.map((t) => t.name.toLowerCase())).size).toBe(TOWNS.length);
    expect(new Set(TOWNS.map((t) => `${t.latitude},${t.longitude}`)).size).toBe(TOWNS.length);
  });

  it('keeps every town inside the server Singapore bounds', () => {
    for (const town of TOWNS) {
      expect(town.latitude, town.name).toBeGreaterThanOrEqual(1.1);
      expect(town.latitude, town.name).toBeLessThanOrEqual(1.5);
      expect(town.longitude, town.name).toBeGreaterThanOrEqual(103.6);
      expect(town.longitude, town.name).toBeLessThanOrEqual(104.1);
    }
  });

  it.each([
    ['Woodlands', 1.432, 103.786528],
    ['Sembawang', 1.445, 103.818495],
    ['Sengkang', 1.384, 103.891443],
    ['Punggol', 1.401, 103.904],
    ['Bishan', 1.350772, 103.839],
  ])('includes %s at its NEA reference point', (name, latitude, longitude) => {
    expect(TOWNS.find((t) => t.name === name)).toEqual({ name, latitude, longitude });
  });
});

describe('searchTowns', () => {
  it('returns nothing for empty or whitespace input', () => {
    expect(searchTowns('')).toEqual([]);
    expect(searchTowns('   ')).toEqual([]);
  });

  it('matches the start of a name (tier 1)', () => {
    expect(searchTowns('bish')[0]).toMatchObject({ town: { name: 'Bishan' }, tier: 1 });
  });

  it('matches whole names exactly, ignoring case and surrounding spaces (tier 0)', () => {
    expect(searchTowns('BISHAN')[0]).toMatchObject({ town: { name: 'Bishan' }, tier: 0 });
    expect(searchTowns('  bishan ')[0]).toMatchObject({ town: { name: 'Bishan' }, tier: 0 });
  });

  it('ignores spaces inside names', () => {
    expect(searchTowns('angmokio')[0]).toMatchObject({ town: { name: 'Ang Mo Kio' }, tier: 0 });
    expect(searchTowns('ang mo')[0]).toMatchObject({ town: { name: 'Ang Mo Kio' }, tier: 1 });
  });

  it('matches the start of any word (tier 2)', () => {
    expect(searchTowns('water')).toEqual([
      expect.objectContaining({
        town: expect.objectContaining({ name: 'Central Water Catchment' }),
        tier: 2,
      }),
      expect.objectContaining({
        town: expect.objectContaining({ name: 'Western Water Catchment' }),
        tier: 2,
      }),
    ]);
    // Jurong Island follows as a near match ("island" is one letter short).
    expect(names('islands').slice(0, 2)).toEqual(['Southern Islands', 'Western Islands']);
    expect(searchTowns('islands')[2]).toMatchObject({ town: { name: 'Jurong Island' }, tier: 3 });
  });

  it('returns nothing for text that matches no town', () => {
    expect(searchTowns('zzz')).toEqual([]);
  });

  it('keeps one-letter queries to at most 8 exact or prefix matches', () => {
    const matches = searchTowns('b');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(8);
    for (const match of matches) expect([1, 2]).toContain(match.tier);
  });

  it('sorts by tier then name and honours the limit', () => {
    for (const query of ['b', 'bu', 'jurong', 'water', 'punggole', 's']) {
      const matches = searchTowns(query);
      const sorted = [...matches].sort(
        (a, b) => a.tier - b.tier || a.town.name.localeCompare(b.town.name),
      );
      expect(matches).toEqual(sorted);
      expect(matches.length).toBeLessThanOrEqual(8);
    }
    expect(searchTowns('b', TOWNS, 3)).toHaveLength(3);
  });

  it('finds every town by its full name first (SC-002)', () => {
    for (const town of TOWNS) {
      expect(searchTowns(town.name)[0], town.name).toMatchObject({ town, tier: 0 });
    }
  });

  describe('forgiving matching', () => {
    it.each([
      ['punggole', 'Punggol'],
      ['tampnes', 'Tampines'],
    ])('offers the intended town for the slip %s (tier 3, SC-004)', (query, expected) => {
      const top = searchTowns(query).slice(0, 3);
      expect(top.map((m) => m.town.name)).toContain(expected);
      expect(top.find((m) => m.town.name === expected)?.tier).toBe(3);
    });

    it('treats capitals as an exact match', () => {
      expect(searchTowns('PUNGGOL')[0]).toMatchObject({ town: { name: 'Punggol' }, tier: 0 });
      expect(searchTowns('SEMBAWANG')[0]).toMatchObject({ town: { name: 'Sembawang' }, tier: 0 });
    });

    it('does not fuzzy-match queries shorter than 3 characters', () => {
      expect(searchTowns('pu').some((m) => m.tier === 3)).toBe(false);
    });

    it('ranks exact and prefix matches above near matches', () => {
      expect(searchTowns('bedok')[0]).toMatchObject({ town: { name: 'Bedok' }, tier: 0 });
      const tiers = searchTowns('seng').map((m) => m.tier);
      expect(tiers[0]).toBe(1);
    });
  });
});
