import { api } from './client.js';

export const updateProfile = async (patch) => (await api('/users/me', { method: 'PATCH', body: patch })).user;
/** Records consent to the given Terms/Privacy version; returns the updated user. */
export const recordConsent = async (version) => (await api('/users/me/consent', { method: 'POST', body: { version } })).user;
/** Everything stored about the rider (GDPR copy of your data). */
export const exportMyData = () => api('/users/me/export');
/** Deletes the account and all its data. { confirm: 'DELETE', password? } */
export const deleteAccount = (body) => api('/users/me', { method: 'DELETE', body });
