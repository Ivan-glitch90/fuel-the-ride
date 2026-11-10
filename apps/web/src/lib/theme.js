import { useSyncExternalStore } from 'react';

// Light/dark: the rider's choice (stored on this device), else the phone's setting.
// public/theme-init.js applies the same rule before the first paint; keep the two in sync.
const STORAGE_KEY = 'ftr-theme';
const THEME_COLOR = { light: '#fbf8fd', dark: '#131316' }; // the page background (M3 surface)
const listeners = new Set();

const systemQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

/** 'dark' | 'light' if the rider chose, null if following the phone. */
export function getThemeChoice() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export function isDark() {
  const choice = getThemeChoice();
  return choice ? choice === 'dark' : Boolean(systemQuery()?.matches);
}

function apply() {
  const theme = isDark() ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  listeners.forEach((listener) => listener());
}

/** Saves the rider's choice ('dark' | 'light'), or null to follow the phone again. */
export function setThemeChoice(choice) {
  try {
    if (choice) localStorage.setItem(STORAGE_KEY, choice);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: still switch for this visit
  }
  apply();
}

/** Keeps following the phone when it switches (only matters while there's no choice). Call once at startup. */
export function startThemeSync() {
  apply();
  systemQuery()?.addEventListener?.('change', apply);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** { dark, choice }: re-renders when the theme changes. */
export function useTheme() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const choice = useSyncExternalStore(subscribe, getThemeChoice, () => null);
  return { dark, choice };
}
