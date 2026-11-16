import { describe, expect, it } from 'vitest';
import { pickCartoApiKey } from './cartoKey';

describe('pickCartoApiKey', () => {
  it('prefers the key the server put in the page (production container)', () => {
    expect(pickCartoApiKey('runtime-key', 'build-key')).toBe('runtime-key');
  });

  it('falls back to the build-time key (local dev with frontend/.env.local)', () => {
    expect(pickCartoApiKey(null, 'build-key')).toBe('build-key');
    expect(pickCartoApiKey('  ', 'build-key')).toBe('build-key');
  });

  it('returns undefined when neither is set, so the map uses keyless tiles', () => {
    expect(pickCartoApiKey(undefined, undefined)).toBeUndefined();
    expect(pickCartoApiKey('', '')).toBeUndefined();
  });
});
