import request from 'supertest';
import { clearDb, cookieValue, makeApp, newUser, startDb, stopDb } from './helpers.js';

const app = makeApp();

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

describe('POST /api/auth/register', () => {
  test('creates the account, sets httpOnly cookies, never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser({ email: '  Rider@Example.COM ' }));
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'rider@example.com', name: 'Test Rider', trainedCarbRateGph: 60 });
    expect(res.body.user.id).toEqual(expect.any(String));
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeUndefined();

    const cookies = res.headers['set-cookie'].join('\n');
    expect(cookies).toMatch(/ftr_access=.+HttpOnly/);
    expect(cookies).toMatch(/ftr_refresh=.+Path=\/api\/auth.+HttpOnly/);
  });

  test('duplicate email → 409 EMAIL_TAKEN', async () => {
    await request(app).post('/api/auth/register').send(newUser());
    const res = await request(app).post('/api/auth/register').send(newUser());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test.each([
    ['bad email', { email: 'not-an-email' }],
    ['short password', { password: 'short' }],
    ['missing name', { name: '' }],
    ['unknown field', { isAdmin: true }],
  ])('%s → 400 VALIDATION_FAILED', async (_name, overrides) => {
    const res = await request(app).post('/api/auth/register').send(newUser(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => request(app).post('/api/auth/register').send(newUser()));

  test('correct password → 200 with cookies', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rider@example.com', password: newUser().password });
    expect(res.status).toBe(200);
    expect(cookieValue(res, 'ftr_access')).toBeDefined();
  });

  test('wrong password and unknown email give the same 401', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ email: 'rider@example.com', password: 'nope-nope' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'who@example.com', password: 'nope-nope' });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }
  });
});

describe('session lifecycle', () => {
  test('cookie session: me → refresh → logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(newUser());

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('rider@example.com');

    const refreshed = await agent.post('/api/auth/refresh');
    expect(refreshed.status).toBe(200);
    expect(cookieValue(refreshed, 'ftr_refresh')).toBeDefined();

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect((await agent.post('/api/auth/refresh')).status).toBe(401);
  });

  test('reusing a rotated refresh token revokes every session', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser());
    const original = cookieValue(res, 'ftr_refresh');

    const first = await request(app).post('/api/auth/refresh').set('Cookie', `ftr_refresh=${original}`);
    expect(first.status).toBe(200);
    const rotated = cookieValue(first, 'ftr_refresh');

    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', `ftr_refresh=${original}`);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    const afterTheft = await request(app).post('/api/auth/refresh').set('Cookie', `ftr_refresh=${rotated}`);
    expect(afterTheft.status).toBe(401);
  });

  test('mobile clients get tokens in the body and use Bearer auth', async () => {
    const res = await request(app).post('/api/auth/register').set('X-Client-Type', 'mobile').send(newUser());
    expect(res.status).toBe(201);
    expect(res.headers['set-cookie']).toBeUndefined();
    const { accessToken, refreshToken } = res.body;

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .set('X-Client-Type', 'mobile')
      .send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).not.toBe(refreshToken);
  });

  test('no token or a garbage token → 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('a refresh token cannot be used as an access token', async () => {
    const res = await request(app).post('/api/auth/register').set('X-Client-Type', 'mobile').send(newUser());
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.refreshToken}`);
    expect(me.status).toBe(401);
  });
});
