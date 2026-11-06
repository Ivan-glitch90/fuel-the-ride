import { api } from './client.js';

export const updateProfile = async (patch) => (await api('/users/me', { method: 'PATCH', body: patch })).user;
