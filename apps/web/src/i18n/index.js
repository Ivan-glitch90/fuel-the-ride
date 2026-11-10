import { createElement, Fragment, useSyncExternalStore } from 'react';
import { es } from './es/index.js';

/*
 * Translations, gettext style: the English text *is* the key.
 *
 *   t('Plan a ride')                              → "Planear una salida" in Spanish
 *   t('Hi, {name}', { name })                     → "Hola, Ana"
 *   tn('{n} food', '{n} foods', count)            → picks the plural form, {n} = count
 *   tCode('TRAINED_RATE_LIMIT', fallback, params) → calculator/server messages by code
 *
 * English needs no dictionary: missing Spanish entries fall back to the English text, so
 * nothing ever shows a key. Spanish lives in src/i18n/es/*.js (plain objects, easy to review).
 * Changing the language remounts the app (see LanguageRoot), so plain t() calls are enough.
 */

export const LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'es', label: 'Español', locale: 'es-419' }, // neutral Latin American Spanish
];
const STORAGE_KEY = 'ftr-lang';
const DICTIONARIES = { es };
const listeners = new Set();

function detect() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch {
    // storage blocked: fall through to the phone's language
  }
  const preferred = globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? 'en'];
  return preferred.some((l) => String(l).toLowerCase().startsWith('es')) ? 'es' : 'en';
}

let current = detect();

export const getLanguage = () => current;
/** BCP 47 locale for Intl (dates, numbers). */
export const getLocale = () => LANGUAGES.find((l) => l.code === current)?.locale ?? 'en-US';
/** True once the rider picked a language in Profile (otherwise we follow the phone). */
export function hasLanguageChoice() {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function setLanguage(code) {
  if (!LANGUAGES.some((l) => l.code === code)) return;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // storage blocked: still switch for this visit
  }
  current = code;
  applyDocumentLanguage();
  listeners.forEach((listener) => listener());
}

export function applyDocumentLanguage() {
  if (globalThis.document) document.documentElement.lang = current;
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/** Translate English `text` into the current language. */
export function t(text, vars) {
  const translated = DICTIONARIES[current]?.[text];
  return interpolate(translated ?? text, vars);
}

/** Plural-aware translate: `one` when count is 1, otherwise `other`. `{n}` is the count. */
export function tn(one, other, count, vars) {
  return t(count === 1 ? one : other, { n: count, ...vars });
}

/**
 * Messages that come with a code (calculator notes/warnings, check-in flags, server errors):
 * the Spanish template is looked up by code and filled with `params`; otherwise the English
 * `fallback` (the message as sent) is shown unchanged.
 */
export function tCode(code, fallback, params) {
  const template = DICTIONARIES[current]?.[`code:${code}`];
  if (!template || (template.includes('{') && !params)) return fallback;
  return interpolate(template, params);
}

/**
 * Translate text that contains links or emphasis. Mark the parts with named tags and pass a
 * function per tag; the translation can move the tags wherever the language needs them:
 *
 *   tx('Tip: <link>log what you ate</link> first.', { link: (text) => <Link to="…">{text}</Link> })
 *
 * Returns an array of strings and elements, ready to render.
 */
export function tx(text, components, vars) {
  const translated = t(text, vars);
  const out = [];
  const pattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(translated))) {
    if (match.index > last) out.push(translated.slice(last, match.index));
    const render = components[match[1]];
    out.push(createElement(Fragment, { key: out.length }, render ? render(match[2]) : match[2]));
    last = pattern.lastIndex;
  }
  if (last < translated.length) out.push(translated.slice(last));
  return out;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current language code; re-renders when it changes. */
export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage, () => 'en');
}

// Tests: switch language without touching storage
export function __setLanguageForTests(code) {
  current = code;
  applyDocumentLanguage();
  listeners.forEach((listener) => listener());
}
