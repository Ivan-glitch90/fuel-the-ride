import { screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { loggedIn, loggedOut, renderApp, rider } from '../test/utils.jsx';
import { LEGAL, POLICY_VERSION } from './legalConfig.js';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const home = { 'GET /api/foods': [200, { foods: [] }], 'GET /api/rides': [200, { rides: [] }] };

describe('privacy policy and terms', () => {
  test('both pages are public and readable logged out', async () => {
    renderApp('/privacy', loggedOut);
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3. Health data' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Version ${POLICY_VERSION}`))).toBeInTheDocument();
  });

  test('terms lead with the medical disclaimer', async () => {
    renderApp('/terms', loggedOut);
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms of Use' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Not medical advice' })).toHaveTextContent(/Talk to a doctor before following any plan/);
  });

  test('operator details come from legalConfig (placeholders while unset)', async () => {
    renderApp('/terms', loggedOut);
    await screen.findByRole('heading', { level: 1, name: 'Terms of Use' });
    const shows = (value, label) => new RegExp(escape(value ?? `[${label}]`));
    expect(document.body.textContent).toMatch(shows(LEGAL.operatorName, 'operator name'));
    expect(document.body.textContent).toMatch(shows(LEGAL.contactEmail, 'contact email'));
    expect(document.body.textContent).toMatch(shows(LEGAL.governingLaw, 'governing law'));
  });

  test('login and signup link to both', async () => {
    renderApp('/login', loggedOut);
    expect(await screen.findByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms');
  });
});

describe('signup consent', () => {
  test('the checkbox is required; then acceptTerms is sent', async () => {
    const { user, calls } = renderApp('/signup', { ...loggedOut, 'POST /api/auth/register': [201, { user: rider() }] });
    await user.type(await screen.findByLabelText('Name'), 'Test Rider');
    await user.type(screen.getByLabelText('Email'), 'rider@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please confirm to create your account');
    expect(calls.some((c) => c.path === '/api/auth/register')).toBe(false);

    await user.click(screen.getByRole('checkbox', { name: /16 or older.*health data/ }));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByRole('heading', { name: 'Profile' });
    expect(calls.find((c) => c.path === '/api/auth/register').body).toMatchObject({ acceptTerms: true });
  });
});

describe('consent gate', () => {
  test('riders without current consent must agree before using the app', async () => {
    let me = rider({ consentRequired: true, consentVersion: null });
    const { user, calls } = renderApp('/', {
      'GET /api/auth/me': () => [200, { user: me }],
      ...home,
      'POST /api/users/me/consent': ({ body }) => {
        me = rider({ consentRequired: false, consentVersion: body.version });
        return [200, { user: me }];
      },
    });
    expect(await screen.findByRole('heading', { name: 'Before you start' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Hi, / })).toBeNull();
    const agree = screen.getByRole('button', { name: 'Agree and continue' });
    expect(agree).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(agree);
    expect(await screen.findByRole('heading', { name: /^Hi, / })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/users/me/consent').body).toEqual({ version: POLICY_VERSION });
  });

  test('after a policy change the wording says it was updated', async () => {
    renderApp('/', { ...loggedIn(rider({ consentRequired: true, consentVersion: '2025-01-01' })), ...home });
    expect(await screen.findByRole('heading', { name: 'We updated our Terms and Privacy Policy' })).toBeInTheDocument();
  });
});

describe('download my data', () => {
  test('fetches the export and saves it as a dated JSON file', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      this.dataset.clickedDownload = this.download;
    });
    const { user, calls } = renderApp('/settings', {
      ...loggedIn(),
      'GET /api/users/me/export': [200, { exportedAt: '2026-11-09T12:00:00.000Z', format: 'fuel-the-ride-export/1', account: {} }],
    });
    await user.click(await screen.findByRole('button', { name: 'Download my data' }));
    expect(await screen.findByText(/Downloaded/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/users/me/export')).toBe(true);
    expect(click).toHaveBeenCalled();
    expect(click.mock.contexts[0].download).toBe('fuel-the-ride-data-2026-11-09.json');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});
