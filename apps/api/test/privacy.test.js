import request from 'supertest';
import { User } from '../src/models/index.js';
import { POLICY_VERSION } from '../src/policy.js';
import { clearDb, makeApp, newUser, startDb, stopDb } from './helpers.js';

const app = makeApp();

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

describe('consent to Terms + Privacy Policy (incl. health data)', () => {
  test('signup requires the checkbox and records consent with the policy version', async () => {
    const without = await request(app).post('/api/auth/register').send(newUser({ acceptTerms: undefined }));
    expect(without.status).toBe(400);
    expect(without.body.error.details.map((d) => d.path)).toContain('acceptTerms');
    const unchecked = await request(app).post('/api/auth/register').send(newUser({ acceptTerms: false }));
    expect(unchecked.status).toBe(400);

    const res = await request(app).post('/api/auth/register').send(newUser());
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ consentVersion: POLICY_VERSION, consentRequired: false });
    expect(res.body.user.consentAt).toEqual(expect.any(String));
  });

  test('accounts without current consent are asked; POST consent records it', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(newUser());
    await User.updateOne({}, { $set: { consentVersion: '2025-01-01' } }); // policy changed since
    expect((await agent.get('/api/auth/me')).body.user.consentRequired).toBe(true);

    const res = await agent.post('/api/users/me/consent').send({ version: POLICY_VERSION });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ consentRequired: false, consentVersion: POLICY_VERSION });
  });

  test('consent to an outdated version is refused', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(newUser());
    const res = await agent.post('/api/users/me/consent').send({ version: '2020-01-01' });
    expect(res.status).toBe(400);
  });

  test('new Google riders must consent before continuing', async () => {
    const googleApp = makeApp({
      googleClientIds: ['test'],
      verifyGoogleIdToken: async () => ({ sub: 'g-1', email: 'g@example.com', email_verified: true, name: 'G' }),
    });
    const res = await request(googleApp).post('/api/auth/google').send({ credential: 'x'.repeat(30) });
    expect(res.body.user.consentRequired).toBe(true);
  });
});

describe('minimum age 16', () => {
  test('a birth year under 16 is refused with a clear message', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(newUser());
    const tooYoung = new Date().getFullYear() - 15;
    const res = await agent.patch('/api/users/me').send({ birthYear: tooYoung });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].message).toMatch(/16 and over/);
    expect((await agent.patch('/api/users/me').send({ birthYear: tooYoung - 1 })).status).toBe(200);
  });
});

describe('download my data', () => {
  test('everything about the rider, nothing about others, no secrets', async () => {
    const rider = request.agent(app);
    const other = request.agent(app);
    await rider.post('/api/auth/register').send(newUser());
    await other.post('/api/auth/register').send(newUser({ email: 'other@example.com' }));
    await rider.patch('/api/users/me').send({ weightKg: 75 });
    await rider.post('/api/foods').send({ name: 'Gel', type: 'gel', carbsG: 22, kcal: 100 });
    await other.post('/api/foods').send({ name: 'Other food', type: 'bar', carbsG: 40, kcal: 200 });
    const ride = (await rider.post('/api/rides').send({ durationMin: 120, intensity: { avgPowerW: 175 } })).body.ride;
    await rider.post('/api/checkins').send({ rideId: ride.id, giScore: 4, energyScore: 4, legsScore: 4 });

    const res = await rider.get('/api/users/me/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="fuel-the-ride-data-\d{4}-\d{2}-\d{2}\.json"/);
    expect(res.body).toMatchObject({ format: 'fuel-the-ride-export/1', account: { email: 'rider@example.com', weightKg: 75 } });
    expect(res.body.foods.map((f) => f.name)).toEqual(['Gel']);
    expect(res.body.rides).toHaveLength(1);
    expect(res.body.checkIns).toHaveLength(1);
    expect(res.body.events).toEqual([]);

    const json = JSON.stringify(res.body);
    expect(json).not.toMatch(/passwordHash|googleId|Other food|other@example\.com/);
  });

  test('requires login', async () => {
    expect((await request(app).get('/api/users/me/export')).status).toBe(401);
  });
});
