import { api } from './client.js';

export const listFoods = async (query) => (await api('/foods', { query })).foods;
export const getFood = async (id) => (await api(`/foods/${id}`)).food;
export const createFood = async (food) => (await api('/foods', { method: 'POST', body: food })).food;
export const updateFood = async (id, patch) => (await api(`/foods/${id}`, { method: 'PATCH', body: patch })).food;
/** @returns {Promise<null | { archived: true, food: object }>} null when deleted, the food when archived instead */
export const deleteFood = (id) => api(`/foods/${id}`, { method: 'DELETE' });
