import { createContext, useContext, useEffect, useMemo } from 'react';
import { setReportingUser } from '../lib/errorReporting.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth.js';
import { clearOfflineData } from '../lib/offline.js';

export const ME_KEY = ['me'];
const AuthContext = createContext(null);

/** Shared session state: the logged-in user (also the profile), plus login/register/logout. */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await authApi.getMe();
      } catch (err) {
        if (err.status === 401) {
          await clearOfflineData(); // no session here: nobody's saved data should stay on the device
          return null; // not logged in
        }
        throw err; // offline with nothing saved, or the server is down: RequireAuth shows "Can't reach the server"
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Mark logged out first, then drop every other cached response from this user.
  // (clear() would also drop ['me'] and make it refetch.)
  // Also deletes the offline copy on this device (shared phones).
  function forgetSession() {
    queryClient.setQueryData(ME_KEY, null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] });
    clearOfflineData();
  }

  // A new session starts with an empty offline copy, never someone else's
  async function startSession(user) {
    await clearOfflineData();
    queryClient.setQueryData(ME_KEY, user);
  }

  // Error reports carry the rider's id only (never their email)
  useEffect(() => {
    setReportingUser(me.data?.id ?? null);
  }, [me.data?.id]);

  const value = useMemo(
    () => ({
      user: me.data ?? null,
      isLoading: me.isPending,
      /** Set when we couldn't find out who's logged in (offline with nothing saved, server down). */
      error: me.isError && !me.data ? me.error : null,
      retry: () => me.refetch(),
      async login(credentials) {
        const { user } = await authApi.login(credentials);
        await startSession(user);
        return user;
      },
      /** @returns {Promise<{ user: object, created: boolean }>} created = brand-new rider */
      async loginWithGoogle(credential) {
        const { user, created } = await authApi.loginWithGoogle(credential);
        await startSession(user);
        return { user, created };
      },
      async register(details) {
        const { user } = await authApi.register(details);
        await startSession(user);
        return user;
      },
      async logout() {
        try {
          await authApi.logout();
        } finally {
          forgetSession();
        }
      },
      /** The server already ended the session (account deleted, password reset): just forget it here. */
      forgetSession,
    }),
    [me.data, me.isPending, me.isError, me.error, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
