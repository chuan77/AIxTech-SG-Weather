/**
 * The visitor key format (spec 013): 32 random bytes as 43 base64url characters. Kept free of any
 * database import, because importing `db.ts` opens the database (the claim CLI checks first).
 */
const VISITOR_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const INVALID_KEY_MESSAGE = 'visitor key must be 43 base64url characters';

export function isVisitorKey(value: unknown): value is string {
  return typeof value === 'string' && VISITOR_KEY_PATTERN.test(value);
}
