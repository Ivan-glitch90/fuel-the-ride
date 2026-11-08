import mongoose from 'mongoose';
import request from 'supertest';
import { clearDb, makeApp, newUser, startDb, stopDb } from './helpers.js';

const app = makeApp();
let rider;
let gelId;

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days) => new Date(Date.now() + days * DAY_MS).toISOString();

// Rider A* from FUELING_RULES.md §9A: FTP 270 now, trained 60
const profile = { weightKg: 75, birthYear: 1986, sex: 'male', ftpW: 270, lthr: 165, trainedCarbRateGph: 60 };
const lastRace = { durationMin: 180, intensity: { avgPowerW: 210, normalizedPowerW: 230 }, ftpAtTimeW: 250 };
const race = (overrides = {}) => ({ name: 'Gran Fondo', type: 'race', date: inDays(43), past: lastRace, ...overrides });

beforeAll(startDb);
beforeEach(async () => {
  rider = request.agent(app);
  await rider.post('/api/auth/register').send(newUser());
  await rider.patch('/api/users/me').send(profile);
  gelId = (await rider.post('/api/foods').send({ name: 'Gel', type: 'gel', carbsG: 22, kcal: 100 })).body.food.id;
});
afterEach(clearDb);
afterAll(stopDb);

describe('POST /api/events', () => {
  test('returns the event with its forecast (same effort at today’s FTP, build-up, race-day plan)', async () => {
    const res = await rider.post('/api/events').send(race({ foodIds: [gelId] }));
    expect(res.status).toBe(201);
    const { event } = res.body;
    expect(event).toMatchObject({ name: 'Gran Fondo', type: 'race', indoor: false, past: lastRace });
    const f = event.forecast;
    expect(f.projection.intensity).toEqual({ avgPowerW: 226.8, normalizedPowerW: 248.4 });
    expect(f.suggestedGoalGph).toBe(90);
    expect(f.gutTraining.weeks.map((w) => w.targetGph)).toEqual([65, 70, 75, 80, 85]);
    expect(f.plan.targets.carbsGph).toBe(85);
    expect(f.plan.schedule[0].items[0].name).toBe('Gel');
  });

  test('forecast follows today’s profile: raising FTP and trained rate changes it on the next read', async () => {
    const { id } = (await rider.post('/api/events').send(race())).body.event;
    await rider.patch('/api/users/me').send({ ftpW: 300, trainedCarbRateGph: 80 });
    const { forecast } = (await rider.get(`/api/events/${id}`)).body.event;
    expect(forecast.projection.intensity.avgPowerW).toBe(252); // 210 × 300/250
    expect(forecast.gutTraining.weeks.map((w) => w.targetGph)).toEqual([85, 90]);
    expect(forecast.plan.targets.carbsGph).toBe(90);
  });

  test('rider-set goal and expected duration', async () => {
    const res = await rider.post('/api/events').send(race({ carbGoalGph: 70, durationMin: 240 }));
    expect(res.body.event.forecast).toMatchObject({ goalGph: 70, durationMin: 240 });
    expect(res.body.event.forecast.plan.targets.carbsGph).toBe(70);
  });

  test.each([
    ['training is not an event type', { type: 'training' }, 'type'],
    ['no effort last time', { past: { durationMin: 180, intensity: {} } }, 'past.intensity'],
    ['last time too short', { past: { ...lastRace, durationMin: 5 } }, 'past.durationMin'],
    ['projected power out of range', { past: { durationMin: 120, intensity: { avgPowerW: 590 }, ftpAtTimeW: 200 } }, 'past.intensity.avgPowerW'],
    ['goal above 120', { carbGoalGph: 200 }, 'carbGoalGph'],
    ['unknown field', { mood: 'ready' }, ''],
  ])('%s → 400', async (_name, overrides, path) => {
    const res = await rider.post('/api/events').send(race(overrides));
    expect(res.status).toBe(400);
    if (path) expect(res.body.error.details.map((d) => d.path)).toContain(path);
  });

  test('missing weight → PROFILE_INCOMPLETE', async () => {
    const fresh = request.agent(app);
    await fresh.post('/api/auth/register').send(newUser({ email: 'new@example.com' }));
    const res = await fresh.post('/api/events').send(race());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PROFILE_INCOMPLETE');
  });
});

describe('events: the app picks the foods', () => {
  test('no foodIds → picked from the library on every read (new foods count automatically)', async () => {
    const { id, foodsAuto, forecast } = (await rider.post('/api/events').send(race())).body.event;
    expect(foodsAuto).toBe(true);
    expect(forecast.plan.foodSelection).toMatchObject({ mode: 'auto', profile: 'fast', foodIds: [gelId] });
    const drinkId = (
      await rider.post('/api/foods').send({ name: 'Mix', type: 'drink', carbsG: 15, kcal: 60, sodiumMg: 400, fluidMl: 500 })
    ).body.food.id;
    const again = (await rider.get(`/api/events/${id}`)).body.event;
    expect(again.forecast.plan.foodSelection.foodIds).toEqual([gelId, drinkId]);
  });

  test('foodIds → the rider’s picks; foodsAuto: true switches back', async () => {
    const { id } = (await rider.post('/api/events').send(race({ foodIds: [gelId] }))).body.event;
    const custom = (await rider.get(`/api/events/${id}`)).body.event;
    expect(custom.foodsAuto).toBe(false);
    expect(custom.forecast.plan.foodSelection.mode).toBe('manual');
    const back = (await rider.patch(`/api/events/${id}`).send({ foodsAuto: true })).body.event;
    expect(back.foodsAuto).toBe(true);
  });
});

describe('GET /api/events', () => {
  test('upcoming (soonest first) vs past', async () => {
    await rider.post('/api/events').send(race({ name: 'Later', date: inDays(60) }));
    await rider.post('/api/events').send(race({ name: 'Sooner', date: inDays(10) }));
    await rider.post('/api/events').send(race({ name: 'Last month', date: inDays(-30) }));
    const names = async (q) => (await rider.get(`/api/events${q}`)).body.events.map((e) => e.name);
    expect(await names('')).toEqual(['Sooner', 'Later']);
    expect(await names('?when=past')).toEqual(['Last month']);
    expect(await names('?when=all')).toHaveLength(3);
  });

  test('a forecast that can no longer be computed is reported, not a 500', async () => {
    const { id } = (await rider.post('/api/events').send(race())).body.event;
    const { User } = await import('../src/models/index.js');
    await User.updateOne({ email: 'rider@example.com' }, { $unset: { weightKg: 1 } });
    const { event } = (await rider.get(`/api/events/${id}`)).body;
    expect(event.forecast).toBeNull();
    expect(event.forecastError.code).toBe('PROFILE_INCOMPLETE');
  });
});

describe('PATCH / DELETE /api/events/:id', () => {
  test('patch re-forecasts; null clears optional fields', async () => {
    const { id } = (await rider.post('/api/events').send(race({ carbGoalGph: 70 }))).body.event;
    const res = await rider.patch(`/api/events/${id}`).send({ carbGoalGph: null, indoor: true });
    expect(res.status).toBe(200);
    expect(res.body.event.carbGoalGph).toBeUndefined();
    expect(res.body.event.forecast.goalGph).toBe(90);
    expect(res.body.event.forecast.plan.indoor).toBe(true);
  });

  test('invalid patch is not saved', async () => {
    const { id } = (await rider.post('/api/events').send(race())).body.event;
    expect((await rider.patch(`/api/events/${id}`).send({ carbGoalGph: 500 })).status).toBe(400);
    expect((await rider.get(`/api/events/${id}`)).body.event.carbGoalGph).toBeUndefined();
  });

  test('delete → 204, then 404', async () => {
    const { id } = (await rider.post('/api/events').send(race())).body.event;
    expect((await rider.delete(`/api/events/${id}`)).status).toBe(204);
    expect((await rider.get(`/api/events/${id}`)).status).toBe(404);
  });

  test("another rider's events are invisible", async () => {
    const { id } = (await rider.post('/api/events').send(race())).body.event;
    const other = request.agent(app);
    await other.post('/api/auth/register').send(newUser({ email: 'other@example.com' }));
    expect((await other.get('/api/events')).body.events).toEqual([]);
    expect((await other.get(`/api/events/${id}`)).status).toBe(404);
    expect((await other.patch(`/api/events/${id}`).send({ name: 'x' })).status).toBe(404);
    expect((await other.delete(`/api/events/${id}`)).status).toBe(404);
    expect((await rider.get(`/api/events/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });
});

describe('rides remember the FTP at the time', () => {
  test('ftpAtRideW is saved when a ride is planned', async () => {
    const res = await rider.post('/api/rides').send({ durationMin: 120, intensity: { avgPowerW: 200 } });
    expect(res.body.ride.ftpAtRideW).toBe(270);
  });
});
