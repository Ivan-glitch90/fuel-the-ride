import mongoose from 'mongoose';
import request from 'supertest';
import { clearDb, makeApp, newUser, startDb, stopDb } from './helpers.js';

const app = makeApp();
let rider;
let foods; // { bar, gel, drink } → ids

// Rider A from docs/FUELING_RULES.md §8 (age 40 in 2026)
const riderAProfile = {
  weightKg: 75,
  birthYear: 1986,
  sex: 'male',
  ftpW: 250,
  lthr: 165,
  trainedCarbRateGph: 70,
  sweatSodium: 'average',
};

const FOOD_BODIES = {
  bar: { name: 'Oat bar', type: 'bar', servingLabel: '1 bar', carbsG: 44, kcal: 250, sodiumMg: 150 },
  gel: { name: 'Energy gel', type: 'gel', servingLabel: '1 gel', carbsG: 22, kcal: 100, sodiumMg: 50 },
  drink: { name: 'Electrolyte drink', type: 'drink', carbsG: 15, kcal: 60, sodiumMg: 400, fluidMl: 500 },
};

// Ride T1 from the spec, with the S1 foods (bar, gel, drink in that order)
const t1 = (overrides = {}) => ({
  name: 'Tuesday endurance',
  date: '2026-11-03T08:00:00.000Z',
  durationMin: 120,
  intensity: { avgPowerW: 175 },
  tempC: 22,
  foodIds: [foods.bar, foods.gel, foods.drink],
  ...overrides,
});

const createRide = (agent, body) => agent.post('/api/rides').send(body);

beforeAll(startDb);
beforeEach(async () => {
  rider = request.agent(app);
  await rider.post('/api/auth/register').send(newUser());
  await rider.patch('/api/users/me').send(riderAProfile);
  foods = {};
  for (const [key, body] of Object.entries(FOOD_BODIES)) {
    foods[key] = (await rider.post('/api/foods').send(body)).body.food.id;
  }
});
afterEach(clearDb);
afterAll(stopDb);

describe('POST /api/rides (returns the fueling plan)', () => {
  test('ride T1 → spec targets and the S1 schedule', async () => {
    const res = await createRide(rider, t1());
    expect(res.status).toBe(201);
    const { ride } = res.body;

    expect(ride).toMatchObject({ name: 'Tuesday endurance', durationMin: 120, status: 'planned', actual: null });
    expect(ride.intensitySource).toBe('power');
    expect(ride.plan.targets).toEqual({ carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300 });
    expect(ride.plan.kcalBurned).toBe(1260);
    expect(ride.plan.schedule).toHaveLength(2);
    expect(ride.plan.schedule[0].items.map((i) => [i.foodId, i.servings])).toEqual([
      [foods.drink, 1],
      [foods.bar, 1],
    ]);
    expect(ride.plan.totals).toEqual({ carbsG: 118, fluidMl: 1200, sodiumMg: 1100, kcal: 620 });
  });

  test('works with no foods: targets only, with the "add foods" note', async () => {
    const res = await createRide(rider, t1({ foodIds: undefined }));
    expect(res.status).toBe(201);
    expect(res.body.ride.plan.schedule).toEqual([]);
    expect(res.body.ride.plan.notes.map((n) => n.code)).toContain('NO_FOODS');
  });

  test('heart-rate ride uses the profile LTHR and FTP (spec T3)', async () => {
    const res = await createRide(rider, t1({ durationMin: 90, intensity: { avgHr: 145 }, tempC: 18 }));
    expect(res.status).toBe(201);
    expect(res.body.ride.plan.targets).toEqual({ carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300 });
    expect(res.body.ride.plan.intensity.kcalMethod).toBe('ftp');
  });

  test('profile without weight → 400 PROFILE_INCOMPLETE', async () => {
    const fresh = request.agent(app);
    await fresh.post('/api/auth/register').send(newUser({ email: 'new@example.com' }));
    const res = await createRide(fresh, t1({ foodIds: [] }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'PROFILE_INCOMPLETE', details: [{ path: 'profile.weightKg' }] });
  });

  test('HR zone with no FTP and no birth year → asks for the birth year', async () => {
    const fresh = request.agent(app);
    await fresh.post('/api/auth/register').send(newUser({ email: 'hr@example.com' }));
    await fresh.patch('/api/users/me').send({ weightKg: 70 });
    const res = await createRide(fresh, t1({ foodIds: [], intensity: { hrZone: 2 } }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'PROFILE_INCOMPLETE', details: [{ path: 'profile.birthYear' }] });
  });

  test.each([
    ['power zone 6', { intensity: { powerZone: 6 } }, 'intensity.powerZone'],
    ['power too high', { intensity: { avgPowerW: 900 } }, 'intensity.avgPowerW'],
    ['duration too short', { durationMin: 5 }, 'durationMin'],
    ['empty intensity', { intensity: {} }, 'intensity'],
    ['unknown intensity field', { intensity: { rpe: 7 } }, 'intensity'],
    ['same food twice', { foodIds: null }, 'foodIds'],
  ])('%s → 400 VALIDATION_FAILED', async (_name, overrides, path) => {
    const body = t1(overrides);
    if (overrides.foodIds === null) body.foodIds = [foods.gel, foods.gel];
    const res = await createRide(rider, body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.map((d) => d.path)).toContain(path);
  });

  test("another rider's food → 400 FOOD_NOT_FOUND", async () => {
    const other = request.agent(app);
    await other.post('/api/auth/register').send(newUser({ email: 'other@example.com' }));
    const theirGel = (await other.post('/api/foods').send(FOOD_BODIES.gel)).body.food.id;
    const res = await createRide(rider, t1({ foodIds: [theirGel] }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FOOD_NOT_FOUND');
  });
});

describe('GET /api/rides', () => {
  test('newest first, with limit and date filters', async () => {
    for (const day of ['01', '05', '03']) {
      await createRide(rider, t1({ name: `Nov ${day}`, date: `2026-11-${day}T08:00:00.000Z` }));
    }
    const names = async (query) => (await rider.get(`/api/rides${query}`)).body.rides.map((r) => r.name);
    expect(await names('')).toEqual(['Nov 05', 'Nov 03', 'Nov 01']);
    expect(await names('?limit=1')).toEqual(['Nov 05']);
    expect(await names('?from=2026-11-02&to=2026-11-04')).toEqual(['Nov 03']);
  });

  test("another rider's rides are invisible", async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    const other = request.agent(app);
    await other.post('/api/auth/register').send(newUser({ email: 'other@example.com' }));
    expect((await other.get('/api/rides')).body.rides).toEqual([]);
    expect((await other.get(`/api/rides/${id}`)).status).toBe(404);
    expect((await other.patch(`/api/rides/${id}`).send({ status: 'completed' })).status).toBe(404);
    expect((await other.delete(`/api/rides/${id}`)).status).toBe(404);
  });

  test('bad limit → 400', async () => {
    expect((await rider.get('/api/rides?limit=500')).status).toBe(400);
  });
});

describe('PATCH /api/rides/:id', () => {
  test('logging intake and water computes the actual totals', async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    const res = await rider.patch(`/api/rides/${id}`).send({
      intake: [
        { foodId: foods.bar, servings: 2 },
        { foodId: foods.drink, servings: 2 },
      ],
      plainWaterMl: 200,
      status: 'completed',
    });
    expect(res.status).toBe(200);
    expect(res.body.ride.status).toBe('completed');
    expect(res.body.ride.actual).toEqual({
      carbsG: 118,
      kcal: 620,
      fluidMl: 1200,
      sodiumMg: 1100,
      carbsGph: 59,
      fluidMlPerHr: 600,
      sodiumMgPerHr: 550,
    });
  });

  test('changing the duration recalculates the plan and the per-hour actuals', async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    await rider.patch(`/api/rides/${id}`).send({ intake: [{ foodId: foods.bar, servings: 2 }] });
    const res = await rider.patch(`/api/rides/${id}`).send({ durationMin: 180 });
    expect(res.body.ride.plan.targets.carbsGph).toBe(70); // [150,240) moderate 75, capped at 70
    expect(res.body.ride.plan.schedule).toHaveLength(3);
    expect(res.body.ride.actual.carbsGph).toBe(29); // 88 g over 3 h
  });

  test('changing intensity replaces it and re-plans', async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    const res = await rider.patch(`/api/rides/${id}`).send({ intensity: { workKj: 1500 } });
    expect(res.body.ride.intensity).toEqual({ workKj: 1500 });
    expect(res.body.ride.intensitySource).toBe('kj');
    expect(res.body.ride.plan.kcalBurned).toBe(1500);
  });

  test('editing a food later does not change the saved plan', async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    await rider.patch(`/api/foods/${foods.bar}`).send({ carbsG: 10, name: 'Renamed bar' });
    const ride = (await rider.get(`/api/rides/${id}`)).body.ride;
    const barItem = ride.plan.schedule[0].items.find((i) => i.foodId === foods.bar);
    expect(barItem).toMatchObject({ name: 'Oat bar', carbsG: 44 });
  });

  test('logging a food that is not yours → 400', async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    const res = await rider
      .patch(`/api/rides/${id}`)
      .send({ intake: [{ foodId: String(new mongoose.Types.ObjectId()), servings: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FOOD_NOT_FOUND');
  });

  test('weigh-ins can be set and cleared', async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    const set = await rider.patch(`/api/rides/${id}`).send({ weightPreKg: 75, weightPostKg: 73.2 });
    expect(set.body.ride).toMatchObject({ weightPreKg: 75, weightPostKg: 73.2 });
    const cleared = await rider.patch(`/api/rides/${id}`).send({ weightPostKg: null });
    expect(cleared.body.ride.weightPostKg).toBeUndefined();
  });

  test('empty patch or protected field → 400', async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    expect((await rider.patch(`/api/rides/${id}`).send({})).status).toBe(400);
    expect((await rider.patch(`/api/rides/${id}`).send({ plan: {} })).status).toBe(400);
  });
});

describe('DELETE /api/rides/:id and food archiving', () => {
  test('deletes the ride (and its check-in) → 204', async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    const checkIn = await rider.post('/api/checkins').send({ rideId: id, giScore: 4, energyScore: 4, legsScore: 4 });
    expect(checkIn.status).toBe(201);

    expect((await rider.delete(`/api/rides/${id}`)).status).toBe(204);
    expect((await rider.get(`/api/rides/${id}`)).status).toBe(404);
    expect((await rider.get(`/api/checkins/${checkIn.body.checkIn.id}`)).status).toBe(404);
  });

  test('a food in a saved plan is archived, not deleted', async () => {
    await createRide(rider, t1());
    const res = await rider.delete(`/api/foods/${foods.bar}`);
    expect(res.status).toBe(200);
    expect(res.body.archived).toBe(true);
  });

  test('a food only in the logged intake is archived, not deleted', async () => {
    const { id } = (await createRide(rider, t1({ foodIds: [] }))).body.ride;
    await rider.patch(`/api/rides/${id}`).send({ intake: [{ foodId: foods.gel, servings: 1 }] });
    expect((await rider.delete(`/api/foods/${foods.gel}`)).status).toBe(200);
  });

  test('an unused food is still deleted', async () => {
    await createRide(rider, t1({ foodIds: [foods.bar] }));
    expect((await rider.delete(`/api/foods/${foods.gel}`)).status).toBe(204);
  });
});
