import { useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { ServerUnavailable } from '../components/layout/ServerUnavailable.jsx';
import { ConsentGate } from '../legal/ConsentGate.jsx';

/** Pages behind login. Remembers where the rider was going so login can send them back. */
export function RequireAuth() {
  const { user, isLoading, error, retry } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingScreen />;
  if (error) return <ServerUnavailable onRetry={retry} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return (
    <ConsentGate>
      <Outlet />
    </ConsentGate>
  );
}

/**
 * Login/signup pages. Riders who are already logged in when they open the page go to the app.
 * Logging in *on* the page doesn't trigger this: the page itself decides where to go next
 * (back to where the rider was headed, or to the profile after signup).
 */
export function PublicOnly({ children }) {
  const { user, isLoading, error, retry } = useAuth();
  const loggedInOnArrival = useRef(null);
  if (isLoading) return <LoadingScreen />;
  if (error) return <ServerUnavailable onRetry={retry} />;
  loggedInOnArrival.current ??= Boolean(user);
  if (loggedInOnArrival.current) return <Navigate to="/" replace />;
  return children;
}
