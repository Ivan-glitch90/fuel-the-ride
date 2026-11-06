import request from 'supertest';
import { User } from '../src/models/index.js';
import { clearDb, makeApp, newUser, startDb, stopDb } from './helpers.js';

const app = makeApp();
let agent;

beforeAll(startDb);
beforeEach(async () => {
  agent = request.agent(app);
  await agent.post('/api/auth/register').send(newUser());
});
afterEach(clearDb);
afterAll(stopDb);

describe('/api/users/me', () => {
  test('GET returns the profile with defaults', async () => {
    const res = await agent.get('/api/users/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ sweatSodium: 'average', units: 'metric', sex: 'unspecified' });
  });

  test('requires login', async () => {
    expect((await request(app).get('/api/users/me')).status).toBe(401);
  });

  test('PATCH updates profile fields', async () => {
    const res = await agent
      .patch('/api/users/me')
      .send({ weightKg: 75, birthYear: 1986, sex: 'male', ftpW: 250, lthr: 165, sweatSodium: 'salty' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ weightKg: 75, ftpW: 250, lthr: 165, sweatSodium: 'salty' });
  });

  test('PATCH with null clears an optional field', async () => {
    await agent.patch('/api/users/me').send({ ftpW: 250 });
    const res = await agent.patch('/api/users/me').send({ ftpW: null });
    expect(res.status).toBe(200);
    expect(res.body.user.ftpW).toBeUndefined();
  });

  test('raising the trained carb rate records the date; lowering does not', async () => {
    await agent.patch('/api/users/me').send({ trainedCarbRateGph: 70 });
    const raised = await User.findOne({ email: 'rider@example.com' });
    expect(raised.lastCarbRateIncreaseAt).toBeInstanceOf(Date);

    const before = raised.lastCarbRateIncreaseAt.getTime();
    await agent.patch('/api/users/me').send({ trainedCarbRateGph: 60 });
    const lowered = await User.findOne({ email: 'rider@example.com' });
    expect(lowered.lastCarbRateIncreaseAt.getTime()).toBe(before);
  });

  test.each([
    ['weight out of range', { weightKg: 10 }],
    ['FTP out of range', { ftpW: 2000 }],
    ['bad enum', { sweatSodium: 'very' }],
    ['protected field', { email: 'new@example.com' }],
    ['password hash injection', { passwordHash: 'x' }],
    ['empty patch', {}],
  ])('%s → 400', async (_name, body) => {
    const res = await agent.patch('/api/users/me').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
