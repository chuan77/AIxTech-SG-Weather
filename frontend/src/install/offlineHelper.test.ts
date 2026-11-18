import { describe, expect, it } from 'vitest';
import { OFFLINE_CACHE_PREFIX, isOfflineCache, offlineHelperAction } from './offlineHelper';

describe('offlineHelperAction', () => {
  it('does nothing outside a production build or without service workers', () => {
    expect(offlineHelperAction({ prod: false, hasServiceWorker: true, setting: undefined })).toBe(
      'none',
    );
    expect(offlineHelperAction({ prod: true, hasServiceWorker: false, setting: undefined })).toBe(
      'none',
    );
    expect(offlineHelperAction({ prod: false, hasServiceWorker: true, setting: 'off' })).toBe(
      'none',
    );
  });

  it('unregisters when switched off at build time', () => {
    expect(offlineHelperAction({ prod: true, hasServiceWorker: true, setting: 'off' })).toBe(
      'unregister',
    );
  });

  it('registers otherwise', () => {
    expect(offlineHelperAction({ prod: true, hasServiceWorker: true, setting: undefined })).toBe(
      'register',
    );
    expect(offlineHelperAction({ prod: true, hasServiceWorker: true, setting: 'on' })).toBe(
      'register',
    );
  });
});

describe('isOfflineCache', () => {
  it('matches only the offline helper caches', () => {
    expect(OFFLINE_CACHE_PREFIX).toBe('lepak-offline-');
    expect(isOfflineCache('lepak-offline-v1')).toBe(true);
    expect(isOfflineCache('lepak-offline-v12')).toBe(true);
    expect(isOfflineCache('other-v1')).toBe(false);
    expect(isOfflineCache('my-lepak-offline-v1')).toBe(false);
  });
});
