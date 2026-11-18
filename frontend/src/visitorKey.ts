/**
 * This browser's private visitor key (spec 013). The server files saved places under it, so each
 * visitor sees only their own. It is 32 random bytes as 43 base64url characters, kept in
 * localStorage and sent only in the `X-Visitor-Key` header: never in a URL, a log or analytics,
 * and never as a cookie (the privacy notice promises none). Creating it makes no network call.
 */
export const VISITOR_KEY_STORAGE_KEY = 'weather-starter.visitor.key';
export const VISITOR_KEY_HEADER = 'X-Visitor-Key';

const VISITOR_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface KeyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isVisitorKey(value: unknown): value is string {
  return typeof value === 'string' && VISITOR_KEY_PATTERN.test(value);
}

/** 32 bytes from `randomBytes` as unpadded base64url (43 characters). */
export function generateVisitorKey(randomBytes: () => Uint8Array): string {
  let binary = '';
  for (const byte of randomBytes()) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Reads the stored key, or makes and stores a new one. If storage is missing or throws (some
 * private modes), the key lives in memory for this page only: places added work for the session
 * and are gone after the tab closes. It never falls back to anything shared (FR-015).
 */
export function createVisitorKeyStore(
  storage: KeyStorage | undefined,
  randomBytes: () => Uint8Array,
) {
  let key: string | null = null;

  return {
    get(): string {
      if (key) return key;
      let stored: string | null = null;
      try {
        stored = storage?.getItem(VISITOR_KEY_STORAGE_KEY) ?? null;
      } catch {
        // Storage blocked: use a key for this page only.
      }
      if (isVisitorKey(stored)) {
        key = stored;
        return key;
      }
      key = generateVisitorKey(randomBytes);
      try {
        storage?.setItem(VISITOR_KEY_STORAGE_KEY, key);
      } catch {
        // Not saved: the list lasts for this page only.
      }
      return key;
    },
  };
}

function browserStorage(): KeyStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

const browserKeyStore = createVisitorKeyStore(browserStorage(), () =>
  crypto.getRandomValues(new Uint8Array(32)),
);

/** This browser's visitor key, created on first use. */
export function getVisitorKey(): string {
  return browserKeyStore.get();
}
