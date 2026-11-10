import request from 'supertest';
import { clearDb, makeApp, newUser, startDb, stopDb } from './helpers.js';

const app = makeApp();
let rider;
let foods;

beforeAll(startDb);
beforeEach(async () => {
  rider = request.agent(app);
  await rider.post('/api/auth/register').send(newUser());
  await rider.patch('/api/users/me').send({ weightKg: 75, birthYear: 1986, sex: 'male', ftpW: 250, trainedCarbRateGph: 70 });
  foods = {
    bar: (await rider.post('/api/foods').send({ name: 'Oat bar', type: 'bar', servingLabel: '1 bar', carbsG: 44, kcal: 250, sodiumMg: 150 })).body.food.id,
    gel: (await rider.post('/api/foods').send({ name: 'Energy gel', type: 'gel', servingLabel: '1 gel', carbsG: 22, kcal: 100, sodiumMg: 50 })).body.food.id,
  };
});
afterEach(clearDb);
afterAll(stopDb);

// What the web app sends after reading a .FIT file on the phone
const imported = (overrides = {}) => ({
  name: 'Morning ride',
  date: '2026-11-01T08:00:00.000Z',
  durationMin: 120,
  intensity: { workKj: 1260, avgPowerW: 175 },
  tempC: 24,
  status: 'completed',
  imported: { source: 'fit', startTime: '2026-11-01T08:00:00.000Z', distanceKm: 60.1, elevationGainM: 830 },
  ...overrides,
});

describe('importing a ride from a file', () => {
  test('creates a finished ride with the plan for what it needed, and the file summary', async () => {
    const res = await rider.post('/api/rides').send(imported());
    expect(res.status).toBe(201);
    expect(res.body.ride).toMatchObject({
      status: 'completed',
      imported: { source: 'fit', startTime: '2026-11-01T08:00:00.000Z', distanceKm: 60.1, elevationGainM: 830 },
    });
    expect(res.body.ride.plan.kcalBurned).toBeGreaterThan(1000); // from the kilojoules
    expect(res.body.ride.intensitySource).toBe('kj');
  });

  test('the same file twice → 409, in the rider’s language', async () => {
    await rider.post('/api/rides').send(imported());
    const again = await rider.post('/api/rides').send(imported({ name: 'Copy' }));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('RIDE_ALREADY_IMPORTED');
    const es = await rider.post('/api/rides').set('Accept-Language', 'es').send(imported());
    expect(es.body.error.message).toBe('Esta salida ya se importó');
    // Another rider can import a ride at the same time
    const other = request.agent(app);
    await other.post('/api/auth/register').send(newUser({ email: 'other@example.com' }));
    await other.patch('/api/users/me').send({ weightKg: 70 });
    expect((await other.post('/api/rides').send(imported())).status).toBe(201);
  });

  test('only the summary is accepted (no GPS track or unknown fields)', async () => {
    const res = await rider
      .post('/api/rides')
      .send(imported({ imported: { source: 'fit', startTime: '2026-11-01T08:00:00Z', distanceKm: 60, elevationGainM: 800, track: [[1, 2]] } }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/rides/similar (§9B)', () => {
  async function loggedRide(overrides, intake, checkIn) {
    const { id } = (await rider.post('/api/rides').send({ durationMin: 120, intensity: { avgPowerW: 175 }, ...overrides })).body.ride;
    if (intake) await rider.patch(`/api/rides/${id}`).send({ intake, status: 'completed' });
    if (checkIn) await rider.post('/api/checkins').send({ rideId: id, legsScore: 4, ...checkIn });
    return id;
  }

  test('rides that worked first, with what was eaten per hour by name; unlogged rides skipped', async () => {
    const good = await loggedRide(
      { name: 'Good one', date: '2026-10-01T08:00:00Z' },
      [{ foodId: foods.bar, servings: 2 }, { foodId: foods.gel, servings: 3 }],
      { giScore: 5, energyScore: 4 },
    );
    const meh = await loggedRide(
      { name: 'Stomach ache', date: '2026-10-05T08:00:00Z', durationMin: 130 },
      [{ foodId: foods.gel, servings: 6 }],
      { giScore: 2, energyScore: 3 },
    );
    await loggedRide({ name: 'Nothing logged' });
    await loggedRide({ name: 'Too long', durationMin: 300 }, [{ foodId: foods.bar, servings: 4 }]);

    const target = (await rider.post('/api/rides').send({ durationMin: 120, intensity: { avgPowerW: 175 } })).body.ride;
    const kcalPerHour = Math.round(target.plan.kcalBurned / 2);
    const res = await rider.get(`/api/rides/similar?durationMin=120&kcalPerHour=${kcalPerHour}`);
    expect(res.status).toBe(200);
    expect(res.body.rides.map((r) => [r.id, r.name, r.worked])).toEqual([
      [good, 'Good one', true],
      [meh, 'Stomach ache', false],
    ]);
    expect(res.body.rides[0].perHour).toEqual([
      { foodId: foods.bar, name: 'Oat bar', archived: false, servings: 1 },
      { foodId: foods.gel, name: 'Energy gel', archived: false, servings: 1.5 },
    ]);
  });

  test("another rider's rides never show; bad query → 400", async () => {
    await loggedRide({}, [{ foodId: foods.bar, servings: 2 }]);
    const other = request.agent(app);
    await other.post('/api/auth/register').send(newUser({ email: 'other@example.com' }));
    expect((await other.get('/api/rides/similar?durationMin=120&kcalPerHour=630')).body.rides).toEqual([]);
    expect((await rider.get('/api/rides/similar?durationMin=0&kcalPerHour=630')).status).toBe(400);
  });
});
