import { api } from './client.js';

/**
 * Data for the progress charts, oldest point first.
 * @returns {Promise<{ current: { trainedGph }, carbRate: object[], energyBalance: object[] }>}
 */
export const getProgress = (query) => api('/progress', { query });
