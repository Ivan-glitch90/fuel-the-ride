import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { loggedOut, renderApp, rider } from '../test/utils.jsx';

describe('login and signup', () => {
  test('logged-out visitors are sent to the login page', async () => {
    renderApp('/foods', loggedOut);
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  test('logging in returns the rider to the page they wanted', async () => {
    const { user, calls } = renderApp('/foods', {
      ...loggedOut,
      'POST /api/auth/login': [200, { user: rider() }],
      'GET /api/foods': [200, { foods: [] }],
    });
    await user.type(await screen.findByLabelText('Email'), 'rider@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Your foods' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/auth/login').body).toEqual({
      email: 'rider@example.com',
      password: 'correct-horse',
    });
  });

  test('wrong password shows the server message', async () => {
    const { user } = renderApp('/login', {
      ...loggedOut,
      'POST /api/auth/login': [401, { error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' } }],
    });
    await user.type(await screen.findByLabelText('Email'), 'rider@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Email or password is incorrect')).toBeInTheDocument();
  });

  test('signup sends new riders to their profile with a welcome note', async () => {
    const { user } = renderApp('/signup', {
      ...loggedOut,
      'POST /api/auth/register': [201, { user: rider() }],
    });
    await user.type(await screen.findByLabelText('Name'), 'Test Rider');
    await user.type(screen.getByLabelText('Email'), 'rider@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.click(screen.getByRole('checkbox', { name: /16 or older/ }));
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText(/Add your weight so we can plan your rides/)).toBeInTheDocument();
  });

  test('the password can be shown and hidden', async () => {
    const { user } = renderApp('/login', loggedOut);
    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  test('a taken email shows under the email field', async () => {
    const { user } = renderApp('/signup', {
      ...loggedOut,
      'POST /api/auth/register': [409, { error: { code: 'EMAIL_TAKEN', message: 'An account with that email already exists' } }],
    });
    await user.type(await screen.findByLabelText('Name'), 'Test Rider');
    await user.type(screen.getByLabelText('Email'), 'rider@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.click(screen.getByRole('checkbox', { name: /16 or older/ }));
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByLabelText('Email')).toHaveAccessibleDescription(
      'An account with that email already exists',
    );
  });
});
