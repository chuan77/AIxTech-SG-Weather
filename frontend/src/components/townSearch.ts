import { TOWNS, type Town } from './towns';

// 0 exact, 1 name prefix, 2 word prefix, 3 near match (one letter wrong, missing or extra).
export type MatchTier = 0 | 1 | 2 | 3;

export interface TownMatch {
  town: Town;
  tier: MatchTier;
}

const FUZZY_MIN_LENGTH = 3;

function normalise(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function compact(text: string): string {
  return text.replace(/ /g, '');
}

// Plain Levenshtein distance; inputs are short town names, so the O(n*m) table is fine.
function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length];
}

// True when `query` is within one edit of `target` or of a prefix of it.
function nearlyStartsWith(target: string, query: string): boolean {
  for (let length = query.length - 1; length <= query.length + 1; length += 1) {
    if (length < 1 || length > target.length) continue;
    if (levenshtein(query, target.slice(0, length)) <= 1) return true;
  }
  return false;
}

function tierFor(town: Town, query: string, compactQuery: string): MatchTier | null {
  const name = normalise(town.name);
  const compactName = compact(name);

  if (name === query || compactName === compactQuery) return 0;
  if (name.startsWith(query) || compactName.startsWith(compactQuery)) return 1;
  if (name.includes(` ${query}`)) return 2;

  if (compactQuery.length >= FUZZY_MIN_LENGTH) {
    const targets = [compactName, ...name.split(' ')];
    if (targets.some((target) => nearlyStartsWith(target, compactQuery))) return 3;
  }
  return null;
}

export function searchTowns(query: string, towns: readonly Town[] = TOWNS, limit = 8): TownMatch[] {
  const normalised = normalise(query);
  if (!normalised) return [];
  const compactQuery = compact(normalised);

  const matches: TownMatch[] = [];
  for (const town of towns) {
    const tier = tierFor(town, normalised, compactQuery);
    if (tier !== null) matches.push({ town, tier });
  }

  return matches
    .sort((a, b) => a.tier - b.tier || a.town.name.localeCompare(b.town.name))
    .slice(0, limit);
}
