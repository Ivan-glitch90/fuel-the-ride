import { useSyncExternalStore } from 'react';

/** Must match the runtime cache name in vite.config.js. */
export const API_CACHE = 'ftr-api';

/**
 * Deletes the offline copy of the rider's data from this device. Called on logout and when the
 * session ends (account deleted, password reset), so the next person on a shared phone sees nothing.
 */
export async function clearOfflineData() {
  try {
    if (globalThis.caches) await caches.delete(API_CACHE);
  } catch {
    // Storage blocked (private mode etc.): nothing was saved, nothing to clear
  }
}

function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** True while the device reports a network connection. */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
