import { api } from './client.js';

export const updateProfile = async (patch) => (await api('/users/me', { method: 'PATCH', body: patch })).user;
/** Deletes the account and all its data. { confirm: 'DELETE', password? } */
export const deleteAccount = (body) => api('/users/me', { method: 'DELETE', body });
