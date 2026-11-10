import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom doesn't implement scrolling; pages call it on navigation
window.scrollTo = () => {};

// Newer Node versions shadow jsdom's localStorage with their own (undefined without a flag):
// give the tests a simple in-memory one.
if (!globalThis.localStorage) {
  const store = new Map();
  const memoryStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
