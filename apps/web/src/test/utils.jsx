import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AppRoutes } from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

export const response = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json });

/**
 * Replaces fetch with a fake API. `routes` maps "METHOD /api/path" to either
 * [status, json] or a function ({ body, query }) => [status, json].
 * Returns the list of calls made, for assertions.
 */
export function mockApi(routes) {
  const calls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const [path, qs = ''] = String(url).split('?');
    const body = init.body ? JSON.parse(init.body) : undefined;
    const query = Object.fromEntries(new URLSearchParams(qs));
    calls.push({ method, path, query, body });
    const handler = routes[`${method} ${path}`];
    if (!handler) return response(404, { error: { code: 'NOT_FOUND', message: `No mock for ${method} ${path}` } });
    const [status, json] = typeof handler === 'function' ? handler({ body, query }) : handler;
    return response(status, json);
  });
  return calls;
}

/** Renders the whole app at `path` against a fake API. */
export function renderApp(path, routes) {
  const calls = mockApi(routes);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { calls, user };
}

export const rider = (overrides = {}) => ({
  id: 'u1',
  email: 'rider@example.com',
  name: 'Test Rider',
  units: 'metric',
  sex: 'unspecified',
  trainedCarbRateGph: 60,
  sweatSodium: 'average',
  emailVerified: true,
  hasPassword: true,
  ...overrides,
});

export const loggedOut = {
  'GET /api/auth/me': [401, { error: { code: 'UNAUTHENTICATED', message: 'Please log in' } }],
  'POST /api/auth/refresh': [401, { error: { code: 'INVALID_REFRESH_TOKEN', message: 'Please log in again' } }],
};

export const loggedIn = (user = rider()) => ({ 'GET /api/auth/me': [200, { user }] });
