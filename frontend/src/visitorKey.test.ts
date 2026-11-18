import { describe, expect, it } from 'vitest';
import {
  VISITOR_KEY_STORAGE_KEY,
  createVisitorKeyStore,
  generateVisitorKey,
  isVisitorKey,
  type KeyStorage,
} from './visitorKey';

const bytes = (fill: (index: number) => number) => () =>
  Uint8Array.from({ length: 32 }, (_, index) => fill(index));

function memoryStorage(initial: Record<string, string> = {}): KeyStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwingStorage: KeyStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('generateVisitorKey', () => {
  it('turns 32 bytes into 43 base64url characters without padding', () => {
    expect(generateVisitorKey(bytes(() => 0))).toBe('A'.repeat(43));
    expect(generateVisitorKey(bytes(() => 255))).toBe('_'.repeat(42) + '8');
    const mixed = generateVisitorKey(bytes((index) => index * 8));
    expect(mixed).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Expected value from Node's Buffer.toString('base64url').
    expect(mixed).toBe('AAgQGCAoMDhASFBYYGhweICIkJigqLC4wMjQ2ODo8Pg');
  });
});

describe('isVisitorKey', () => {
  it('matches the server rule: exactly 43 base64url characters', () => {
    expect(isVisitorKey('a'.repeat(43))).toBe(true);
    for (const bad of ['a'.repeat(42), 'a'.repeat(44), 'a'.repeat(42) + '+', '', null]) {
      expect(isVisitorKey(bad)).toBe(false);
    }
  });
});

describe('visitor key store', () => {
  it('returns the stored key when it is valid', () => {
    const storage = memoryStorage({ [VISITOR_KEY_STORAGE_KEY]: 'k'.repeat(43) });
    const store = createVisitorKeyStore(
      storage,
      bytes(() => 0),
    );
    expect(store.get()).toBe('k'.repeat(43));
  });

  it('creates, saves and then reuses a key when none is stored', () => {
    const storage = memoryStorage();
    const store = createVisitorKeyStore(
      storage,
      bytes(() => 0),
    );
    expect(store.get()).toBe('A'.repeat(43));
    expect(storage.data[VISITOR_KEY_STORAGE_KEY]).toBe('A'.repeat(43));
    expect(
      createVisitorKeyStore(
        storage,
        bytes(() => 255),
      ).get(),
    ).toBe('A'.repeat(43));
  });

  it('replaces an invalid stored value', () => {
    const storage = memoryStorage({ [VISITOR_KEY_STORAGE_KEY]: 'not-a-key' });
    expect(
      createVisitorKeyStore(
        storage,
        bytes(() => 0),
      ).get(),
    ).toBe('A'.repeat(43));
    expect(storage.data[VISITOR_KEY_STORAGE_KEY]).toBe('A'.repeat(43));
  });

  it('keeps a stable key for the page when storage throws', () => {
    let calls = 0;
    const store = createVisitorKeyStore(
      throwingStorage,
      bytes(() => calls++ % 256),
    );
    const first = store.get();
    expect(isVisitorKey(first)).toBe(true);
    expect(store.get()).toBe(first);
  });

  it('works with no storage at all', () => {
    const store = createVisitorKeyStore(
      undefined,
      bytes(() => 0),
    );
    expect(store.get()).toBe('A'.repeat(43));
  });
});
