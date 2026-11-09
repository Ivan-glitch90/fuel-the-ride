import { useState } from 'react';
import { resendVerification } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';

/** Shown until the rider confirms their email. The app works meanwhile; password reset needs it. */
export function ConfirmEmailBanner() {
  const { user } = useAuth();
  const [state, setState] = useState('idle'); // idle | sending | sent | error

  if (!user || user.emailVerified) return null;

  async function resend() {
    setState('sending');
    try {
      await resendVerification();
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="confirm-banner" role="region" aria-label="Confirm your email">
      <p>
        <strong>Confirm your email.</strong> We sent a link to {user.email}.{' '}
        {state === 'sent' ? (
          <span>New link sent: check your inbox (and spam).</span>
        ) : (
          <button type="button" className="link-btn" onClick={resend} disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Send a new link'}
          </button>
        )}
        {state === 'error' && <span> Couldn&apos;t send it right now. Try again in a few minutes.</span>}
      </p>
    </div>
  );
}
