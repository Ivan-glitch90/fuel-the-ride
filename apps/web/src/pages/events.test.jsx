import { screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { buildEventPlan, toCalculatorUser } from '@fuel-ride/fuel-core';
import { loggedIn, renderApp, rider } from '../test/utils.jsx';

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days) => new Date(Date.now() + days * DAY_MS).toISOString();

// Rider A* (FUELING_RULES.md §9A): FTP 270 today, trained 60
const riderAStar = rider({ weightKg: 75, birthYear: 1986, sex: 'male', ftpW: 270, lthr: 165, trainedCarbRateGph: 60 });
const gel = { id: 'gel', name: 'Energy gel', type: 'gel', servingLabel: '1 gel', carbsG: 22, kcal: 100, sodiumMg: 50, fluidMl: 0, favorite: true };
const lastRace = { durationMin: 180, intensity: { avgPowerW: 210, normalizedPowerW: 230 }, ftpAtTimeW: 250 };

/** An event as the API returns it: inputs + forecast computed with today's profile. */
function apiEvent(overrides = {}) {
  const inputs = { id: 'e1', name: 'Spring Gran Fondo', type: 'race', date: inDays(43), indoor: false, foodIds: ['gel'], past: lastRace, ...overrides };
  const forecast = buildEventPlan({
    event: inputs,
    user: toCalculatorUser(riderAStar, inputs.date),
    foods: [gel],
    today: new Date().toISOString(),
  });
  return { ...inputs, forecast };
}

const base = { ...loggedIn(riderAStar), 'GET /api/foods': [200, { foods: [gel] }], 'GET /api/rides': [200, { rides: [] }] };

describe('Events tab', () => {
  test('lists upcoming events with countdown and the "eat this per hour" line', async () => {
    renderApp('/events', { ...base, 'GET /api/events': [200, { events: [apiEvent()] }] });
    const link = await screen.findByRole('link', { name: /Spring Gran Fondo/ });
    expect(link).toHaveAttribute('href', '/events/e1');
    expect(link).toHaveTextContent('Race');
    expect(link).toHaveTextContent('in 6 weeks');
    expect(link).toHaveTextContent('85 g carbs');
    expect(screen.getByRole('link', { name: 'Events' })).toHaveClass('active');
  });

  test('empty state invites adding an event', async () => {
    renderApp('/events', { ...base, 'GET /api/events': [200, { events: [] }] });
    expect(await screen.findByRole('link', { name: 'Add your next race or group ride' })).toHaveAttribute('href', '/events/new');
  });
});

describe('new event: typed last-time data', () => {
  test('live forecast: same effort at today’s FTP, build-up, race-day plan; then saves', async () => {
    const { user, calls } = renderApp('/events/new', {
      ...base,
      'POST /api/events': ({ body }) => [201, { event: apiEvent({ ...body, id: 'e2' }) }],
      'GET /api/events/e2': [200, { event: apiEvent({ id: 'e2', name: 'Spring Gran Fondo' }) }],
    });
    await user.type(await screen.findByLabelText('Name'), 'Spring Gran Fondo');
    await user.clear(screen.getByLabelText('Hours'));
    await user.type(screen.getByLabelText('Hours'), '3');
    await user.type(screen.getByLabelText('Average power'), '210');
    await user.type(screen.getByLabelText('Normalized power (optional)'), '230');
    await user.type(screen.getByLabelText('FTP back then (functional threshold power)'), '250');

    const projection = screen.getByRole('region', { name: 'Projected effort' });
    expect(projection).toHaveTextContent('Last time: 210 W average at FTP 250 W');
    expect(projection).toHaveTextContent("today's FTP of 270 W, the same effort is about 227 W");

    const buildUp = screen.getByRole('region', { name: 'Gut training build-up' });
    expect(buildUp).toHaveTextContent('Race-day goal 90 g/hr');
    expect(within(buildUp).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('65 g/hr'),
      expect.stringContaining('70 g/hr'),
      expect.stringContaining('75 g/hr'),
      expect.stringContaining('80 g/hr'),
      expect.stringContaining('85 g/hr'),
      expect.stringMatching(/Race week.*85 g\/hr/),
    ]);
    expect(screen.getByText(/at a safe \+5–10 g\/hr per week you can reach about 85 g\/hr/)).toBeInTheDocument();
    expect(screen.getByLabelText('Carb goal (optional)')).toHaveAccessibleDescription(/Suggested for this event: 90 g\/hr/);

    await user.click(screen.getByRole('button', { name: 'Save event' }));
    expect(await screen.findByText('Event saved.')).toBeInTheDocument();
    const body = calls.find((c) => c.method === 'POST' && c.path === '/api/events').body;
    expect(body).toMatchObject({
      name: 'Spring Gran Fondo',
      type: 'race',
      indoor: false,
      past: { durationMin: 180, intensity: { avgPowerW: 210, normalizedPowerW: 230 }, ftpAtTimeW: 250, bonked: false },
    });
    expect(body.durationMin).toBeUndefined(); // "same duration as last time"
    expect(body.foodIds).toBeUndefined(); // the app picks from the library
    expect(screen.queryByRole('region', { name: 'Foods for today' })).toBeNull(); // we navigated to the event page
  });

  test('a lower goal makes the build-up reachable', async () => {
    const { user } = renderApp('/events/new', base);
    await user.clear(await screen.findByLabelText('Hours'));
    await user.type(screen.getByLabelText('Hours'), '3');
    await user.type(screen.getByLabelText('Average power'), '210');
    await user.type(screen.getByLabelText('FTP back then (functional threshold power)'), '250');
    await user.type(screen.getByLabelText('Carb goal (optional)'), '70');
    const buildUp = screen.getByRole('region', { name: 'Gut training build-up' });
    expect(buildUp).toHaveTextContent('Race-day goal 70 g/hr');
    expect(screen.queryByText(/you can reach about/)).not.toBeInTheDocument();
  });
});

describe('new event: filled from a logged ride', () => {
  test('picking a past race fills duration, power, FTP back then, carbs eaten and the check-in', async () => {
    const pastRide = {
      id: 'r1',
      name: 'Gran Fondo 2025',
      date: '2025-11-09T12:00:00.000Z',
      durationMin: 180,
      intensity: { avgPowerW: 210 },
      ftpAtRideW: 250,
      actual: { carbsGph: 45 },
      plan: { intensity: { avgPowerW: 210 } },
    };
    const { user } = renderApp('/events/new', {
      ...base,
      'GET /api/rides': [200, { rides: [pastRide] }],
      'GET /api/checkins': [200, { checkIns: [{ rideId: 'r1', giScore: 2, bonked: true }] }],
    });
    await user.selectOptions(await screen.findByLabelText('Fill from a logged ride (optional)'), 'r1');

    expect(await screen.findByDisplayValue('210')).toBe(screen.getByLabelText('Average power'));
    expect(screen.getByLabelText('Hours')).toHaveValue('3');
    expect(screen.getByLabelText('FTP back then (functional threshold power)')).toHaveValue('250');
    expect(screen.getByLabelText('Carbs you ate (optional)')).toHaveValue('45');
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
    expect(screen.getByLabelText('I bonked or ran low on energy')).toBeChecked();

    expect(screen.getByText(/Last time you ate 45 g\/hr and ran low/)).toBeInTheDocument();
    expect(screen.getByText(/Your stomach struggled last time at 45 g\/hr/)).toBeInTheDocument();
  });
});

describe('event page', () => {
  test('shows the forecast from the API with countdown, build-up and race-day plan', async () => {
    renderApp('/events/e1', { ...base, 'GET /api/events/e1': [200, { event: apiEvent() }] });
    expect(await screen.findByRole('heading', { name: 'Spring Gran Fondo' })).toBeInTheDocument();
    expect(screen.getByText(/in 6 weeks · 3 h/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Gut training build-up' })).toHaveTextContent('Race week');
    expect(screen.getByRole('region', { name: 'Every hour' })).toHaveTextContent('85 g');
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/events/e1/edit');
  });

  test('a forecast the API could not compute links to the profile', async () => {
    const broken = { ...apiEvent(), forecast: null, forecastError: { code: 'PROFILE_INCOMPLETE', message: 'Complete your profile to plan this event' } };
    renderApp('/events/e1', { ...base, 'GET /api/events/e1': [200, { event: broken }] });
    expect(await screen.findByText(/Complete your profile to plan this event/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to profile' })).toBeInTheDocument();
  });

  test('editing loads the saved inputs', async () => {
    renderApp('/events/e1/edit', { ...base, 'GET /api/events/e1': [200, { event: apiEvent({ carbGoalGph: 75 }) }] });
    expect(await screen.findByLabelText('Name')).toHaveValue('Spring Gran Fondo');
    expect(screen.getByLabelText('Average power')).toHaveValue('210');
    expect(screen.getByLabelText('Carb goal (optional)')).toHaveValue('75');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
