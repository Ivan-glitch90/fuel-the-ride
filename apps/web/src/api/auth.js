import { api } from './client.js';

export const getMe = async () => (await api('/auth/me')).user;
export const login = (credentials) => api('/auth/login', { method: 'POST', body: credentials });
export const register = (details) => api('/auth/register', { method: 'POST', body: details });
export const logout = () => api('/auth/logout', { method: 'POST' });
// Account basics (see docs/ARCHITECTURE.md §5)
export const verifyEmail = (token) => api('/auth/verify-email', { method: 'POST', body: { token } });
export const resendVerification = () => api('/auth/resend-verification', { method: 'POST' });
/** Always succeeds the same way, whether or not the account exists. */
export const forgotPassword = (email) => api('/auth/forgot-password', { method: 'POST', body: { email } });
export const resetPassword = (token, password) => api('/auth/reset-password', { method: 'POST', body: { token, password } });

/** @returns {Promise<{ google: { clientId: string } | null }>} */
export const getProviders = () => api('/auth/providers');
/** @returns {Promise<{ user: object, created: boolean }>} */
export const loginWithGoogle = (credential) => api('/auth/google', { method: 'POST', body: { credential } });
