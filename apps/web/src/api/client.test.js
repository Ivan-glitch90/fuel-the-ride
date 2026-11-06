import { describe, expect, test, vi } from 'vitest';
import { api, ApiError, fieldErrors } from './client.js';
import { response } from '../test/utils.jsx';

const mockFetch = (impl) => vi.spyOn(globalThis, 'fetch').mockImplementation(impl);
const paths = (spy) => spy.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`);

describe('api()', () => {
  test('sends cookies and JSON, returns parsed JSON', async () => {
    const spy = mockFetch(async () => response(200, { ok: true }));
    expect(await api('/foods', { method: 'POST', body: { a: 1 }, query: { archived: 'false', x: undefined } })).toEqual({
      ok: true,
    });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/foods?archived=false');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', body: '{"a":1}' });
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  test('204 → null', async () => {
    mockFetch(async () => response(204));
    expect(await api('/foods/1', { method: 'DELETE' })).toBeNull();
  });

  test('error responses become ApiError with code and details', async () => {
    mockFetch(async () =>
      response(400, { error: { code: 'VALIDATION_FAILED', message: 'Bad', details: [{ path: 'carbsG', message: 'x' }] } }),
    );
    const err = await api('/foods').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_FAILED', message: 'Bad' });
    expect(err.details).toHaveLength(1);
  });

  test('network failure → ApiError NETWORK', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(api('/foods')).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
  });

  test('401 → refreshes the session once, then retries the request', async () => {
    let refreshed = false;
    const spy = mockFetch(async (url) => {
      if (url === '/api/auth/refresh') {
        refreshed = true;
        return response(200, { ok: true });
      }
      return refreshed ? response(200, { foods: [] }) : response(401, { error: { code: 'UNAUTHENTICATED' } });
    });
    expect(await api('/foods')).toEqual({ foods: [] });
    expect(paths(spy)).toEqual(['GET /api/foods', 'POST /api/auth/refresh', 'GET /api/foods']);
  });

  test('concurrent 401s share a single refresh', async () => {
    let refreshed = false;
    const spy = mockFetch(async (url) => {
      if (url === '/api/auth/refresh') {
        refreshed = true;
        return response(200, { ok: true });
      }
      return refreshed ? response(200, {}) : response(401, {});
    });
    await Promise.all([api('/foods'), api('/rides'), api('/users/me')]);
    expect(paths(spy).filter((p) => p.includes('refresh'))).toHaveLength(1);
  });

  test('failed refresh → the original 401 is thrown', async () => {
    mockFetch(async () => response(401, { error: { code: 'UNAUTHENTICATED', message: 'Please log in' } }));
    await expect(api('/foods')).rejects.toMatchObject({ status: 401 });
  });

  test('login is never retried through refresh', async () => {
    const spy = mockFetch(async () => response(401, { error: { code: 'INVALID_CREDENTIALS' } }));
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

test('fieldErrors maps details to fields and strips "profile."', () => {
  const err = new ApiError(400, {
    details: [
      { path: 'profile.weightKg', message: 'Add your weight' },
      { path: 'carbsG', message: 'first' },
      { path: 'carbsG', message: 'second' },
    ],
  });
  expect(fieldErrors(err)).toEqual({ weightKg: 'Add your weight', carbsG: 'first' });
  expect(fieldErrors(null)).toEqual({});
});
