import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { verifyEmail } from '../api/auth.js';
import { ME_KEY, useAuth } from '../auth/AuthContext.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { t, tx } from '../i18n/index.js';

/** /verify-email?token=…: opened from the confirmation email. Works logged in or out. */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: token ? 'working' : 'error' });
  const started = useRef(false); // links are single-use: never send the token twice (e.g. React StrictMode)

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then(({ email }) => {
        setState({ status: 'done', email });
        queryClient.invalidateQueries({ queryKey: ME_KEY }); // the "confirm your email" banner goes away
      })
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, [token, queryClient]);

  return (
    <div className="auth-page">
      <h1 className="auth-page__brand">Fuel the Ride</h1>
      <div className="card form">
        <h2>{t('Confirm your email')}</h2>
        {state.status === 'working' && <LoadingScreen label={t('Confirming…')} />}
        {state.status === 'done' && (
          <>
            <Notice tone="success">
              {tx('<strong>{email}</strong> is confirmed. Thanks!', { strong: () => <strong>{state.email}</strong> })}
            </Notice>
            <Link to={user ? '/' : '/login'} className="btn btn--primary btn--block">
              {user ? t('Go to the app') : t('Log in')}
            </Link>
          </>
        )}
        {state.status === 'error' && (
          <>
            <Notice tone="error">{state.message ?? t('This link is incomplete. Open it again from the email.')}</Notice>
            <p className="muted">
              {user
                ? t('You can ask for a new link from the banner at the top of the app.')
                : t('Log in to ask for a new link.')}
            </p>
            <Link to={user ? '/' : '/login'} className="btn btn--secondary btn--block">
              {user ? t('Go to the app') : t('Log in')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
