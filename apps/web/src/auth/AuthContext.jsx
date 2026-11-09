import { createContext, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth.js';

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
        if (err.status === 401) return null; // not logged in
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Mark logged out first, then drop every other cached response from this user.
  // (clear() would also drop ['me'] and make it refetch.)
  function forgetSession() {
    queryClient.setQueryData(ME_KEY, null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] });
  }

  const value = useMemo(
    () => ({
      user: me.data ?? null,
      isLoading: me.isPending,
      async login(credentials) {
        const { user } = await authApi.login(credentials);
        queryClient.setQueryData(ME_KEY, user);
        return user;
      },
      /** @returns {Promise<{ user: object, created: boolean }>} created = brand-new rider */
      async loginWithGoogle(credential) {
        const { user, created } = await authApi.loginWithGoogle(credential);
        queryClient.setQueryData(ME_KEY, user);
        return { user, created };
      },
      async register(details) {
        const { user } = await authApi.register(details);
        queryClient.setQueryData(ME_KEY, user);
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
    [me.data, me.isPending, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
