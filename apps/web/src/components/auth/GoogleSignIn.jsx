import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProviders } from '../../api/auth.js';
import { Notice } from '../ui/Notice.jsx';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiPromise = null;

/** Loads Google Identity Services once per page. */
function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  gsiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      gsiPromise = null;
      reject(new Error("Couldn't load Google sign-in. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

/**
 * Google's official "Continue with Google" button (Google logo, Google branding rules).
 * Renders nothing unless the API has Google sign-in configured.
 * Calls onCredential(idToken) when the rider picks their Google account.
 */
export function GoogleSignIn({ onCredential }) {
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: getProviders, staleTime: Infinity, retry: false });
  const clientId = providers.data?.google?.clientId;
  const buttonRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredentialRef.current(response.credential),
          ux_mode: 'popup',
          auto_select: false,
        });
        const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: Math.min(Math.max(buttonRef.current.offsetWidth || 320, 200), 400), // Google allows 200–400 px
        });
      })
      .catch((err) => !cancelled && setLoadError(err));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) return null;
  return (
    <div className="google-signin">
      <div className="divider" role="separator">
        <span>or</span>
      </div>
      <div ref={buttonRef} className="google-signin__button" />
      {loadError && <Notice tone="error">{loadError.message}</Notice>}
    </div>
  );
}
