import { screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { buildFuelPlan, toCalculatorUser } from '@fuel-ride/fuel-core';
import { loggedIn, renderApp, rider } from '../test/utils.jsx';

// Rider A and the S1 foods from docs/FUELING_RULES.md §8
const riderA = rider({ weightKg: 75, birthYear: 1986, sex: 'male', ftpW: 250, lthr: 165, trainedCarbRateGph: 70 });
const bar = { id: 'bar', name: 'Oat bar', type: 'bar', servingLabel: '1 bar', carbsG: 44, kcal: 250, sodiumMg: 150, fluidMl: 0, favorite: false };
const gel = { id: 'gel', name: 'Energy gel', type: 'gel', servingLabel: '1 gel', carbsG: 22, kcal: 100, sodiumMg: 50, fluidMl: 0, favorite: false };
const drink = { id: 'drink', name: 'Electrolyte drink', type: 'drink', servingLabel: '1 bottle', carbsG: 15, kcal: 60, sodiumMg: 400, fluidMl: 500, favorite: false };

const api = (user = riderA, foods = [bar, gel, drink]) => ({ ...loggedIn(user), 'GET /api/foods': [200, { foods }] });

async function fillT1(user) {
  await user.type(await screen.findByLabelText('Average power'), '175');
  await user.type(screen.getByLabelText('Temperature (optional)'), '22');
  for (const name of ['Oat bar', 'Energy gel', 'Electrolyte drink']) {
    await user.click(screen.getByRole('button', { name: new RegExp(name) }));
  }
}

describe('plan a ride: live preview', () => {
  test('ride T1 shows the spec targets and the S1 hour-by-hour plan', async () => {
    const { user } = renderApp('/plan', api());
    await fillT1(user);

    const summary = screen.getByRole('region', { name: 'Every hour' });
    expect(within(summary).getByText('60 g')).toBeInTheDocument();
    expect(within(summary).getByText('600 ml')).toBeInTheDocument();
    expect(within(summary).getByText('300 mg')).toBeInTheDocument();
    expect(summary).toHaveTextContent('Burns about 1,260 kcal');
    expect(summary).toHaveTextContent('average power (high confidence)');

    const schedule = screen.getByRole('region', { name: 'Hour by hour' });
    const hour1 = within(schedule).getByRole('heading', { name: 'Hour 1' }).closest('li');
    expect(hour1).toHaveTextContent('1 × Electrolyte drink');
    expect(hour1).toHaveTextContent('1 × Oat bar');
    expect(hour1).toHaveTextContent('100 ml water');
    expect(hour1).toHaveTextContent('Spread across the hour');
    expect(within(schedule).getByRole('heading', { name: 'Hour 2' })).toBeInTheDocument();
    expect(within(schedule).queryByRole('heading', { name: /Hour 3/ })).not.toBeInTheDocument();
  });

  test('matches the server calculation exactly (same fuel-core, same profile mapping)', async () => {
    const { user } = renderApp('/plan', api());
    await fillT1(user);
    const expected = buildFuelPlan({
      ride: { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22 },
      user: toCalculatorUser(riderA, new Date()),
      foods: [bar, gel, drink],
    });
    expect(screen.getByRole('region', { name: 'Every hour' })).toHaveTextContent(
      `${expected.targets.carbsGph} g`,
    );
  });

  test('duration stepper moves in 15-minute steps and re-plans', async () => {
    const { user } = renderApp('/plan', api());
    await user.type(await screen.findByLabelText('Average power'), '175');
    expect(screen.getByRole('group', { name: 'Duration' })).toHaveTextContent('2 h');
    await user.click(screen.getByRole('button', { name: 'Increase duration' }));
    await user.click(screen.getByRole('button', { name: 'Increase duration' }));
    expect(screen.getByRole('group', { name: 'Duration' })).toHaveTextContent('2 h 30 min');
    expect(screen.getByRole('region', { name: 'Every hour' })).toHaveTextContent('Whole ride (2 h 30 min)');
  });

  test('without an FTP the default is power zone 2, with only zones 1–5 offered', async () => {
    renderApp('/plan', api(rider({ weightKg: 70 })));
    expect(await screen.findByRole('radio', { name: 'Z2 Endurance' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: /Z6/ })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Every hour' })).toBeInTheDocument();
  });

  test('favorite foods are picked for you, numbered in order', async () => {
    renderApp('/plan', api(riderA, [{ ...bar, favorite: true }, gel, { ...drink, favorite: true }]));
    expect(await screen.findByRole('button', { name: /Oat bar/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Energy gel/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Electrolyte drink/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('missing weight → points to the profile and saving is disabled', async () => {
    renderApp('/plan', api(rider()));
    expect(await screen.findByText(/Add your weight to your profile/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to profile' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('button', { name: 'Save ride plan' })).toBeDisabled();
  });

  test('out-of-range power shows under the power field', async () => {
    const { user } = renderApp('/plan', api());
    await user.type(await screen.findByLabelText('Average power'), '900');
    expect(screen.getByLabelText('Average power')).toHaveAccessibleDescription(/between 30 and 600/);
  });
});

describe('plan a ride: save', () => {
  test('saves the inputs and opens the saved ride', async () => {
    const savedPlan = buildFuelPlan({
      ride: { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22 },
      user: toCalculatorUser(riderA, '2026-11-03'),
      foods: [bar, gel, drink],
    });
    const savedRide = {
      id: 'r1',
      name: 'Tuesday endurance',
      date: '2026-11-03T12:00:00.000Z',
      durationMin: 120,
      tempC: 22,
      plan: savedPlan,
    };
    const { user, calls } = renderApp('/plan', {
      ...api(),
      'POST /api/rides': [201, { ride: savedRide }],
      'GET /api/rides/r1': [200, { ride: savedRide }],
    });
    await user.type(await screen.findByLabelText('Name (optional)'), 'Tuesday endurance');
    await fillT1(user);
    await user.click(screen.getByRole('button', { name: 'Save ride plan' }));

    expect(await screen.findByRole('heading', { name: 'Tuesday endurance' })).toBeInTheDocument();
    expect(screen.getByText('Ride plan saved.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hour 1' })).toBeInTheDocument();

    const body = calls.find((c) => c.method === 'POST' && c.path === '/api/rides').body;
    expect(body).toMatchObject({
      name: 'Tuesday endurance',
      durationMin: 120,
      intensity: { avgPowerW: 175 },
      tempC: 22,
      foodIds: ['bar', 'gel', 'drink'],
    });
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('imperial riders enter °F; the API receives °C', async () => {
    const { user, calls } = renderApp('/plan', {
      ...api({ ...riderA, units: 'imperial' }),
      'POST /api/rides': ({ body }) => [201, { ride: { id: 'r2', ...body, plan: buildFuelPlan({ ride: body, user: toCalculatorUser(riderA, body.date), foods: [] }) } }],
    });
    await user.type(await screen.findByLabelText('Average power'), '175');
    await user.type(screen.getByLabelText('Temperature (optional)'), '72');
    await user.click(screen.getByRole('button', { name: 'Save ride plan' }));
    await screen.findByText('Ride plan saved.');
    expect(calls.find((c) => c.method === 'POST').body.tempC).toBe(22.2);
  });
});
