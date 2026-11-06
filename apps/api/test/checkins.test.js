import mongoose from 'mongoose';
import request from 'supertest';
import { clearDb, makeApp, newUser, startDb, stopDb } from './helpers.js';

const app = makeApp();
let rider;
let foods;

const FOOD_BODIES = {
  bar: { name: 'Oat bar', type: 'bar', carbsG: 44, kcal: 250, sodiumMg: 150 },
  gel: { name: 'Energy gel', type: 'gel', carbsG: 22, kcal: 100, sodiumMg: 50 },
  drink: { name: 'Electrolyte drink', type: 'drink', carbsG: 15, kcal: 60, sodiumMg: 400, fluidMl: 500 },
};

const goodAnswers = { giScore: 4, energyScore: 4, legsScore: 4 };

async function setupRider(profile) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(newUser());
  await agent.patch('/api/users/me').send({ weightKg: 75, birthYear: 1986, sex: 'male', ftpW: 250, lthr: 165, ...profile });
  const ids = {};
  for (const [key, body] of Object.entries(FOOD_BODIES)) ids[key] = (await agent.post('/api/foods').send(body)).body.food.id;
  return { agent, ids };
}

/** Creates a 120-min ride on `day` and logs `intake` (default: 2 bars + 2 gels = 132 g → 66 g/hr). */
async function loggedRide(day, { intake, durationMin = 120, extra = {} } = {}) {
  const ride = (
    await rider.post('/api/rides').send({
      date: `2026-11-${day}T08:00:00.000Z`,
      durationMin,
      intensity: { avgPowerW: 175 },
      tempC: 22,
      foodIds: [foods.bar, foods.gel, foods.drink],
    })
  ).body.ride;
  const log = intake ?? [
    { foodId: foods.bar, servings: 2 },
    { foodId: foods.gel, servings: 2 },
  ];
  await rider.patch(`/api/rides/${ride.id}`).send({ intake: log, ...extra });
  return ride.id;
}

const checkIn = (rideId, answers = goodAnswers) => rider.post('/api/checkins').send({ rideId, ...answers });

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

describe('POST /api/checkins', () => {
  beforeEach(async () => {
    ({ agent: rider, ids: foods } = await setupRider({ trainedCarbRateGph: 60 }));
  });

  test('saves the answers, returns suggestions and completes the ride', async () => {
    const rideId = await loggedRide('01');
    const res = await checkIn(rideId, { ...goodAnswers, bonked: false, cramped: true, notes: 'Windy' });
    expect(res.status).toBe(201);
    expect(res.body.checkIn).toMatchObject({
      rideId,
      giScore: 4,
      energyScore: 4,
      legsScore: 4,
      bonked: false,
      cramped: true,
      notes: 'Windy',
      trainedGphAtCheckIn: 60,
    });
    expect(res.body.checkIn.suggestions).toEqual({
      carbRate: expect.objectContaining({ suggestedGph: null }),
      flags: expect.any(Array),
      measuredSweatRateMlPerHr: null,
    });
    expect((await rider.get(`/api/rides/${rideId}`)).body.ride.status).toBe('completed');
  });

  test('G1-style: 3 good long rides at the trained rate → suggests +5 (60 → 65)', async () => {
    const r1 = await loggedRide('01');
    const r3 = await loggedRide('03');
    const r5 = await loggedRide('05');
    await checkIn(r1, { ...goodAnswers, giScore: 4 });
    await checkIn(r3, { ...goodAnswers, giScore: 5 });
    const res = await checkIn(r5, { ...goodAnswers, giScore: 4 });
    expect(res.body.checkIn.suggestions.carbRate).toMatchObject({ suggestedGph: 65, change: 5 });
  });

  test('history only counts earlier rides, in ride-date order', async () => {
    const later = await loggedRide('10');
    const r1 = await loggedRide('01');
    const r3 = await loggedRide('03');
    await checkIn(later); // checked in first, but its ride is later
    await checkIn(r1);
    const res = await checkIn(r3);
    expect(res.body.checkIn.suggestions.carbRate.suggestedGph).toBeNull(); // only 2 qualifying rides so far
  });

  test('nothing logged → the rate was not tested, no change', async () => {
    const ride = (
      await rider.post('/api/rides').send({ durationMin: 120, intensity: { avgPowerW: 175 }, foodIds: [] })
    ).body.ride;
    const res = await checkIn(ride.id, { ...goodAnswers, giScore: 1 });
    expect(res.body.checkIn.suggestions.carbRate.suggestedGph).toBeNull();
    expect(res.body.checkIn.suggestions.carbRate.reason).toMatch(/did not test/);
  });

  test('H1-style: weigh-ins → more-fluid flag and a measured sweat rate of 1,500 ml/hr', async () => {
    const rideId = await loggedRide('01', {
      intake: [
        { foodId: foods.bar, servings: 2 },
        { foodId: foods.drink, servings: 2 },
      ],
      extra: { plainWaterMl: 200, weightPreKg: 75, weightPostKg: 73.2 },
    });
    const res = await checkIn(rideId);
    expect(res.body.checkIn.suggestions.flags.map((f) => f.code)).toContain('more-fluid');
    expect(res.body.checkIn.suggestions.measuredSweatRateMlPerHr).toBe(1500);
  });

  test('G4-style: low energy, good stomach, ate far below target → eat-more', async () => {
    const rideId = await loggedRide('01', { intake: [{ foodId: foods.gel, servings: 2 }] }); // 22 g/hr vs 60
    const res = await checkIn(rideId, { ...goodAnswers, giScore: 5, energyScore: 2 });
    expect(res.body.checkIn.suggestions.flags.map((f) => f.code)).toContain('eat-more');
    expect(res.body.checkIn.suggestions.carbRate.suggestedGph).toBeNull();
  });

  test('second check-in for the same ride → 409', async () => {
    const rideId = await loggedRide('01');
    await checkIn(rideId);
    const res = await checkIn(rideId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CHECKIN_EXISTS');
  });

  test.each([
    ['score 0', { giScore: 0 }],
    ['score 6', { legsScore: 6 }],
    ['fractional score', { energyScore: 3.5 }],
    ['missing legs score', { legsScore: undefined }],
    ['unknown field', { mood: 'happy' }],
  ])('%s → 400', async (_name, overrides) => {
    const rideId = await loggedRide('01');
    const res = await checkIn(rideId, { ...goodAnswers, ...overrides });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  test('unknown ride → 404', async () => {
    const res = await checkIn(String(new mongoose.Types.ObjectId()));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RIDE_NOT_FOUND');
  });
});

describe('G3-style decrease', () => {
  test('trained 70, ate ~66 g/hr, stomach 2 → suggests 60', async () => {
    ({ agent: rider, ids: foods } = await setupRider({ trainedCarbRateGph: 70 }));
    const rideId = await loggedRide('01');
    const res = await checkIn(rideId, { ...goodAnswers, giScore: 2 });
    expect(res.body.checkIn.suggestions.carbRate).toMatchObject({ suggestedGph: 60, change: -10 });
  });
});

describe('GET / PATCH / DELETE /api/checkins', () => {
  beforeEach(async () => {
    ({ agent: rider, ids: foods } = await setupRider({ trainedCarbRateGph: 70 }));
  });

  test('list (newest ride first) and filter by ride', async () => {
    const r1 = await loggedRide('01');
    const r5 = await loggedRide('05');
    await checkIn(r5);
    await checkIn(r1);
    const all = (await rider.get('/api/checkins')).body.checkIns;
    expect(all.map((c) => c.rideId)).toEqual([r5, r1]);
    const one = (await rider.get(`/api/checkins?rideId=${r1}`)).body.checkIns;
    expect(one).toHaveLength(1);
    expect(one[0].rideId).toBe(r1);
  });

  test('PATCH answers recomputes the suggestions', async () => {
    const rideId = await loggedRide('01');
    const { id } = (await checkIn(rideId)).body.checkIn;
    const res = await rider.patch(`/api/checkins/${id}`).send({ giScore: 1, notes: 'Stomach cramps after hour 1' });
    expect(res.status).toBe(200);
    expect(res.body.checkIn.notes).toBe('Stomach cramps after hour 1');
    expect(res.body.checkIn.suggestions.carbRate).toMatchObject({ suggestedGph: 60, change: -10 });
  });

  test('PATCH cannot move a check-in to another ride', async () => {
    const rideId = await loggedRide('01');
    const { id } = (await checkIn(rideId)).body.checkIn;
    expect((await rider.patch(`/api/checkins/${id}`).send({ rideId })).status).toBe(400);
  });

  test('DELETE → 204; deleting the ride also deletes its check-in', async () => {
    const r1 = await loggedRide('01');
    const r2 = await loggedRide('02');
    const c1 = (await checkIn(r1)).body.checkIn.id;
    const c2 = (await checkIn(r2)).body.checkIn.id;

    expect((await rider.delete(`/api/checkins/${c1}`)).status).toBe(204);
    expect((await rider.get(`/api/checkins/${c1}`)).status).toBe(404);

    await rider.delete(`/api/rides/${r2}`);
    expect((await rider.get(`/api/checkins/${c2}`)).status).toBe(404);
  });

  test("another rider's check-ins are invisible, and their rides can't be checked in", async () => {
    const rideId = await loggedRide('01');
    const { id } = (await checkIn(rideId)).body.checkIn;

    const other = request.agent(app);
    await other.post('/api/auth/register').send(newUser({ email: 'other@example.com' }));
    expect((await other.get('/api/checkins')).body.checkIns).toEqual([]);
    expect((await other.get(`/api/checkins/${id}`)).status).toBe(404);
    expect((await other.patch(`/api/checkins/${id}`).send({ giScore: 1 })).status).toBe(404);
    expect((await other.delete(`/api/checkins/${id}`)).status).toBe(404);
    expect((await other.post('/api/checkins').send({ rideId, ...goodAnswers })).status).toBe(404);
  });
});
