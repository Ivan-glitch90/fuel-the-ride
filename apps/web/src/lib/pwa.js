// Service worker registration (installable app + offline). Only main.jsx calls register();
// the app listens for "an update is ready" through updateReady()/applyUpdate(), so tests
// don't need the build-time virtual module.

const UPDATE_EVENT = 'ftr:update-ready';
let updateServiceWorker = null;

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const { registerSW } = await import('virtual:pwa-register');
  updateServiceWorker = registerSW({
    immediate: true,
    // A new version is downloaded and waiting: let the rider choose when to switch
    onNeedRefresh() {
      window.dispatchEvent(new Event(UPDATE_EVENT));
    },
  });
}

/** Calls `callback` when a new version of the app is ready. Returns an unsubscribe function. */
export function onUpdateReady(callback) {
  window.addEventListener(UPDATE_EVENT, callback);
  return () => window.removeEventListener(UPDATE_EVENT, callback);
}

/** Switches to the waiting version and reloads the page. */
export function applyUpdate() {
  if (updateServiceWorker) updateServiceWorker(true);
  else window.location.reload();
}

export const UPDATE_READY_EVENT = UPDATE_EVENT;
