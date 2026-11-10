import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loggedIn, loggedOut, renderApp, rider } from '../test/utils.jsx';
import { API_CACHE } from './offline.js';
import { UPDATE_READY_EVENT } from './pwa.js';

const home = { 'GET /api/foods': [200, { foods: [] }], 'GET /api/rides': [200, { rides: [] }] };

function setOnline(online) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  act(() => window.dispatchEvent(new Event(online ? 'online' : 'offline')));
}

let cacheDelete;
beforeEach(() => {
  cacheDelete = vi.fn(async () => true);
  globalThis.caches = { delete: cacheDelete };
});
afterEach(() => {
  delete globalThis.caches;
});

describe("can't reach the server", () => {
  test('shows a clear message instead of a blank page, and Try again recovers', async () => {
    let up = false;
    const { user } = renderApp('/', {
      // Not our JSON (e.g. a proxy error page) until the server is back
      'GET /api/auth/me': () => (up ? [200, { user: rider() }] : [200, undefined]),
      ...home,
    });
    expect(await screen.findByRole('heading', { name: "Can't reach the server" })).toBeInTheDocument();

    up = true;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: /^Hi, / })).toBeInTheDocument();
  });

  test('says when the phone itself is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderApp('/login', { 'GET /api/auth/me': [503, undefined] });
    expect(await screen.findByText(/You're offline\. Connect to the internet once/)).toBeInTheDocument();
  });
});

describe('offline', () => {
  test('a bar explains that saved data is shown and changes need a connection', async () => {
    renderApp('/', { ...loggedIn(), ...home });
    await screen.findByRole('heading', { name: /^Hi, / });
    expect(screen.queryByText(/You're offline/)).toBeNull();

    setOnline(false);
    expect(screen.getByText(/You're offline\. Showing what's saved on this phone/)).toBeInTheDocument();
    setOnline(true);
    expect(screen.queryByText(/You're offline/)).toBeNull();
  });

  test('logging out deletes the offline copy from this device', async () => {
    const { user } = renderApp('/settings', { ...loggedIn(), 'POST /api/auth/logout': [204] });
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    await screen.findByRole('heading', { name: 'Log in' });
    expect(cacheDelete).toHaveBeenCalledWith(API_CACHE);
  });

  test('logging in starts with an empty offline copy (never the previous rider’s)', async () => {
    const { user } = renderApp('/login', { ...loggedOut, ...home, 'POST /api/auth/login': [200, { user: rider() }] });
    await user.type(await screen.findByLabelText('Email'), 'rider@example.com');
    cacheDelete.mockClear(); // the 401 from /auth/me already cleared once
    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await screen.findByRole('heading', { name: /^Hi, / });
    expect(cacheDelete).toHaveBeenCalledWith(API_CACHE);
  });
});

describe('app updates', () => {
  test('a new version is offered with a Reload button and is never applied by itself', async () => {
    renderApp('/', { ...loggedIn(), ...home });
    await screen.findByRole('heading', { name: /^Hi, / });
    act(() => window.dispatchEvent(new Event(UPDATE_READY_EVENT)));
    expect(screen.getByText('A new version of Fuel the Ride is ready.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
