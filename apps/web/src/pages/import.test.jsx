import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { buildFuelPlan, toCalculatorUser } from '@fuel-ride/fuel-core';
import { fitFile, gpxFile } from '../lib/rideFile.test.js';
import { loggedIn, renderApp, rider } from '../test/utils.jsx';

const me = rider({ weightKg: 75, birthYear: 1986, sex: 'male', ftpW: 250, trainedCarbRateGph: 70 });
const bar = { id: 'bar', name: 'Oat bar', type: 'bar', servingLabel: '1 bar', carbsG: 44, kcal: 250, sodiumMg: 150, fluidMl: 0 };
const gel = { id: 'gel', name: 'Energy gel', type: 'gel', servingLabel: '1 gel', carbsG: 22, kcal: 100, sodiumMg: 50, fluidMl: 0 };
const base = { ...loggedIn(me), 'GET /api/foods': [200, { foods: [bar, gel] }], 'GET /api/checkins': [200, { checkIns: [] }] };

const savedRide = (body) => ({
  id: 'r9',
  ...body,
  archived: false,
  plan: buildFuelPlan({ ride: body, user: toCalculatorUser(me, body.date), foods: [bar, gel], autoSelectFoods: true }),
});

describe('import a finished ride from a file', () => {
  test('a FIT file fills the form; saving sends only the summary and opens the ride', async () => {
    let posted;
    const { user, calls } = renderApp('/rides/import', {
      ...base,
      'POST /api/rides': ({ body }) => {
        posted = savedRide(body);
        return [201, { ride: posted }];
      },
      'GET /api/rides/r9': () => [200, { ride: posted }],
    });
    await user.upload(await screen.findByLabelText('Choose a file'), fitFile());

    const facts = await screen.findByRole('region', { name: 'From the file' });
    expect(facts).toHaveTextContent('2 h');
    expect(facts).toHaveTextContent('60.1 km');
    expect(facts).toHaveTextContent('830 m');
    expect(facts).toHaveTextContent('1260 kJ');
    expect(screen.getByRole('radio', { name: 'kJ' })).toBeChecked(); // best data in the file
    expect(screen.getByLabelText('Work')).toHaveDisplayValue('1260');
    expect(screen.getByLabelText('Temperature (optional)')).toHaveDisplayValue('24');

    await user.click(screen.getByRole('button', { name: 'Save ride' }));
    expect(await screen.findByText('Ride imported. Add what you ate to compare it with what you needed.')).toBeInTheDocument();
    const body = calls.find((c) => c.method === 'POST' && c.path === '/api/rides').body;
    expect(body).toMatchObject({
      date: '2026-11-01T08:00:00.000Z',
      durationMin: 120,
      intensity: { workKj: 1260 },
      tempC: 24,
      indoor: false,
      status: 'completed',
      imported: { source: 'fit', startTime: '2026-11-01T08:00:00.000Z', distanceKm: 60.1, elevationGainM: 830 },
    });
    expect(JSON.stringify(body)).not.toMatch(/lat|lon|track/); // no GPS track leaves the phone
  });

  test('a GPX without power or heart rate asks how hard it felt', async () => {
    const { user } = renderApp('/rides/import', base);
    const noHr = gpxFile();
    const text = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsText(noHr);
    });
    await user.upload(await screen.findByLabelText('Choose a file'), new File([text.replace(/<extensions>.*?<\/extensions>/gs, '')], 'ride.gpx'));
    expect(await screen.findByText('This file has no power or heart-rate data. Choose how hard the ride felt.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name (optional)')).toHaveValue('Saturday gravel');
  });

  test('the same file twice: the server’s message shows', async () => {
    const { user } = renderApp('/rides/import', {
      ...base,
      'POST /api/rides': [409, { error: { code: 'RIDE_ALREADY_IMPORTED', message: 'This ride was already imported' } }],
    });
    await user.upload(await screen.findByLabelText('Choose a file'), fitFile());
    await user.click(await screen.findByRole('button', { name: 'Save ride' }));
    expect(await screen.findByText('This ride was already imported')).toBeInTheDocument();
  });

  test('a wrong file shows why', async () => {
    renderApp('/rides/import', base);
    // Some phones ignore the .fit/.gpx filter, so the page checks the file itself
    const input = await screen.findByLabelText('Choose a file');
    fireEvent.change(input, { target: { files: [new File(['hello'], 'notes.txt')] } });
    expect(await screen.findByText('Choose a .fit or .gpx file.')).toBeInTheDocument();
  });

  test('Home links to it', async () => {
    renderApp('/', { ...base, 'GET /api/rides': [200, { rides: [] }] });
    expect(await screen.findByRole('link', { name: 'Import a finished ride' })).toHaveAttribute('href', '/rides/import');
  });
});

describe('rides like this, while planning', () => {
  const similar = [
    {
      id: 'old1',
      name: 'Hilly loop',
      date: '2026-10-12T08:00:00.000Z',
      durationMin: 115,
      kcalPerHour: 640,
      carbsGph: 66,
      worked: true,
      checkIn: { giScore: 5, energyScore: 4, bonked: false },
      perHour: [
        { foodId: 'bar', name: 'Oat bar', servings: 1, archived: false },
        { foodId: 'gel', name: 'Energy gel', servings: 1, archived: false },
      ],
    },
  ];

  test('shows what you ate and how it went; one tap plans with the same foods', async () => {
    const { user, calls } = renderApp('/plan', {
      ...base,
      'GET /api/rides/similar': [200, { rides: similar }],
      'POST /api/rides': ({ body }) => [201, { ride: savedRide({ ...body, date: '2026-11-09T12:00:00.000Z' }) }],
      'GET /api/rides/r9': [404, { error: { code: 'RIDE_NOT_FOUND', message: 'Ride not found' } }],
    });
    await user.type(await screen.findByLabelText('Average power'), '175');

    const card = await screen.findByRole('region', { name: 'Rides like this' });
    expect(within(card).getByRole('link', { name: 'Hilly loop' })).toHaveAttribute('href', '/rides/old1');
    expect(card).toHaveTextContent('Worked well');
    expect(card).toHaveTextContent('Per hour: 1 × Oat bar, 1 × Energy gel');
    expect(card).toHaveTextContent('Stomach 5/5 · Energy 4/5');
    const query = calls.find((c) => c.path === '/api/rides/similar').query;
    expect(Number(query.durationMin)).toBe(120);

    await user.click(within(card).getByRole('button', { name: 'Plan with these foods' }));
    await user.click(screen.getByRole('button', { name: 'Save ride plan' }));
    expect(calls.find((c) => c.method === 'POST' && c.path === '/api/rides').body.foodIds).toEqual(['bar', 'gel']);
  });

  test('nothing similar → no card', async () => {
    const { user } = renderApp('/plan', { ...base, 'GET /api/rides/similar': [200, { rides: [] }] });
    await user.type(await screen.findByLabelText('Average power'), '175');
    await screen.findByRole('region', { name: 'Every hour' });
    expect(screen.queryByRole('region', { name: 'Rides like this' })).toBeNull();
  });
});
