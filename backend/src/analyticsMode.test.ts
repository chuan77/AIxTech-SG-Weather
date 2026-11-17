import { describe, expect, it } from 'vitest';
import { resolveAnalyticsMode } from './analyticsMode.js';

describe('resolveAnalyticsMode', () => {
  it('measures when WEB_ANALYTICS=on, whatever VERCEL says', () => {
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: 'on' })).toEqual({ mode: 'measure' });
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: 'on', VERCEL: '1' })).toEqual({ mode: 'measure' });
  });

  it('is off when WEB_ANALYTICS=off, even on Vercel', () => {
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: 'off', VERCEL: '1' })).toEqual({ mode: 'off' });
  });

  it('shows only the notice when WEB_ANALYTICS=notice-only', () => {
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: 'notice-only' })).toEqual({ mode: 'notice-only' });
  });

  it('falls back to VERCEL=1 when WEB_ANALYTICS is unset or blank', () => {
    expect(resolveAnalyticsMode({ VERCEL: '1' })).toEqual({ mode: 'measure' });
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: '', VERCEL: '1' })).toEqual({ mode: 'measure' });
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: '  ', VERCEL: '1' })).toEqual({ mode: 'measure' });
  });

  it('is off when unset and not on Vercel', () => {
    expect(resolveAnalyticsMode({})).toEqual({ mode: 'off' });
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: '' })).toEqual({ mode: 'off' });
    expect(resolveAnalyticsMode({ VERCEL: '0' })).toEqual({ mode: 'off' });
    expect(resolveAnalyticsMode({ VERCEL: 'true' })).toEqual({ mode: 'off' });
    expect(resolveAnalyticsMode({ VERCEL: '' })).toEqual({ mode: 'off' });
  });

  it('trims and ignores case', () => {
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: ' ON ' })).toEqual({ mode: 'measure' });
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: 'Off', VERCEL: '1' })).toEqual({ mode: 'off' });
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: 'NOTICE-ONLY' })).toEqual({ mode: 'notice-only' });
  });

  it('treats anything else as off and reports the raw value', () => {
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: 'yes', VERCEL: '1' })).toEqual({
      mode: 'off',
      invalid: 'yes',
    });
    expect(resolveAnalyticsMode({ WEB_ANALYTICS: 'measure' })).toEqual({
      mode: 'off',
      invalid: 'measure',
    });
  });
});
