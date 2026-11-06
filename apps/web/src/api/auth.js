import { api } from './client.js';

export const getMe = async () => (await api('/auth/me')).user;
export const login = (credentials) => api('/auth/login', { method: 'POST', body: credentials });
export const register = (details) => api('/auth/register', { method: 'POST', body: details });
export const logout = () => api('/auth/logout', { method: 'POST' });
