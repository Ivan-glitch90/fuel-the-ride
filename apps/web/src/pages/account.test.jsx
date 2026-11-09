import { screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { loggedIn, loggedOut, renderApp, rider } from '../test/utils.jsx';

const TOKEN = 'a'.repeat(43);
const home = { 'GET /api/foods': [200, { foods: [] }], 'GET /api/rides': [200, { rides: [] }] };

describe('confirm email', () => {
  test('unconfirmed riders see a banner and can ask for a new link', async () => {
    const { user, calls } = renderApp('/', {
      ...loggedIn(rider({ emailVerified: false })),
      ...home,
      'POST /api/auth/resend-verification': [204],
    });
    const banner = await screen.findByRole('region', { name: 'Confirm your email' });
    expect(banner).toHaveTextContent('We sent a link to rider@example.com');
    await user.click(within(banner).getByRole('button', { name: 'Send a new link' }));
    expect(await within(banner).findByText(/New link sent/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/auth/resend-verification')).toBe(true);
  });

  test('confirmed riders see no banner', async () => {
    renderApp('/', { ...loggedIn(), ...home });
    await screen.findByRole('heading', { name: /^Hi, / });
    expect(screen.queryByRole('region', { name: 'Confirm your email' })).toBeNull();
  });

  test('the link from the email confirms once and says so', async () => {
    const { calls } = renderApp(`/verify-email?token=${TOKEN}`, {
      ...loggedOut,
      'POST /api/auth/verify-email': [200, { ok: true, email: 'rider@example.com' }],
    });
    expect(await screen.findByText(/is confirmed/)).toHaveTextContent('rider@example.com is confirmed');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(calls.filter((c) => c.path === '/api/auth/verify-email')).toEqual([
      expect.objectContaining({ body: { token: TOKEN } }),
    ]);
  });

  test('an expired link explains what to do', async () => {
    renderApp(`/verify-email?token=${TOKEN}`, {
      ...loggedOut,
      'POST /api/auth/verify-email': [400, { error: { code: 'INVALID_TOKEN', message: 'This link is invalid or has expired. Ask for a new one.' } }],
    });
    expect(await screen.findByText(/invalid or has expired/)).toBeInTheDocument();
  });
});

describe('forgot / reset password', () => {
  test('login links to "Forgot your password?"', async () => {
    renderApp('/login', loggedOut);
    expect(await screen.findByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/forgot-password');
  });

  test('forgot password gives the same neutral answer', async () => {
    const { user, calls } = renderApp('/forgot-password', { ...loggedOut, 'POST /api/auth/forgot-password': [204] });
    await user.type(await screen.findByLabelText('Email'), 'rider@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/If/)).toHaveTextContent('If rider@example.com belongs to an account');
    expect(calls.find((c) => c.path === '/api/auth/forgot-password').body).toEqual({ email: 'rider@example.com' });
  });

  test('reset: passwords must match; success sends the rider to log in again', async () => {
    const { user, calls } = renderApp(`/reset-password?token=${TOKEN}`, { ...loggedOut, 'POST /api/auth/reset-password': [204] });
    await user.type(await screen.findByLabelText('New password'), 'new-password-123');
    await user.type(screen.getByLabelText('Repeat new password'), 'something-else');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByLabelText('Repeat new password')).toHaveAccessibleDescription("Passwords don't match");
    expect(calls.some((c) => c.path === '/api/auth/reset-password')).toBe(false);

    await user.clear(screen.getByLabelText('Repeat new password'));
    await user.type(screen.getByLabelText('Repeat new password'), 'new-password-123');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/auth/reset-password').body).toEqual({ token: TOKEN, password: 'new-password-123' });
  });

  test('an expired reset link offers a new one', async () => {
    const { user } = renderApp(`/reset-password?token=${TOKEN}`, {
      ...loggedOut,
      'POST /api/auth/reset-password': [400, { error: { code: 'INVALID_TOKEN', message: 'This link is invalid or has expired. Ask for a new one.' } }],
    });
    await user.type(await screen.findByLabelText('New password'), 'new-password-123');
    await user.type(screen.getByLabelText('Repeat new password'), 'new-password-123');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('link', { name: 'Ask for a new link' })).toHaveAttribute('href', '/forgot-password');
  });
});

describe('delete account', () => {
  test('password + DELETE, then back to the login page', async () => {
    let deleted = false;
    const { user, calls } = renderApp('/settings', {
      'GET /api/auth/me': () => (deleted ? [401, {}] : [200, { user: rider() }]),
      'POST /api/auth/refresh': [401, {}],
      'DELETE /api/users/me': () => {
        deleted = true;
        return [204];
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));
    const confirmButton = screen.getByRole('button', { name: 'Delete everything' });
    expect(confirmButton).toBeDisabled();
    await user.type(screen.getByLabelText('Your password'), 'correct-horse');
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(confirmButton);

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'DELETE').body).toEqual({ confirm: 'DELETE', password: 'correct-horse' });
  });

  test('wrong password is shown, nothing deleted', async () => {
    const { user } = renderApp('/settings', {
      ...loggedIn(),
      'DELETE /api/users/me': [401, { error: { code: 'INVALID_CREDENTIALS', message: 'Password is incorrect' } }],
    });
    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Your password'), 'wrong');
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete everything' }));
    expect(await screen.findByText('Password is incorrect')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
  });

  test('Google-only riders aren’t asked for a password', async () => {
    const { user } = renderApp('/settings', loggedIn(rider({ hasPassword: false })));
    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));
    expect(screen.queryByLabelText('Your password')).toBeNull();
    expect(screen.getByLabelText('Type DELETE to confirm')).toBeInTheDocument();
  });
});
