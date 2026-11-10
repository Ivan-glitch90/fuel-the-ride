import { useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { recordConsent } from '../api/users.js';
import { ME_KEY, useAuth } from '../auth/AuthContext.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { t, tx } from '../i18n/index.js';
import { MIN_AGE, POLICY_VERSION } from './legalConfig.js';

/**
 * Before anything else: riders without consent to the current Terms + Privacy Policy
 * (new Google sign-ins, accounts from before, or after a policy change) must agree first.
 */
export function ConsentGate({ children }) {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!user?.consentRequired) return children;

  async function agree(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      queryClient.setQueryData(ME_KEY, await recordConsent(POLICY_VERSION));
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  const updated = Boolean(user.consentVersion); // agreed before, to an older version
  return (
    <div className="auth-page">
      <h1 className="auth-page__brand">Fuel the Ride</h1>
      <form className="card form" onSubmit={agree}>
        <h2>{updated ? t('We updated our Terms and Privacy Policy') : t('Before you start')}</h2>
        <p>
          {tx(
            'Fuel the Ride uses health data (your weight, heart rate and what you eat) to plan your fueling. Please read and agree to the <terms>Terms of Use</terms> and <privacy>Privacy Policy</privacy>.',
            {
              terms: (text) => <Link to="/terms">{text}</Link>,
              privacy: (text) => <Link to="/privacy">{text}</Link>,
            },
          )}
        </p>
        {error && <Notice tone="error">{error.message}</Notice>}
        <label className="checkbox checkbox--top">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>
            {t(
              "I'm {age} or older, I agree to the Terms and Privacy Policy, and I consent to Fuel the Ride using my health data to plan my fueling.",
              { age: MIN_AGE },
            )}
          </span>
        </label>
        <Button type="submit" block disabled={!checked} loading={saving}>
          {t('Agree and continue')}
        </Button>
        <Button variant="ghost" block onClick={() => logout()}>
          {t('Log out instead')}
        </Button>
      </form>
    </div>
  );
}
