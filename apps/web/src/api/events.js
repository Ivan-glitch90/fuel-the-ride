import { api } from './client.js';

/** Every event includes `forecast` (projected effort, gut-training build-up, race-day plan), computed with today's profile. */
export const listEvents = async (when = 'upcoming') => (await api('/events', { query: { when } })).events;
export const getEvent = async (id) => (await api(`/events/${id}`)).event;
export const createEvent = async (event) => (await api('/events', { method: 'POST', body: event })).event;
export const updateEvent = async (id, patch) => (await api(`/events/${id}`, { method: 'PATCH', body: patch })).event;
export const deleteEvent = (id) => api(`/events/${id}`, { method: 'DELETE' });
