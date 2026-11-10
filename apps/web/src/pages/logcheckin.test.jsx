import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { buildFuelPlan, summarizeIntake, toCalculatorUser } from '@fuel-ride/fuel-core';
import { loggedIn, renderApp, rider } from '../test/utils.jsx';

// Rider A, ride T1 and the S1 foods (docs/FUELING_RULES.md §8)
const riderA = rider({ weightKg: 75, birthYear: 1986, sex: 'male', ftpW: 250, lthr: 165, trainedCarbRateGph: 60 });
const bar = { id: 'bar', name: 'Oat bar', type: 'bar', servingLabel: '1 bar', carbsG: 44, kcal: 250, sodiumMg: 150, fluidMl: 0 };
const gel = { id: 'gel', name: 'Energy gel', type: 'gel', servingLabel: '1 gel', carbsG: 22, kcal: 100, sodiumMg: 50, fluidMl: 0 };
const drink = { id: 'drink', name: 'Electrolyte drink', type: 'drink', servingLabel: '1 bottle', carbsG: 15, kcal: 60, sodiumMg: 400, fluidMl: 500 };
const foods = [bar, gel, drink];

const plan = buildFuelPlan({
  ride: { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22 },
  user: toCalculatorUser(riderA, '2026-11-03'),
  foods,
});
const ride = (overrides = {}) => ({
  id: 'r1',
  name: 'Tuesday endurance',
  date: '2026-11-03T12:00:00.000Z',
  durationMin: 120,
  tempC: 22,
  foodIds: ['bar', 'gel', 'drink'],
  plan,
  intake: [],
  plainWaterMl: 0,
  actual: null,
  status: 'planned',
  updatedAt: '2026-11-03T13:00:00.000Z',
  ...overrides,
});

// PATCH /rides/r1 behaves like the API: recomputes `actual` from the logged intake
const patchRide = ({ body }) => {
  const actual = summarizeIntake({ intake: body.intake, plainWaterMl: body.plainWaterMl, foods, durationMin: 120 });
  return [200, { ride: ride({ ...body, actual, updatedAt: '2026-11-03T18:00:00.000Z' }) }];
};

const base = (user = riderA) => ({
  ...loggedIn(user),
  'GET /api/foods': [200, { foods }],
  'GET /api/rides/r1': [200, { ride: ride() }],
  'GET /api/checkins': [200, { checkIns: [] }],
});

describe('log what you ate', () => {
  test('"Fill in as planned" logs the plan; saving shows what you actually ate per hour', async () => {
    const { user, calls } = renderApp('/rides/r1', { ...base(), 'PATCH /api/rides/r1': patchRide });
    await user.click(await screen.findByRole('button', { name: 'Fill in as planned' }));
    expect(screen.getByRole('status', { name: 'Oat bar servings' })).toHaveTextContent('2');
    expect(screen.getByRole('status', { name: 'Electrolyte drink servings' })).toHaveTextContent('2');
    expect(screen.getByLabelText('Plain water')).toHaveValue('200');

    await user.click(screen.getByRole('button', { name: 'Save what I ate' }));
    expect(await screen.findByText(/You ate/)).toHaveTextContent('You ate 59 g carbs/hr (plan 60)');

    const body = calls.find((c) => c.method === 'PATCH').body;
    expect(body).toEqual({
      actualDurationMin: null, // rode as planned
      intake: [
        { foodId: 'bar', servings: 2 },
        { foodId: 'drink', servings: 2 },
      ],
      plainWaterMl: 200,
      weightPreKg: null,
      weightPostKg: null,
      status: 'completed',
    });
  });

  test('− / + in half servings, plus a food that was not in the plan', async () => {
    const { user, calls } = renderApp('/rides/r1', {
      ...base(),
      'GET /api/rides/r1': [200, { ride: ride({ foodIds: ['bar'], plan: { ...plan, schedule: [] } }) }],
      'PATCH /api/rides/r1': patchRide,
    });
    await user.click(await screen.findByRole('button', { name: 'More Oat bar' }));
    await user.click(screen.getByRole('button', { name: 'More Oat bar' }));
    await user.click(screen.getByRole('button', { name: 'More Oat bar' }));
    expect(screen.getByRole('status', { name: 'Oat bar servings' })).toHaveTextContent('1½');
    await user.selectOptions(screen.getByLabelText('Ate something else?'), 'gel');
    await user.click(screen.getByRole('button', { name: 'More Energy gel' }));
    await user.click(screen.getByRole('button', { name: 'Save what I ate' }));
    // 1½ bars + ½ gel = 77 g over 2 h = 39 g/hr: under the plan's 60
    expect(await screen.findByText(/Below plan/)).toHaveTextContent('Below plan: you ate 39 of 60 g carbs/hr');
    expect(calls.find((c) => c.method === 'PATCH').body.intake).toEqual([
      { foodId: 'bar', servings: 1.5 },
      { foodId: 'gel', servings: 0.5 },
    ]);
  });

  test('weigh-ins in pounds are sent in kilograms', async () => {
    const { user, calls } = renderApp('/rides/r1', { ...base(rider({ ...riderA, units: 'imperial' })), 'PATCH /api/rides/r1': patchRide });
    await user.type(await screen.findByLabelText('Weight before (lb)'), '165.3');
    await user.type(screen.getByLabelText('Weight after (lb)'), '161.4');
    await user.click(screen.getByRole('button', { name: 'Save what I ate' }));
    await screen.findByText(/You didn’t log any carbs/);
    expect(calls.find((c) => c.method === 'PATCH').body).toMatchObject({ weightPreKg: 75, weightPostKg: 73.2 });
  });
});

describe('how what you ate compares with the plan (§9.0)', () => {
  const logged = (carbsGph, extra = {}) =>
    ride({
      status: 'completed',
      actual: { carbsGph, fluidMlPerHr: 500, sodiumMgPerHr: 0, durationMin: 120, targets: plan.targets, ...extra },
    });
  const summary = () => screen.getByRole('region', { name: 'What you ate' }).querySelector('.notice');

  test('on plan → green', async () => {
    renderApp('/rides/r1', { ...base(), 'GET /api/rides/r1': [200, { ride: logged(56) }] });
    await screen.findByRole('heading', { name: 'What you ate' });
    expect(summary()).toHaveClass('notice--success');
    expect(summary()).toHaveTextContent('You ate 56 g carbs/hr (plan 60)');
  });

  test('under the plan → orange, with both numbers (the reported ride: 27 of 60)', async () => {
    renderApp('/rides/r1', { ...base(), 'GET /api/rides/r1': [200, { ride: logged(27) }] });
    await screen.findByRole('heading', { name: 'What you ate' });
    expect(summary()).toHaveClass('notice--warning');
    expect(summary()).toHaveTextContent('Below plan: you ate 27 of 60 g carbs/hr');
  });

  test('nothing eaten → red', async () => {
    renderApp('/rides/r1', { ...base(), 'GET /api/rides/r1': [200, { ride: logged(0) }] });
    await screen.findByRole('heading', { name: 'What you ate' });
    expect(summary()).toHaveClass('notice--error');
    expect(summary()).toHaveTextContent('You didn’t log any carbs. The plan was 60 g/hr.');
  });

  test('a shorter ride than planned: the time is sent, and the comparison says so', async () => {
    const { user, calls } = renderApp('/rides/r1', {
      ...base(),
      'GET /api/rides/r1': [200, { ride: logged(31, { durationMin: 85, targets: { ...plan.targets, carbsGph: 55 } }) }],
      'PATCH /api/rides/r1': patchRide,
    });
    expect(await screen.findByText(/Over the 1 h 25 min you rode/)).toHaveTextContent('Below plan: you ate 31 of 55 g carbs/hr');

    const hours = screen.getByRole('textbox', { name: 'Hours' });
    const minutes = screen.getByRole('textbox', { name: 'Minutes' });
    await user.clear(hours);
    await user.type(hours, '1');
    await user.clear(minutes);
    await user.type(minutes, '25');
    expect(screen.getByText('Planned 2 h. Per-hour numbers use the time you rode.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update what I ate' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH').body.actualDurationMin).toBe(85));
  });
});

describe('recalculate plan', () => {
  test('a planned ride can be re-planned with the latest rules', async () => {
    const { user, calls } = renderApp('/rides/r1', {
      ...base(),
      'PATCH /api/rides/r1': ({ body }) => [200, { ride: ride({ ...body, updatedAt: '2026-11-07T10:00:00.000Z' }) }],
    });
    await user.click(await screen.findByRole('button', { name: 'Recalculate plan' }));
    await screen.findByRole('button', { name: 'Recalculate plan' });
    expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ foodIds: ['bar', 'gel', 'drink'] });
  });

  test('a completed ride keeps its plan (no recalculate)', async () => {
    renderApp('/rides/r1', { ...base(), 'GET /api/rides/r1': [200, { ride: ride({ status: 'completed' }) }] });
    await screen.findByRole('heading', { name: 'Tuesday endurance' });
    expect(screen.queryByRole('button', { name: 'Recalculate plan' })).not.toBeInTheDocument();
  });
});

describe('check-in', () => {
  const suggestions = {
    carbRate: { suggestedGph: 65, change: 5, reason: 'Your stomach handled 60 g/hr well on your last 3 long rides. Try 65 g/hr.' },
    flags: [{ code: 'more-fluid', message: 'Drink more next time.' }],
    measuredSweatRateMlPerHr: 1500,
  };

  test('all three scores are required', async () => {
    const { user, calls } = renderApp('/rides/r1/check-in', base());
    const stomach = await screen.findByRole('group', { name: 'Stomach' });
    await user.click(within(stomach).getByRole('radio', { name: '4' }));
    await user.click(screen.getByRole('button', { name: 'Save check-in' }));
    expect(screen.getAllByText('Pick 1 to 5')).toHaveLength(2);
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  test('saving shows the suggestions; accepting one updates the profile', async () => {
    let profile = riderA;
    const { user, calls } = renderApp('/rides/r1/check-in', {
      ...base(),
      'GET /api/auth/me': () => [200, { user: profile }],
      'POST /api/checkins': ({ body }) => [201, { checkIn: { id: 'c1', ...body, suggestions } }],
      'PATCH /api/users/me': ({ body }) => {
        profile = { ...profile, ...body };
        return [200, { user: profile }];
      },
    });
    const pick = (group, label) => within(screen.getByRole('group', { name: group })).getByRole('radio', { name: label });
    await user.click(await screen.findByRole('radio', { name: '5 Perfect' }));
    await user.click(pick('Energy', '4'));
    await user.click(pick('Legs', '1 Heavy / dead'));
    await user.click(screen.getByLabelText('I cramped'));
    await user.type(screen.getByLabelText('Notes (optional)'), 'Hot day');
    await user.click(screen.getByRole('button', { name: 'Save check-in' }));

    expect(await screen.findByText('Check-in saved.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST').body).toEqual({
      rideId: 'r1',
      giScore: 5,
      energyScore: 4,
      legsScore: 1,
      bonked: false,
      cramped: true,
      notes: 'Hot day',
    });
    expect(screen.getByText(/Try 65 g\/hr/)).toBeInTheDocument();
    expect(screen.getByText('Drink more next time.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Set my trained rate to 65 g/hr' }));
    expect(await screen.findByText('Your trained carb rate is now 65 g/hr.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use it for future plans' }));
    expect(await screen.findByText(/Future plans use your measured sweat rate/)).toBeInTheDocument();
    const patches = calls.filter((c) => c.method === 'PATCH' && c.path === '/api/users/me').map((c) => c.body);
    expect(patches).toEqual([{ trainedCarbRateGph: 65 }, { sweatRateMlPerHr: 1500 }]);
  });

  test('the ride page shows a saved check-in and its suggestions', async () => {
    renderApp('/rides/r1', {
      ...base(),
      'GET /api/checkins': [
        200,
        { checkIns: [{ id: 'c1', rideId: 'r1', giScore: 4, energyScore: 3, legsScore: 5, bonked: true, cramped: false, notes: 'Windy', suggestions }] },
      ],
    });
    const card = await screen.findByRole('region', { name: 'Check-in' });
    expect(card).toHaveTextContent('Stomach4/5');
    expect(card).toHaveTextContent('Legs5/5');
    expect(card).toHaveTextContent('Bonked');
    expect(within(card).getByRole('link', { name: 'Edit check-in' })).toHaveAttribute('href', '/rides/r1/check-in');
    expect(screen.getByRole('region', { name: 'Suggestions' })).toBeInTheDocument();
  });

  test('without a check-in, the ride page invites one', async () => {
    renderApp('/rides/r1', base());
    expect(await screen.findByRole('link', { name: 'Check in' })).toHaveAttribute('href', '/rides/r1/check-in');
  });
});
