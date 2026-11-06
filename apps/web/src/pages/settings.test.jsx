import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { loggedIn, renderApp, rider } from '../test/utils.jsx';

const saveProfile = { 'PATCH /api/users/me': ({ body }) => [200, { user: rider({ ...body }) }] };

describe('profile', () => {
  test('saves metric values, sending null for emptied optional fields', async () => {
    const { user, calls } = renderApp('/settings', { ...loggedIn(rider({ ftpW: 250 })), ...saveProfile });
    await user.type(await screen.findByLabelText('Weight (kg)'), '75');
    await user.type(screen.getByLabelText('Birth year'), '1986');
    await user.clear(screen.getByLabelText('FTP (functional threshold power)'));
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH').body).toMatchObject({
      weightKg: 75,
      birthYear: 1986,
      ftpW: null,
      sweatRateMlPerHr: null,
      units: 'metric',
    });
  });

  test('training fields spell out their acronyms', async () => {
    renderApp('/settings', loggedIn());
    expect(await screen.findByLabelText('LTHR (lactate threshold heart rate)')).toBeInTheDocument();
    expect(screen.getByLabelText('Max HR (maximum heart rate)')).toBeInTheDocument();
    expect(screen.getByLabelText('Resting HR (resting heart rate)')).toBeInTheDocument();
  });

  test('imperial riders enter pounds; the API receives kilograms', async () => {
    const { user, calls } = renderApp('/settings', {
      ...loggedIn(rider({ units: 'imperial', weightKg: 75 })),
      ...saveProfile,
    });
    const weight = await screen.findByLabelText('Weight (lb)');
    expect(weight).toHaveValue('165.3');
    await user.clear(weight);
    await user.type(weight, '160');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    await screen.findByText('Profile saved.');
    expect(calls.find((c) => c.method === 'PATCH').body.weightKg).toBe(72.6);
  });

  test('switching units converts the weight already typed', async () => {
    const { user } = renderApp('/settings', loggedIn(rider({ weightKg: 75 })));
    expect(await screen.findByLabelText('Weight (kg)')).toHaveValue('75');
    await user.click(screen.getByRole('radio', { name: 'Imperial (lb, fl oz)' }));
    expect(screen.getByLabelText('Weight (lb)')).toHaveValue('165.3');
  });

  test('logging out returns to the login page', async () => {
    // Like the real API: after logout, /auth/me answers 401
    let loggedOutNow = false;
    const { user, calls } = renderApp('/settings', {
      'GET /api/auth/me': () => (loggedOutNow ? [401, {}] : [200, { user: rider() }]),
      'POST /api/auth/refresh': [401, {}],
      'POST /api/auth/logout': () => {
        loggedOutNow = true;
        return [204];
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/auth/logout')).toBe(true);
  });
});

describe('dashboard', () => {
  test('guides a new rider: profile first, then foods', async () => {
    renderApp('/', { ...loggedIn(), 'GET /api/foods': [200, { foods: [] }] });
    expect(await screen.findByRole('heading', { name: 'Hi, Test' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your weight' })).toHaveAttribute('href', '/settings');
    expect(await screen.findByRole('link', { name: 'Add your first food' })).toBeInTheDocument();
  });
});
