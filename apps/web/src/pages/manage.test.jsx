import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { buildFuelPlan, toCalculatorUser } from '@fuel-ride/fuel-core';
import { loggedIn, renderApp, rider } from '../test/utils.jsx';

const me = rider({ weightKg: 75, birthYear: 1986, ftpW: 250, trainedCarbRateGph: 70 });
const bar = { id: 'bar', name: 'Oat bar', type: 'bar', servingLabel: '1 bar', carbsG: 44, kcal: 250, sodiumMg: 150, fluidMl: 0 };
const plan = buildFuelPlan({
  ride: { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22 },
  user: toCalculatorUser(me, '2026-11-03'),
  foods: [bar],
});
const ride = (overrides = {}) => ({
  id: 'r1',
  name: 'Tuesday endurance',
  date: '2026-11-03T12:00:00.000Z',
  durationMin: 120,
  tempC: 22,
  status: 'planned',
  archived: false,
  plan,
  ...overrides,
});
const base = {
  ...loggedIn(me),
  'GET /api/foods': [200, { foods: [bar] }],
  'GET /api/checkins': [200, { checkIns: [] }],
};

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('top bar', () => {
  test('"Fuel the Ride" goes back to Home', async () => {
    const { user } = renderApp('/foods', { ...base, 'GET /api/rides': [200, { rides: [] }] });
    await user.click(await screen.findByRole('link', { name: /Fuel the Ride, go to Home/ }));
    expect(await screen.findByRole('heading', { name: /^Hi, / })).toBeInTheDocument();
  });
});

describe('archive and delete rides', () => {
  test('archiving hides it from Home (with Undo); it stays reachable under "Show archived rides"', async () => {
    let current = ride();
    const { user, calls } = renderApp('/rides/r1', {
      ...base,
      'GET /api/rides/r1': () => [200, { ride: current }],
      'PATCH /api/rides/r1': ({ body }) => {
        current = { ...current, ...body };
        return [200, { ride: current }];
      },
      'GET /api/rides': ({ query }) => {
        if (query.archived === 'all') return [200, { rides: [current] }];
        const wantArchived = query.archived === 'true';
        return [200, { rides: current.archived === wantArchived ? [current] : [] }];
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Archive ride' }));
    expect(await screen.findByText('Ride archived. It still counts in your progress.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ archived: true });
    expect(await screen.findByRole('button', { name: 'Restore to Home' })).toBeInTheDocument();
    expect(screen.getByText('Archived', { selector: '.badge' })).toBeInTheDocument();

    // Undo from the snackbar brings it straight back
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: 'Archive ride' })).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'PATCH').at(-1).body).toEqual({ archived: false });

    // Archive again, then look on Home
    await user.click(screen.getByRole('button', { name: 'Archive ride' }));
    await screen.findByRole('button', { name: 'Restore to Home' });
    await user.click(screen.getByRole('link', { name: /go to Home/ }));
    const recent = await screen.findByRole('region', { name: 'Recent rides' });
    expect(within(recent).getByText('No rides on Home. Your archived rides are below.')).toBeInTheDocument();
    await user.click(within(recent).getByRole('button', { name: 'Show archived rides' }));
    const archived = await within(recent).findByRole('region', { name: 'Archived rides' });
    expect(within(archived).getByRole('link', { name: /Tuesday endurance/ })).toHaveAttribute('href', '/rides/r1');
  });

  test('deleting asks first, then removes it for good and goes Home', async () => {
    let deleted = false;
    const { user, calls } = renderApp('/rides/r1', {
      ...base,
      'GET /api/rides/r1': () => (deleted ? [404, { error: { code: 'NOT_FOUND', message: 'Ride not found' } }] : [200, { ride: ride() }]),
      'DELETE /api/rides/r1': () => {
        deleted = true;
        return [204];
      },
      'GET /api/rides': () => [200, { rides: deleted ? [] : [ride()] }],
    });

    await user.click(await screen.findByRole('button', { name: 'Delete ride' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false); // first tap only asks
    await user.click(screen.getByRole('button', { name: 'Delete for good' }));
    expect(await screen.findByRole('heading', { name: /^Hi, / })).toBeInTheDocument();
    expect(screen.getByText('Ride deleted.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/rides/r1')).toBe(true);
  });
});

describe('dark mode switch', () => {
  test('switching saves the choice on this device and applies it at once; it can follow the phone again', async () => {
    const { user } = renderApp('/settings', base);
    const toggle = await screen.findByRole('switch', { name: /Dark mode/ });
    expect(toggle).not.toBeChecked(); // jsdom's "phone" is light
    expect(toggle).toHaveAccessibleDescription('Following your phone’s setting until you switch it.');

    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ftr-theme')).toBe('dark');
    expect(toggle).toHaveAccessibleDescription('Saved on this device.');

    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('ftr-theme')).toBe('light');

    await user.click(screen.getByRole('button', { name: 'Match my phone’s setting' }));
    expect(localStorage.getItem('ftr-theme')).toBeNull();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Match my phone’s setting' })).toBeNull());
  });
});
