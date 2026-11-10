import { useState } from 'react';
import { useOnline } from '../../lib/offline.js';
import { Button } from '../ui/Button.jsx';
import { CloudOffIcon } from '../ui/icons.jsx';

/**
 * Shown instead of a blank page when the app can't find out who's logged in: no connection and
 * nothing saved on this phone yet, or the server is down.
 */
export function ServerUnavailable({ onRetry }) {
  const online = useOnline();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="unavailable">
      <h1 className="auth-page__brand">Fuel the Ride</h1>
      <section className="card form" aria-labelledby="unavailable-title">
        <CloudOffIcon size={40} />
        <h2 id="unavailable-title">Can&apos;t reach the server</h2>
        <p className="muted">
          {online
            ? 'Fuel the Ride is having trouble right now. Please try again in a moment.'
            : "You're offline. Connect to the internet once, and your plans will be available offline after that."}
        </p>
        <Button block onClick={retry} disabled={retrying} aria-busy={retrying || undefined}>
          {retrying ? 'Trying…' : 'Try again'}
        </Button>
      </section>
    </main>
  );
}
