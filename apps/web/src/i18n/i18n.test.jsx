import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { loggedIn, renderApp, rider } from '../test/utils.jsx';
import { __setLanguageForTests, getLanguage, t, tCode, tn, tx } from './index.js';
import { es } from './es/index.js';

afterEach(() => {
  __setLanguageForTests('en');
  localStorage.clear();
});

describe('translation helpers', () => {
  test('English is the key and the fallback', () => {
    expect(t('Plan a ride')).toBe('Plan a ride');
    expect(t('Hi, {name}', { name: 'Ana' })).toBe('Hi, Ana');
    __setLanguageForTests('es');
    expect(t('Something nobody translated')).toBe('Something nobody translated');
    expect(t('Home')).toBe('Inicio');
  });

  test('plurals pick the right form', () => {
    __setLanguageForTests('es');
    expect(tn('in {n} day', 'in {n} days', 1)).toBe(es['in {n} day'].replace('{n}', '1'));
    expect(tn('in {n} day', 'in {n} days', 5)).toBe(es['in {n} days'].replace('{n}', '5'));
  });

  test('calculator messages translate by code, with their numbers', () => {
    __setLanguageForTests('es');
    expect(tCode('CAPPED_BY_TRAINED_RATE', 'Limited by your trained rate (70 g/hr)…', { trainedGph: 70 })).toBe(
      'Limitado por tu tolerancia de carbohidratos (70 g/h). El entrenamiento intestinal puede subirla.',
    );
    expect(tCode('GOAL_NOT_REACHABLE', 'x', { count: 1, raceDayGph: 80 })).toMatch(/^Falta 1 semana/);
    expect(tCode('GOAL_NOT_REACHABLE', 'x', { count: 3, raceDayGph: 80 })).toMatch(/^Faltan 3 semanas/);
    // Saved before messages had numbers attached: keep the English rather than show {placeholders}
    expect(tCode('CAPPED_BY_TRAINED_RATE', 'Limited by your trained rate (70 g/hr).')).toBe(
      'Limited by your trained rate (70 g/hr).',
    );
    expect(tCode('UNKNOWN_CODE', 'As sent')).toBe('As sent');
  });

  test('tx keeps links and emphasis where the language puts them', () => {
    render(<p>{tx('Read the <link>Terms</link> first.', { link: (text) => <a href="/terms">{text}</a> })}</p>);
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByText(/first\./)).toBeInTheDocument();
  });

  test('every Spanish entry keeps the English placeholders', () => {
    const names = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    const broken = Object.entries(es)
      .filter(([key]) => !key.startsWith('code:'))
      .filter(([key, value]) => names(key) !== names(value));
    expect(broken).toEqual([]);
  });
});

describe('the app in Spanish', () => {
  test('picking Español in Profile switches the app, remembers it and tells the server', async () => {
    const { user, calls } = renderApp('/settings', { ...loggedIn(rider()), 'PATCH /api/users/me': [200, { user: rider() }] });
    await user.click(await screen.findByRole('radio', { name: 'Español' }));

    expect(getLanguage()).toBe('es');
    expect(document.documentElement.lang).toBe('es');
    expect(localStorage.getItem('ftr-lang')).toBe('es');
    expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ language: 'es' });
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Inicio' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Perfil' })).toBeInTheDocument();
    // The picker itself stays findable in either language
    expect(screen.getByRole('radio', { name: 'English' })).toBeInTheDocument();
  });

  test('requests ask the server for the app language', async () => {
    __setLanguageForTests('es');
    renderApp('/', { ...loggedIn(rider()), 'GET /api/foods': [200, { foods: [] }], 'GET /api/rides': [200, { rides: [] }] });
    await screen.findByRole('navigation', { name: 'Principal' });
    const init = globalThis.fetch.mock.calls[0][1];
    expect(init.headers['Accept-Language']).toBe('es');
  });
});
