import { api } from './client.js';

export const listRides = async (query) => (await api('/rides', { query })).rides;
export const getRide = async (id) => (await api(`/rides/${id}`)).ride;
/** The response includes the fueling plan, computed on the server. */
export const createRide = async (ride) => (await api('/rides', { method: 'POST', body: ride })).ride;
