/**
 * Registers the offline helper (public/sw.js), or removes it when switched off (spec 014,
 * contracts/offline-helper.md). The helper keeps only /offline.html and answers only page loads
 * that fail for lack of a connection, so the app works the same with or without it. Any failure
 * here is reported with console.warn and otherwise ignored.
 */

export const OFFLINE_CACHE_PREFIX = 'lepak-offline-';

export type OfflineHelperAction = 'register' | 'unregister' | 'none';

export function isOfflineCache(name: string): boolean {
  return name.startsWith(OFFLINE_CACHE_PREFIX);
}

export function offlineHelperAction({
  prod,
  hasServiceWorker,
  setting,
}: {
  prod: boolean;
  hasServiceWorker: boolean;
  setting: string | undefined;
}): OfflineHelperAction {
  // The Vite dev server never registers: its files change on every save.
  if (!prod || !hasServiceWorker) return 'none';
  return setting === 'off' ? 'unregister' : 'register';
}

export async function applyOfflineHelper(): Promise<void> {
  const action = offlineHelperAction({
    prod: import.meta.env.PROD,
    hasServiceWorker: 'serviceWorker' in navigator,
    setting: import.meta.env.VITE_OFFLINE_HELPER,
  });
  try {
    if (action === 'register') {
      await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    } else if (action === 'unregister') {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.filter(isOfflineCache).map((name) => caches.delete(name)));
      }
    }
  } catch (error) {
    console.warn('[offline helper] could not', action, error);
  }
}
