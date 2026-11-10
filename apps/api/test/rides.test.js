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

  test('explicitly no foods: targets only, with the "add foods" note', async () => {
    const res = await createRide(rider, t1({ foodIds: [] }));
    expect(res.status).toBe(201);
    expect(res.body.ride.foodsAuto).toBe(false);
    expect(res.body.ride.plan.schedule).toEqual([]);
    expect(res.body.ride.plan.notes.map((n) => n.code)).toContain('NO_FOODS');
  });
});

describe('the app picks the foods (FUELING_RULES.md §7.0)', () => {
  test('no foodIds → picked from the library by effort; same plan as spec S1', async () => {
    const res = await createRide(rider, t1({ foodIds: undefined }));
    expect(res.status).toBe(201);
    const { ride } = res.body;
    expect(ride.foodsAuto).toBe(true);
    expect(ride.plan.foodSelection).toEqual({ mode: 'auto', profile: 'mixed', foodIds: [foods.bar, foods.gel, foods.drink] });
    expect(ride.foodIds).toEqual([foods.bar, foods.gel, foods.drink]);
    expect(ride.plan.schedule[0].items.map((i) => i.foodId)).toEqual([foods.drink, foods.bar]);
  });

  test('race → gels before the bar', async () => {
    const { ride } = (await createRide(rider, t1({ foodIds: undefined, rideType: 'race' }))).body;
    expect(ride.plan.foodSelection.profile).toBe('fast');
    expect(ride.plan.schedule[0].items.map((i) => i.foodId)).toEqual([foods.drink, foods.gel]);
  });

  test('recalculating re-picks from the current library; archived foods drop out', async () => {
    const { id } = (await createRide(rider, t1({ foodIds: undefined }))).body.ride;
    await rider.patch(`/api/foods/${foods.bar}`).send({ archived: true });
    const res = await rider.patch(`/api/rides/${id}`).send({ foodsAuto: true });
    expect(res.body.ride.foodIds).toEqual([foods.gel, foods.drink]);
    expect(res.body.ride.plan.schedule[0].items.map((i) => i.foodId)).not.toContain(foods.bar);
  });

  test('choosing foods switches to the rider’s picks; foodsAuto: true switches back', async () => {
    const { id } = (await createRide(rider, t1({ foodIds: undefined }))).body.ride;
    const custom = await rider.patch(`/api/rides/${id}`).send({ foodIds: [foods.gel] });
    expect(custom.body.ride).toMatchObject({ foodsAuto: false, foodIds: [foods.gel] });
    expect(custom.body.ride.plan.foodSelection.mode).toBe('manual');
    const back = await rider.patch(`/api/rides/${id}`).send({ foodsAuto: true });
    expect(back.body.ride.foodsAuto).toBe(true);
    expect(back.body.ride.foodIds).toHaveLength(3);
  });

  test('foodsAuto: false is not accepted (send foodIds instead)', async () => {
    const { id } = (await createRide(rider, t1({ foodIds: undefined }))).body.ride;
    expect((await rider.patch(`/api/rides/${id}`).send({ foodsAuto: false })).status).toBe(400);
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

describe('indoor rides and ride types', () => {
  test('defaults: outdoor training ride', async () => {
    const { ride } = (await createRide(rider, t1())).body;
    expect(ride).toMatchObject({ indoor: false, rideType: 'training' });
  });

  test('indoor race → plan uses both rules (spec T6 + T7)', async () => {
    const res = await createRide(rider, t1({ tempC: undefined, indoor: true, rideType: 'race' }));
    expect(res.status).toBe(201);
    expect(res.body.ride).toMatchObject({ indoor: true, rideType: 'race' });
    expect(res.body.ride.plan.targets).toEqual({ carbsGph: 70, fluidMlPerHr: 750, sodiumMgPerHr: 380 });
    expect(res.body.ride.plan.notes.map((n) => n.code)).toEqual(expect.arrayContaining(['INDOOR', 'RACE_DAY']));
  });

  test('switching to indoor re-plans', async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    const res = await rider.patch(`/api/rides/${id}`).send({ indoor: true });
    expect(res.body.ride.plan.targets.fluidMlPerHr).toBe(750); // 600 + 150
  });

  test('unknown ride type → 400', async () => {
    const res = await createRide(rider, t1({ rideType: 'crit' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('rideType');
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

describe('archiving rides', () => {
  test('archived rides leave the list, can be listed on their own, and come back', async () => {
    const keep = (await createRide(rider, t1({ name: 'Keep' }))).body.ride.id;
    const old = (await createRide(rider, t1({ name: 'Old', date: '2026-10-01T08:00:00.000Z' }))).body.ride.id;
    const names = async (query = '') => (await rider.get(`/api/rides${query}`)).body.rides.map((r) => r.name);

    const res = await rider.patch(`/api/rides/${old}`).send({ archived: true });
    expect(res.status).toBe(200);
    expect(res.body.ride.archived).toBe(true);
    expect(await names()).toEqual(['Keep']);
    expect(await names('?archived=true')).toEqual(['Old']);
    expect(await names('?archived=all')).toEqual(['Keep', 'Old']);

    await rider.patch(`/api/rides/${old}`).send({ archived: false });
    expect(await names()).toEqual(['Keep', 'Old']);
    expect((await rider.get(`/api/rides/${keep}`)).body.ride.archived).toBe(false);
  });

  test('rides saved before archiving existed (no field) still show', async () => {
    const id = (await createRide(rider, t1())).body.ride.id;
    await mongoose.connection.collection('rides').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $unset: { archived: '' } },
    );
    expect((await rider.get('/api/rides')).body.rides).toHaveLength(1);
  });

  test('an archived ride still counts in progress', async () => {
    const id = (await createRide(rider, t1())).body.ride.id;
    await rider.patch(`/api/rides/${id}`).send({ intake: [{ foodId: foods.bar, servings: 2 }] });
    await rider.patch(`/api/rides/${id}`).send({ archived: true });
    const { body } = await rider.get('/api/progress');
    expect(body.energyBalance.map((p) => p.rideId)).toEqual([id]);
  });

  test('bad archived value → 400', async () => {
    expect((await rider.get('/api/rides?archived=maybe')).status).toBe(400);
    const id = (await createRide(rider, t1())).body.ride.id;
    expect((await rider.patch(`/api/rides/${id}`).send({ archived: 'yes' })).status).toBe(400);
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
      durationMin: 120, // as planned
      targets: res.body.ride.plan.targets, // what to compare with
    });
  });

  test('the time actually ridden: per-hour numbers and targets use it (§9.0)', async () => {
    const { id, plan } = (await createRide(rider, t1())).body.ride; // planned 120 min
    const res = await rider.patch(`/api/rides/${id}`).send({
      intake: [{ foodId: foods.bar, servings: 1 }],
      actualDurationMin: 85,
      status: 'completed',
    });
    expect(res.status).toBe(200);
    expect(res.body.ride.actualDurationMin).toBe(85);
    expect(res.body.ride.actual).toMatchObject({ durationMin: 85, carbsG: 44, carbsGph: 31 }); // 44 g over 85 min
    expect(res.body.ride.plan.targets).toEqual(plan.targets); // the original plan is kept
    expect(res.body.ride.actual.targets).toBeDefined();
    expect(res.body.ride.actual.targets.carbsGph).toBeLessThanOrEqual(plan.targets.carbsGph); // shorter ride, same effort

    const back = await rider.patch(`/api/rides/${id}`).send({ actualDurationMin: null });
    expect(back.body.ride.actual).toMatchObject({ durationMin: 120, carbsGph: 22, targets: plan.targets });
  });

  test('a kJ plan keeps its effort when the ride ends early', async () => {
    const { id } = (await createRide(rider, t1({ intensity: { workKj: 1260 } }))).body.ride; // 175 W for 120 min
    const res = await rider.patch(`/api/rides/${id}`).send({ actualDurationMin: 60, status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.ride.actual.targets.carbsGph).toBeGreaterThan(0);
  });

  test('saved with nothing eaten → zeros, so the app can say so', async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    const res = await rider.patch(`/api/rides/${id}`).send({ intake: [], plainWaterMl: 0, status: 'completed' });
    expect(res.body.ride.actual).toMatchObject({ carbsGph: 0, fluidMlPerHr: 0, sodiumMgPerHr: 0 });
  });

  test('ride time out of range → 400', async () => {
    const { id } = (await createRide(rider, t1())).body.ride;
    expect((await rider.patch(`/api/rides/${id}`).send({ actualDurationMin: 5 })).status).toBe(400);
  });

  test('changing what was eaten refreshes the check-in suggestions', async () => {
    const { id } = (await createRide(rider, t1({ durationMin: 85 }))).body.ride;
    await rider.patch(`/api/rides/${id}`).send({ intake: [{ foodId: foods.gel, servings: 3 }], status: 'completed' });
    const created = (await rider.post('/api/checkins').send({ rideId: id, giScore: 4, energyScore: 4, legsScore: 4 })).body.checkIn;
    expect(created.suggestions.flags.map((f) => f.code)).not.toContain('eat-more');

    // Corrected: actually only one gel
    await rider.patch(`/api/rides/${id}`).send({ intake: [{ foodId: foods.gel, servings: 1 }] });
    const [after] = (await rider.get(`/api/checkins?rideId=${id}`)).body.checkIns;
    expect(after.suggestions.flags.find((f) => f.code === 'eat-more')).toMatchObject({ params: { eatenGph: 16 } });
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
