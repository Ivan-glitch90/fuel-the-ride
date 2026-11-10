import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loggedIn, renderApp, rider } from '../test/utils.jsx';

const base = (plan) => ({ ...loggedIn(rider({ weightKg: 75, ftpW: 250, plan })), 'GET /api/foods': [200, { foods: [] }] });
const summary = {
  source: 'screenshot',
  name: 'Morning Ride',
  date: '2026-11-08',
  time: '07:42',
  durationMin: 126,
  elapsedMin: 140,
  distanceKm: 64.4,
  elevationGainM: 812,
  avgPowerW: 181,
  normalizedPowerW: null,
  workKj: 1363,
  avgHr: 139,
  tempC: null,
  indoor: false,
};
const picture = () => new File(['png'], 'Screenshot.png', { type: 'image/png' });

// jsdom can't decode or draw images: fake just those browser parts; the app code runs for real
class FakeImage {
  naturalWidth = 1170;
  naturalHeight = 2532; // a phone screenshot: shrunk to 1600 px tall
  set src(_url) {
    setTimeout(() => this.onload());
  }
}
let drawn;
beforeEach(() => {
  drawn = null;
  vi.stubGlobal('Image', FakeImage);
  URL.createObjectURL = vi.fn(() => 'blob:shot');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    return { drawImage: (_img, _x, _y, w, h) => (drawn = { w, h }) };
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
});
afterEach(() => vi.unstubAllGlobals());

describe('import from a screenshot (Premium)', () => {
  test('free riders see it as a Premium feature, with no way to upload', async () => {
    renderApp('/rides/import', base('free'));
    expect(await screen.findByText('Included with Premium.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Choose a screenshot')).toBeNull();
  });

  test('premium: the numbers fill the form to check; saving keeps the time for duplicate checks', async () => {
    const { user, calls } = renderApp('/rides/import', {
      ...base('premium'),
      'POST /api/rides/read-screenshot': [200, { summary }],
      'POST /api/rides': [409, { error: { code: 'RIDE_ALREADY_IMPORTED', message: 'This ride was already imported' } }],
    });
    expect(await screen.findByText(/sent to Anthropic \(Claude\) only to read the numbers/)).toBeInTheDocument();
    await user.upload(screen.getByLabelText('Choose a screenshot'), picture());

    const facts = await screen.findByRole('region', { name: 'From the screenshot' });
    expect(facts).toHaveTextContent('Read from your screenshot: check the numbers below before saving.');
    expect(facts).toHaveTextContent('64.4 km');
    expect(facts).toHaveTextContent('1363 kJ');
    expect(screen.getByLabelText('Name (optional)')).toHaveValue('Morning Ride');
    expect(calls.find((c) => c.path === '/api/rides/read-screenshot').body).toEqual({ image: 'AAAA', mediaType: 'image/jpeg' });
    expect(drawn).toEqual({ w: 739, h: 1600 }); // shrunk on the phone before sending

    await user.click(screen.getByRole('button', { name: 'Save ride' }));
    await screen.findByText('This ride was already imported');
    const body = calls.find((c) => c.method === 'POST' && c.path === '/api/rides').body;
    expect(body.imported).toMatchObject({ source: 'screenshot', distanceKm: 64.4, elevationGainM: 812 });
    expect(new Date(body.imported.startTime).getHours()).toBe(7); // 07:42 in the rider's own time zone
  });

  test('no date or time on the screenshot: asks for the date, and skips the duplicate check', async () => {
    const { user, calls } = renderApp('/rides/import', {
      ...base('premium'),
      'POST /api/rides/read-screenshot': [200, { summary: { ...summary, date: null, time: null } }],
      'POST /api/rides': [500, { error: { code: 'INTERNAL', message: 'stop here' } }],
    });
    await user.upload(await screen.findByLabelText('Choose a screenshot'), picture());
    expect(await screen.findByText(/The date wasn’t on the screenshot: set it below\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save ride' }));
    await screen.findByText('stop here');
    expect(calls.find((c) => c.method === 'POST' && c.path === '/api/rides').body.imported.startTime).toBeUndefined();
  });

  test('the server’s message shows when it can’t read the picture', async () => {
    const { user } = renderApp('/rides/import', {
      ...base('premium'),
      'POST /api/rides/read-screenshot': [
        422,
        { error: { code: 'NOT_A_RIDE_SCREENSHOT', message: "That doesn't look like a ride summary. Try a screenshot of one ride." } },
      ],
    });
    await user.upload(await screen.findByLabelText('Choose a screenshot'), picture());
    expect(await screen.findByText("That doesn't look like a ride summary. Try a screenshot of one ride.")).toBeInTheDocument();
  });
});
