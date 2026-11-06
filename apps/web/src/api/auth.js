import { api } from './client.js';

export const getMe = async () => (await api('/auth/me')).user;
export const login = (credentials) => api('/auth/login', { method: 'POST', body: credentials });
export const register = (details) => api('/auth/register', { method: 'POST', body: details });
export const logout = () => api('/auth/logout', { method: 'POST' });
/** @returns {Promise<{ google: { clientId: string } | null }>} */
export const getProviders = () => api('/auth/providers');
/** @returns {Promise<{ user: object, created: boolean }>} */
export const loginWithGoogle = (credential) => api('/auth/google', { method: 'POST', body: { credential } });
