import mongoose from 'mongoose';
import request from 'supertest';
import { buildFuelPlan } from '@fuel-ride/fuel-core';
import { User } from '../src/models/index.js';
import { clearDb, makeApp, newUser, startDb, stopDb } from './helpers.js';

const app = makeApp();
let rider;
let other;

const gel = { name: 'Energy gel', type: 'gel', servingLabel: '1 gel', carbsG: 22, kcal: 100, sodiumMg: 50 };
const bar = { name: 'Oat bar', type: 'bar', servingLabel: '1 bar', carbsG: 44, kcal: 250, sodiumMg: 150 };
const drink = {
  name: 'Electrolyte drink',
  type: 'drink',
  servingLabel: '1 bottle',
  carbsG: 15,
  kcal: 60,
  sodiumMg: 400,
  fluidMl: 500,
};

const createFood = (agent, body) => agent.post('/api/foods').send(body);

beforeAll(startDb);
beforeEach(async () => {
  rider = request.agent(app);
  other = request.agent(app);
  await rider.post('/api/auth/register').send(newUser());
  await other.post('/api/auth/register').send(newUser({ email: 'other@example.com' }));
});
afterEach(clearDb);
afterAll(stopDb);

describe('POST /api/foods', () => {
  test('creates a food with defaults', async () => {
    const res = await createFood(rider, { name: 'Banana', type: 'real', carbsG: 27, kcal: 105 });
    expect(res.status).toBe(201);
    expect(res.body.food).toMatchObject({
      name: 'Banana',
      type: 'real',
      servingLabel: '1 serving',
      carbsG: 27,
      kcal: 105,
      sodiumMg: 0,
      fluidMl: 0,
      favorite: false,
      archived: false,
    });
    expect(res.body.food.id).toEqual(expect.any(String));
  });

  test('a drink with fluid and an electrolyte tab without fluid are both valid', async () => {
    expect((await createFood(rider, drink)).status).toBe(201);
    const tab = { name: 'Salt tab', type: 'electrolyte', carbsG: 0, kcal: 0, sodiumMg: 200 };
    expect((await createFood(rider, tab)).status).toBe(201);
  });

  test.each([
    ['drink without fluid', { ...drink, fluidMl: 0 }, 'fluidMl'],
    ['gel with fluid', { ...gel, fluidMl: 100 }, 'fluidMl'],
    ['negative carbs', { ...gel, carbsG: -5 }, 'carbsG'],
    ['unknown type', { ...gel, type: 'pizza' }, 'type'],
    ['missing name', { ...gel, name: '' }, 'name'],
    ['missing carbs', { name: 'X', type: 'gel', kcal: 100 }, 'carbsG'],
    ['unknown field', { ...gel, userId: 'someone-else' }, ''],
  ])('%s → 400', async (_name, body, path) => {
    const res = await createFood(rider, body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    if (path) expect(res.body.error.details.map((d) => d.path)).toContain(path);
  });

  test('requires login', async () => {
    expect((await request(app).post('/api/foods').send(gel)).status).toBe(401);
  });
});

describe('GET /api/foods', () => {
  test('lists favorites first, then by name (case-insensitive)', async () => {
    await createFood(rider, { ...gel, name: 'zesty gel' });
    await createFood(rider, { ...bar, name: 'Apple bar' });
    await createFood(rider, { ...gel, name: 'Maple gel', favorite: true });
    const res = await rider.get('/api/foods');
    expect(res.status).toBe(200);
    expect(res.body.foods.map((f) => f.name)).toEqual(['Maple gel', 'Apple bar', 'zesty gel']);
  });

  test('filters by archived and favorite', async () => {
    const kept = (await createFood(rider, gel)).body.food;
    const old = (await createFood(rider, bar)).body.food;
    await rider.patch(`/api/foods/${old.id}`).send({ archived: true });
    await rider.patch(`/api/foods/${kept.id}`).send({ favorite: true });

    const names = async (query) => (await rider.get(`/api/foods${query}`)).body.foods.map((f) => f.name);
    expect(await names('')).toEqual(['Energy gel']);
    expect(await names('?archived=true')).toEqual(['Oat bar']);
    expect(await names('?archived=all')).toHaveLength(2);
    expect(await names('?favorite=false')).toEqual([]);
  });

  test('bad query value → 400', async () => {
    expect((await rider.get('/api/foods?archived=maybe')).status).toBe(400);
  });
});

describe('GET / PATCH /api/foods/:id', () => {
  test('gets and updates a food', async () => {
    const { id } = (await createFood(rider, gel)).body.food;
    expect((await rider.get(`/api/foods/${id}`)).body.food.name).toBe('Energy gel');

    const res = await rider.patch(`/api/foods/${id}`).send({ carbsG: 25, caffeineMg: 75 });
    expect(res.status).toBe(200);
    expect(res.body.food).toMatchObject({ carbsG: 25, caffeineMg: 75 });

    const cleared = await rider.patch(`/api/foods/${id}`).send({ caffeineMg: null });
    expect(cleared.body.food.caffeineMg).toBeUndefined();
  });

  test('fluid rule is checked against the stored food', async () => {
    const { id } = (await createFood(rider, gel)).body.food;
    const toDrink = await rider.patch(`/api/foods/${id}`).send({ type: 'drink' });
    expect(toDrink.status).toBe(400);
    expect(toDrink.body.error.details[0].path).toBe('fluidMl');

    const ok = await rider.patch(`/api/foods/${id}`).send({ type: 'drink', fluidMl: 500 });
    expect(ok.status).toBe(200);
  });

  test('malformed id → 400, unknown id → 404', async () => {
    expect((await rider.get('/api/foods/not-an-id')).status).toBe(400);
    const res = await rider.get(`/api/foods/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FOOD_NOT_FOUND');
  });

  test('empty patch or protected field → 400', async () => {
    const { id } = (await createFood(rider, gel)).body.food;
    expect((await rider.patch(`/api/foods/${id}`).send({})).status).toBe(400);
    expect((await rider.patch(`/api/foods/${id}`).send({ userId: 'x' })).status).toBe(400);
  });
});

describe('DELETE /api/foods/:id', () => {
  test('unused food is deleted → 204', async () => {
    const { id } = (await createFood(rider, gel)).body.food;
    expect((await rider.delete(`/api/foods/${id}`)).status).toBe(204);
    expect((await rider.get(`/api/foods/${id}`)).status).toBe(404);
  });

  test.each([
    ['logged intake', (foodId) => ({ intake: [{ foodId, servings: 1 }] })],
    ['plan snapshot', (foodId) => ({ plan: { schedule: [{ items: [{ foodId: String(foodId), servings: 1 }] }] } })],
  ])('food used in a ride (%s) is archived instead → 200', async (_name, rideFields) => {
    const { id } = (await createFood(rider, gel)).body.food;
    const user = await User.findOne({ email: 'rider@example.com' });
    await mongoose.connection
      .collection('rides')
      .insertOne({ userId: user._id, ...rideFields(new mongoose.Types.ObjectId(id)) });

    const res = await rider.delete(`/api/foods/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ archived: true, food: { id, archived: true } });
    expect((await rider.get('/api/foods')).body.foods).toEqual([]);
    expect((await rider.get('/api/foods?archived=true')).body.foods).toHaveLength(1);
  });
});

describe('ownership', () => {
  test("another rider's foods are invisible and untouchable", async () => {
    const { id } = (await createFood(rider, gel)).body.food;

    expect((await other.get('/api/foods')).body.foods).toEqual([]);
    expect((await other.get(`/api/foods/${id}`)).status).toBe(404);
    expect((await other.patch(`/api/foods/${id}`).send({ carbsG: 1 })).status).toBe(404);
    expect((await other.delete(`/api/foods/${id}`)).status).toBe(404);

    expect((await rider.get(`/api/foods/${id}`)).body.food.carbsG).toBe(22);
  });
});

describe('contract with fuel-core', () => {
  test('foods from the API plug straight into buildFuelPlan', async () => {
    for (const food of [bar, gel, drink]) await createFood(rider, food);
    const { foods } = (await rider.get('/api/foods')).body;
    const byName = (name) => foods.find((f) => f.name === name);

    const plan = buildFuelPlan({
      ride: { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22 },
      user: { weightKg: 75, age: 40, sex: 'male', ftpW: 250, trainedCarbRateGph: 70 },
      foods: [byName('Oat bar'), byName('Energy gel'), byName('Electrolyte drink')],
    });
    expect(plan.schedule[0].items.map((i) => i.name)).toEqual(['Electrolyte drink', 'Oat bar']);
  });
});
