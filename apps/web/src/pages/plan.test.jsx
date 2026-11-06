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

  test('duration − / + move in 15-minute steps and re-plan', async () => {
    const { user } = renderApp('/plan', api());
    await user.type(await screen.findByLabelText('Average power'), '175');
    expect(screen.getByLabelText('Hours')).toHaveValue('2');
    expect(screen.getByLabelText('Minutes')).toHaveValue('0');
    await user.click(screen.getByRole('button', { name: 'Increase duration' }));
    await user.click(screen.getByRole('button', { name: 'Increase duration' }));
    expect(screen.getByLabelText('Hours')).toHaveValue('2');
    expect(screen.getByLabelText('Minutes')).toHaveValue('30');
    expect(screen.getByRole('region', { name: 'Every hour' })).toHaveTextContent('Whole ride (2 h 30 min)');
  });

  test('duration can be typed directly', async () => {
    const { user } = renderApp('/plan', api());
    await user.type(await screen.findByLabelText('Average power'), '175');
    await user.clear(screen.getByLabelText('Hours'));
    await user.type(screen.getByLabelText('Hours'), '3');
    await user.clear(screen.getByLabelText('Minutes'));
    await user.type(screen.getByLabelText('Minutes'), '45');
    expect(screen.getByRole('region', { name: 'Every hour' })).toHaveTextContent('Whole ride (3 h 45 min)');
  });

  test('an impossible typed duration shows an error and disables saving', async () => {
    const { user } = renderApp('/plan', api());
    await user.type(await screen.findByLabelText('Average power'), '175');
    await user.clear(screen.getByLabelText('Hours'));
    await user.type(screen.getByLabelText('Hours'), '14');
    expect(screen.getByRole('alert')).toHaveTextContent('Between 15 min and 12 h');
    expect(screen.queryByRole('region', { name: 'Every hour' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save ride plan' })).toBeDisabled();
  });

  test('indoor adds 150 ml/hr and says why (spec T6)', async () => {
    const { user } = renderApp('/plan', api());
    await user.type(await screen.findByLabelText('Average power'), '175');
    await user.click(screen.getByRole('radio', { name: 'Indoor (trainer, Zwift…)' }));
    expect(screen.getByLabelText(/Room temperature/)).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Every hour' });
    expect(within(summary).getByText('750 ml')).toBeInTheDocument();
    expect(summary).toHaveTextContent('no wind to cool you');
  });

  test('race day reads the higher carb column (spec T7)', async () => {
    const { user } = renderApp('/plan', api());
    await user.type(await screen.findByLabelText('Average power'), '175');
    await user.click(screen.getByRole('radio', { name: 'Race' }));
    const summary = screen.getByRole('region', { name: 'Every hour' });
    expect(within(summary).getByText('70 g')).toBeInTheDocument();
    expect(summary).toHaveTextContent('Race day');
  });

  test('°C / °F switch converts what is typed', async () => {
    const { user } = renderApp('/plan', api());
    const temp = await screen.findByLabelText('Temperature (optional)');
    await user.type(temp, '22');
    await user.click(screen.getByRole('button', { name: '°F' }));
    expect(temp).toHaveValue('72');
    expect(screen.getByRole('button', { name: '°F' })).toHaveAttribute('aria-pressed', 'true');
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
    // The "eat this per hour" line sits under the title and date
    expect(screen.getByText(/1 × Electrolyte drink, 1 × Oat bar, 100 ml water/)).toBeInTheDocument();
    expect(screen.getByText('60 g carbs · 600 ml · 300 mg sodium per hour')).toBeInTheDocument();

    const body = calls.find((c) => c.method === 'POST' && c.path === '/api/rides').body;
    expect(body).toMatchObject({
      name: 'Tuesday endurance',
      durationMin: 120,
      intensity: { avgPowerW: 175 },
      tempC: 22,
      indoor: false,
      rideType: 'training',
      foodIds: ['bar', 'gel', 'drink'],
    });
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('home lists saved rides with their "eat this per hour" summary and badges', async () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 120, intensity: { avgPowerW: 175 }, indoor: true, rideType: 'race' },
      user: toCalculatorUser(riderA, '2026-11-08'),
      foods: [bar, gel, drink],
    });
    renderApp('/', {
      ...api(),
      'GET /api/rides': [
        200,
        { rides: [{ id: 'r9', name: 'Zwift race', date: '2026-11-08T12:00:00.000Z', durationMin: 120, indoor: true, rideType: 'race', plan }] },
      ],
    });
    const link = await screen.findByRole('link', { name: /Zwift race/ });
    expect(link).toHaveAttribute('href', '/rides/r9');
    expect(link).toHaveTextContent('Race');
    expect(link).toHaveTextContent('Indoor');
    expect(link).toHaveTextContent('Each hour:');
    expect(link).toHaveTextContent(`${plan.targets.carbsGph} g carbs · 750 ml`);
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
