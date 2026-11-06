import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loggedOut, renderApp, rider } from '../test/utils.jsx';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const CREDENTIAL = 'google-id-token-from-the-popup';

// Stand-in for Google Identity Services: renders a button that "picks" the Google account when clicked
function installFakeGoogle() {
  let callback;
  const id = {
    initialize: vi.fn((options) => {
      callback = options.callback;
    }),
    renderButton: vi.fn((element) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Continue with Google';
      button.addEventListener('click', () => callback({ credential: CREDENTIAL }));
      element.appendChild(button);
    }),
  };
  window.google = { accounts: { id } };
  return id;
}

const withGoogle = { ...loggedOut, 'GET /api/auth/providers': [200, { google: { clientId: CLIENT_ID } }] };

describe('Continue with Google', () => {
  let google;
  beforeEach(() => {
    google = installFakeGoogle();
  });
  afterEach(() => {
    delete window.google;
  });

  test("renders Google's official button with our client ID", async () => {
    renderApp('/login', withGoogle);
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(google.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: CLIENT_ID }));
    expect(google.renderButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ text: 'continue_with', logo_alignment: 'left' }),
    );
  });

  test('a returning rider goes straight into the app', async () => {
    const { user, calls } = renderApp('/login', {
      ...withGoogle,
      'POST /api/auth/google': [200, { user: rider(), created: false }],
      'GET /api/foods': [200, { foods: [] }],
    });
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByRole('heading', { name: /^Hi, / })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/auth/google').body).toEqual({ credential: CREDENTIAL });
  });

  test('a brand-new rider lands on their profile, from either page', async () => {
    const { user } = renderApp('/signup', {
      ...withGoogle,
      'POST /api/auth/google': [201, { user: rider(), created: true }],
    });
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText(/Add your weight so we can plan your rides/)).toBeInTheDocument();
  });

  test('an email registered with a password shows how to log in instead', async () => {
    const { user } = renderApp('/login', {
      ...withGoogle,
      'POST /api/auth/google': [
        409,
        {
          error: {
            code: 'EMAIL_REGISTERED_WITH_PASSWORD',
            message: 'An account with this email already exists. Log in with your email and password.',
          },
        },
      ],
    });
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByText(/Log in with your email and password/)).toBeInTheDocument();
  });

  test('no Google button when the API has it switched off', async () => {
    renderApp('/login', { ...loggedOut, 'GET /api/auth/providers': [200, { google: null }] });
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50)); // let the providers request settle
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
    expect(screen.queryByText('or')).not.toBeInTheDocument();
  });
});
