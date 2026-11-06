import { api } from './client.js';

/** A ride has at most one check-in. Resolves to it, or null. */
export const getCheckInForRide = async (rideId) => (await api('/checkins', { query: { rideId } })).checkIns[0] ?? null;
/** The response includes `suggestions` (carb rate, hydration/sodium flags, measured sweat rate). */
export const createCheckIn = async (checkIn) => (await api('/checkins', { method: 'POST', body: checkIn })).checkIn;
export const updateCheckIn = async (id, patch) => (await api(`/checkins/${id}`, { method: 'PATCH', body: patch })).checkIn;
