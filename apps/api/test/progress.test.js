import request from 'supertest';
import { clearDb, makeApp, newUser, startDb, stopDb } from './helpers.js';

const app = makeApp();
let rider;
let foods;

const goodAnswers = { giScore: 4, energyScore: 4, legsScore: 4 };

async function ride(day, { log = true, name } = {}) {
  const created = (
    await rider.post('/api/rides').send({
      name: name ?? `Nov ${day}`,
      date: `2026-11-${day}T08:00:00.000Z`,
      durationMin: 120,
      intensity: { avgPowerW: 175 }, // 1,260 kcal burned
      tempC: 22,
      foodIds: [foods.bar, foods.gel],
    })
  ).body.ride;
  if (log) {
    // 2 bars + 2 gels = 132 g (66 g/hr), 700 kcal
    await rider.patch(`/api/rides/${created.id}`).send({
      intake: [
        { foodId: foods.bar, servings: 2 },
        { foodId: foods.gel, servings: 2 },
      ],
    });
  }
  return created.id;
}

beforeAll(startDb);
beforeEach(async () => {
  rider = request.agent(app);
  await rider.post('/api/auth/register').send(newUser());
  await rider.patch('/api/users/me').send({ weightKg: 75, birthYear: 1986, sex: 'male', ftpW: 250, trainedCarbRateGph: 60 });
  foods = {
    bar: (await rider.post('/api/foods').send({ name: 'Oat bar', type: 'bar', carbsG: 44, kcal: 250 })).body.food.id,
    gel: (await rider.post('/api/foods').send({ name: 'Energy gel', type: 'gel', carbsG: 22, kcal: 100 })).body.food.id,
  };
});
afterEach(clearDb);
afterAll(stopDb);

describe('GET /api/progress', () => {
  test('new rider → empty series and the current trained rate', async () => {
    const res = await rider.get('/api/progress');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ current: { trainedGph: 60 }, carbRate: [], energyBalance: [] });
  });

  test('carb-rate points per check-in, oldest first, tracking the trained rate', async () => {
    const r1 = await ride('01');
    const r3 = await ride('03');
    await rider.post('/api/checkins').send({ rideId: r3, ...goodAnswers }); // checked in out of order
    await rider.post('/api/checkins').send({ rideId: r1, ...goodAnswers, giScore: 5 });
    await rider.patch('/api/users/me').send({ trainedCarbRateGph: 65 }); // accepted a suggestion
    const r5 = await ride('05');
    await rider.post('/api/checkins').send({ rideId: r5, ...goodAnswers });

    const { body } = await rider.get('/api/progress');
    expect(body.current.trainedGph).toBe(65);
    expect(body.carbRate).toEqual([
      { rideId: r1, date: '2026-11-01T08:00:00.000Z', trainedGph: 60, targetGph: 60, actualGph: 66, giScore: 5 },
      { rideId: r3, date: '2026-11-03T08:00:00.000Z', trainedGph: 60, targetGph: 60, actualGph: 66, giScore: 4 },
      { rideId: r5, date: '2026-11-05T08:00:00.000Z', trainedGph: 65, targetGph: 60, actualGph: 66, giScore: 4 },
    ]);
  });

  test('a check-in on a ride with nothing logged has actualGph null', async () => {
    const r1 = await ride('01', { log: false });
    await rider.post('/api/checkins').send({ rideId: r1, ...goodAnswers });
    const { body } = await rider.get('/api/progress');
    expect(body.carbRate[0].actualGph).toBeNull();
    expect(body.energyBalance).toEqual([]); // nothing eaten logged → no energy point
  });

  test('energy balance: kcal burned vs eaten per logged ride, oldest first', async () => {
    const r3 = await ride('03', { name: 'Gravel loop' });
    const r1 = await ride('01');
    await ride('02', { log: false });
    const { body } = await rider.get('/api/progress');
    expect(body.energyBalance).toEqual([
      { rideId: r1, date: '2026-11-01T08:00:00.000Z', name: 'Nov 01', kcalBurned: 1260, kcalEaten: 700 },
      { rideId: r3, date: '2026-11-03T08:00:00.000Z', name: 'Gravel loop', kcalBurned: 1260, kcalEaten: 700 },
    ]);
  });

  test('from/to and limit narrow both series', async () => {
    for (const day of ['01', '03', '05']) {
      const id = await ride(day);
      await rider.post('/api/checkins').send({ rideId: id, ...goodAnswers });
    }
    const ranged = (await rider.get('/api/progress?from=2026-11-02&to=2026-11-04')).body;
    expect(ranged.carbRate.map((p) => p.date)).toEqual(['2026-11-03T08:00:00.000Z']);
    expect(ranged.energyBalance).toHaveLength(1);

    const limited = (await rider.get('/api/progress?limit=2')).body;
    expect(limited.carbRate.map((p) => p.date.slice(0, 10))).toEqual(['2026-11-03', '2026-11-05']);
  });

  test("another rider's data never appears", async () => {
    const id = await ride('01');
    await rider.post('/api/checkins').send({ rideId: id, ...goodAnswers });
    const other = request.agent(app);
    await other.post('/api/auth/register').send(newUser({ email: 'other@example.com' }));
    const { body } = await other.get('/api/progress');
    expect(body.carbRate).toEqual([]);
    expect(body.energyBalance).toEqual([]);
  });

  test('requires login; bad query → 400', async () => {
    expect((await request(app).get('/api/progress')).status).toBe(401);
    expect((await rider.get('/api/progress?limit=0')).status).toBe(400);
    expect((await rider.get('/api/progress?from=not-a-date')).status).toBe(400);
  });
});
