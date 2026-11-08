import { buildEventPlan, toCalculatorUser } from '@fuel-ride/fuel-core';
import { Event, Food } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { translateFuelError } from './fuelErrors.js';
import { getUser } from './userService.js';
import { loadLibrary } from './rideService.js';

const notFound = () => new HttpError(404, 'EVENT_NOT_FOUND', 'Event not found');
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of today (UTC) so an event later today still counts as upcoming. */
const startOfToday = (now) => new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);

async function loadFoods(userId, ids) {
  if (!ids?.length) return [];
  const docs = await Food.find({ _id: { $in: ids }, userId });
  if (docs.length !== ids.length) {
    throw new HttpError(400, 'FOOD_NOT_FOUND', 'Some foods were not found in your library', [
      { path: 'foodIds', message: 'Unknown food' },
    ]);
  }
  const byId = new Map(docs.map((d) => [String(d._id), d.toJSON()]));
  return ids.map((id) => byId.get(String(id)));
}

const plainEvent = (event) => {
  const e = event.toObject({ depopulate: true });
  return {
    type: e.type,
    date: e.date,
    durationMin: e.durationMin,
    tempC: e.tempC,
    indoor: e.indoor,
    carbGoalGph: e.carbGoalGph,
    past: { ...e.past, intensity: { ...e.past.intensity } },
  };
};

/** Runs the §9A calculator with today's profile. Throws translated 400s. */
async function computeForecast(user, event, now) {
  // App-picked events choose from the library on every read, so new foods are considered automatically
  const foods = event.foodsAuto ? await loadLibrary(user._id) : await loadFoods(user._id, event.foodIds.map(String));
  if (!user.weightKg) {
    throw new HttpError(400, 'PROFILE_INCOMPLETE', 'Complete your profile to plan this event', [
      { path: 'profile.weightKg', message: 'Add your weight' },
    ]);
  }
  try {
    return buildEventPlan({
      event: plainEvent(event),
      user: toCalculatorUser(user, event.date),
      foods,
      today: now.toISOString(),
      autoSelectFoods: event.foodsAuto,
    });
  } catch (err) {
    const translated = translateFuelError(err);
    // The effort the calculator checks is projected from what the rider typed under "last time"
    for (const detail of translated.details ?? []) {
      if (detail.path.startsWith('intensity.')) detail.path = `past.${detail.path}`;
    }
    throw translated;
  }
}

/** The event plus its forecast. On read, a forecast that can't be computed (e.g. profile emptied) is reported, not thrown. */
async function withForecast(user, event, now, { strict }) {
  try {
    return { ...event.toJSON(), forecast: await computeForecast(user, event, now) };
  } catch (err) {
    if (strict || !(err instanceof HttpError)) throw err;
    return { ...event.toJSON(), forecast: null, forecastError: { code: err.code, message: err.message, details: err.details } };
  }
}

export async function listEvents(userId, { when = 'upcoming' } = {}, now = new Date()) {
  const user = await getUser(userId);
  const filter = { userId };
  if (when === 'upcoming') filter.date = { $gte: startOfToday(now) };
  if (when === 'past') filter.date = { $lt: startOfToday(now) };
  const events = await Event.find(filter).sort({ date: when === 'past' ? -1 : 1 });
  return Promise.all(events.map((e) => withForecast(user, e, now, { strict: false })));
}

async function findEvent(userId, eventId) {
  const event = await Event.findOne({ _id: eventId, userId });
  if (!event) throw notFound();
  return event;
}

export async function getEvent(userId, eventId, now = new Date()) {
  const user = await getUser(userId);
  return withForecast(user, await findEvent(userId, eventId), now, { strict: false });
}

/** Creating/updating validates by computing the forecast: invalid inputs never get saved. */
export async function createEvent(userId, input, now = new Date()) {
  const user = await getUser(userId);
  // No foodIds → the app picks from the library (FUELING_RULES.md §7.0)
  const event = new Event({ ...input, userId, foodsAuto: input.foodIds === undefined, foodIds: input.foodIds ?? [] });
  const forecast = await computeForecast(user, event, now);
  await event.save();
  return { ...event.toJSON(), forecast };
}

export async function updateEvent(userId, eventId, patch, now = new Date()) {
  const user = await getUser(userId);
  const event = await findEvent(userId, eventId);
  for (const [key, value] of Object.entries(patch)) {
    event.set(key, value === null ? undefined : value);
  }
  if ('foodIds' in patch) event.foodsAuto = false; // the rider chose their own foods
  const forecast = await computeForecast(user, event, now);
  await event.save();
  return { ...event.toJSON(), forecast };
}

export async function deleteEvent(userId, eventId) {
  const event = await findEvent(userId, eventId);
  await event.deleteOne();
}
