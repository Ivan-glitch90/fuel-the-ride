import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ErrorBoundary } from '../components/layout/ErrorBoundary.jsx';
import { mockApi } from '../test/utils.jsx';
import { redactTokens, scrubBrowserEvent, startErrorReporting } from './errorReporting.js';

describe('browser error reports carry no personal data', () => {
  test('one-time tokens in URLs are redacted everywhere', () => {
    const event = scrubBrowserEvent({
      request: {
        url: 'https://fuel-the-ride.onrender.com/reset-password?token=SECRET123',
        headers: { Cookie: 'x' },
        cookies: { a: 'b' },
        data: { password: 'p' },
      },
      transaction: '/verify-email?token=SECRET456',
      user: { id: 'u1', email: 'rider@example.com' },
      breadcrumbs: [{ category: 'navigation', data: { from: '/login', to: '/reset-password?token=SECRET789' } }],
    });
    const json = JSON.stringify(event);
    expect(json).not.toMatch(/SECRET/);
    expect(json).not.toMatch(/rider@example\.com/);
    expect(event.request).toEqual({ url: 'https://fuel-the-ride.onrender.com/reset-password?token=[redacted]', query_string: undefined });
    expect(event.user).toEqual({ id: 'u1' });
  });

  test('other URLs are untouched', () => {
    expect(redactTokens('/progress?from=2026-08-01')).toBe('/progress?from=2026-08-01');
  });
});

describe('startErrorReporting', () => {
  test('without a DSN, Sentry is never loaded', async () => {
    mockApi({ 'GET /api/client-config': [200, { sentryDsn: null, environment: 'production', release: 'abc1234' }] });
    await startErrorReporting();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  test('an unreachable API never breaks the app', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    await expect(startErrorReporting()).resolves.toBeUndefined();
  });
});

describe('ErrorBoundary', () => {
  test('a crashing page shows a reload screen instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs caught errors
    function Broken() {
      throw new Error('boom');
    }
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
