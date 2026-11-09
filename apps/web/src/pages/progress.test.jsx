import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { loggedIn, renderApp, rider } from '../test/utils.jsx';

const me = rider({ weightKg: 75, trainedCarbRateGph: 70 });
const progress = {
  current: { trainedGph: 70 },
  carbRate: [
    { rideId: 'r1', date: '2026-10-01T12:00:00.000Z', trainedGph: 60, targetGph: 60, actualGph: 58, giScore: 4 },
    { rideId: 'r2', date: '2026-10-15T12:00:00.000Z', trainedGph: 65, targetGph: 65, actualGph: null, giScore: 5 },
    { rideId: 'r3', date: '2026-11-01T12:00:00.000Z', trainedGph: 65, targetGph: 65, actualGph: 66, giScore: 4 },
  ],
  energyBalance: [
    { rideId: 'r1', date: '2026-10-01T12:00:00.000Z', name: 'Hill reps', kcalBurned: 1260, kcalEaten: 620 },
    { rideId: 'r3', date: '2026-11-01T12:00:00.000Z', name: 'Long ride', kcalBurned: 2400, kcalEaten: 1300 },
  ],
};
const api = (data = progress) => ({ ...loggedIn(me), 'GET /api/progress': [200, data] });

describe('progress page', () => {
  test('stat tiles: trained rate now, change, check-ins, eaten vs burned', async () => {
    renderApp('/progress', api());
    expect(await screen.findByText('70 g/hr', { selector: '.stat-tile__value' })).toBeInTheDocument();
    expect(screen.getByText('+10 since Oct 1')).toBeInTheDocument();
    expect(screen.getByText('3', { selector: '.stat-tile__value' })).toBeInTheDocument();
    expect(screen.getByText('52%', { selector: '.stat-tile__value' })).toBeInTheDocument(); // 1,920 / 3,660
  });

  test('gut-training chart: legend, end label, keyboard readout and table view', async () => {
    const { user } = renderApp('/progress', api());
    const section = await screen.findByRole('region', { name: 'Gut training' });
    expect(within(section).getByText('Trained rate')).toBeInTheDocument();
    expect(within(section).getByText('Ate (per ride)')).toBeInTheDocument();
    const chart = within(section).getByRole('img', { name: /60 g\/hr at the first check-in, 70 g\/hr now, over 3 check-ins/ });
    expect(within(section).getByText('70 g/hr', { selector: 'text' })).toBeInTheDocument();

    fireEvent.focus(chart); // focus starts on the latest check-in
    expect(within(section).getByRole('status')).toHaveTextContent('66 g/hr');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(within(section).getByRole('status')).toHaveTextContent('not logged');

    await user.click(within(section).getByRole('button', { name: 'Show as table' }));
    const rows = within(within(section).getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('60 g/hr58 g/hr60 g/hr4/5');
  });

  test('calories chart: each ride is focusable and reads out both values', async () => {
    renderApp('/progress', api());
    const section = await screen.findByRole('region', { name: 'Calories burned vs eaten' });
    const ride = within(section).getByRole('img', { name: /Long ride.*burned 2,400 kcal, ate 1,300 kcal/ });
    fireEvent.focus(ride);
    expect(within(section).getByRole('status')).toHaveTextContent('2,400 kcal');
    expect(within(section).getByRole('status')).toHaveTextContent('54%');
  });

  test('range filter re-requests with a from date; "All" sends none', async () => {
    const { user, calls } = renderApp('/progress', api());
    await screen.findByRole('region', { name: 'Gut training' });
    expect(calls.find((c) => c.path === '/api/progress').query.from).toBeDefined(); // default: last 90 days
    await user.click(screen.getByRole('radio', { name: 'All' }));
    await screen.findByRole('region', { name: 'Gut training' });
    expect(calls.filter((c) => c.path === '/api/progress').at(-1).query.from).toBeUndefined();
  });

  test('loads once and settles (the date range must not change on every render)', async () => {
    const { calls } = renderApp('/progress', api());
    await screen.findByRole('region', { name: 'Gut training' });
    await new Promise((r) => setTimeout(r, 300));
    expect(calls.filter((c) => c.path === '/api/progress')).toHaveLength(1);
    expect(document.querySelector('.is-refreshing')).toBeNull();
  });

  test('empty periods explain what to do', async () => {
    renderApp('/progress', api({ current: { trainedGph: 60 }, carbRate: [], energyBalance: [] }));
    expect(await screen.findByText(/No check-ins in this period/)).toBeInTheDocument();
    expect(screen.getByText(/No logged rides in this period/)).toBeInTheDocument();
  });

  test('Home links to progress with the current trained rate', async () => {
    renderApp('/', { ...loggedIn(me), 'GET /api/foods': [200, { foods: [] }], 'GET /api/rides': [200, { rides: [] }] });
    const link = await screen.findByRole('link', { name: /Gut training.*70 g\/hr.*See progress/ });
    expect(link).toHaveAttribute('href', '/progress');
  });
});
