import { jest } from '@jest/globals';
import request from 'supertest';
import { Food } from '../src/models/index.js';
import { redactTokens, scrubEvent } from '../src/services/errorReporting.js';
import { clearDb, makeApp, newUser, startDb, stopDb } from './helpers.js';

describe('scrubEvent: no personal data leaves the server', () => {
  test('drops bodies, cookies, auth headers, IP/email; keeps the rider id', () => {
    const event = scrubEvent({
      request: {
        url: 'https://app.example/api/auth/reset-password?token=abc123secret',
        query_string: 'token=abc123secret&x=1',
        data: { password: 'hunter2', email: 'rider@example.com' },
        cookies: { ftr_access: 'jwt' },
        headers: { Authorization: 'Bearer jwt', cookie: 'ftr_access=jwt', 'user-agent': 'Safari', 'X-Forwarded-For': '1.2.3.4' },
      },
      user: { id: 'u1', email: 'rider@example.com', ip_address: '1.2.3.4' },
      breadcrumbs: [{ message: 'GET /verify-email?token=zzz', data: { url: '/verify-email?token=zzz' } }],
    });
    expect(event.request.data).toBeUndefined();
    expect(event.request.cookies).toBeUndefined();
    expect(event.request.headers).toEqual({ 'user-agent': 'Safari' });
    expect(event.request.url).toBe('https://app.example/api/auth/reset-password?token=[redacted]');
    expect(event.request.query_string).toBe('token=[redacted]&x=1');
    expect(event.user).toEqual({ id: 'u1' });
    expect(event.breadcrumbs[0]).toEqual({ message: 'GET /verify-email?token=[redacted]', data: { url: '/verify-email?token=[redacted]' } });
  });

  test('redactTokens leaves other text alone', () => {
    expect(redactTokens('/rides?from=2026-11-01')).toBe('/rides?from=2026-11-01');
    expect(redactTokens(undefined)).toBeUndefined();
  });
});

describe('reporting unexpected errors', () => {
  const reported = [];
  const app = makeApp({ reportError: (err, req) => reported.push({ message: err.message, userId: req.user?.id }) });

  beforeAll(startDb);
  beforeEach(() => {
    reported.length = 0;
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await clearDb();
  });
  afterAll(stopDb);

  test('a 500 is reported with the rider id; the rider gets the generic error', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(newUser());
    jest.spyOn(Food, 'find').mockImplementation(() => {
      throw new Error('database exploded');
    });
    const res = await agent.get('/api/foods');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
    expect(reported).toEqual([{ message: 'database exploded', userId: expect.any(String) }]);
  });

  test('expected 4xx answers are not reported', async () => {
    await request(app).get('/api/foods'); // 401
    await request(app).post('/api/auth/login').send({ email: 'x@example.com', password: 'nope-nope' }); // 401
    await request(app).get('/api/nope'); // 404
    expect(reported).toEqual([]);
  });

  test('a failing reporter never changes the response', async () => {
    const fragile = makeApp({
      reportError: () => {
        throw new Error('sentry down');
      },
    });
    const agent = request.agent(fragile);
    await agent.post('/api/auth/register').send(newUser({ email: 'f@example.com' }));
    jest.spyOn(Food, 'find').mockImplementation(() => {
      throw new Error('boom');
    });
    expect((await agent.get('/api/foods')).status).toBe(500);
  });
});

describe('GET /api/client-config', () => {
  beforeAll(startDb);
  afterAll(stopDb);

  test('no DSN configured → Sentry off in the app', async () => {
    const res = await request(makeApp()).get('/api/client-config');
    expect(res.body).toEqual({ sentryDsn: null, policyVersion: expect.any(String), environment: 'test', release: 'dev' });
  });

  test('DSN configured → shared with the app (it is public by design)', async () => {
    const res = await request(makeApp({ sentryDsnWeb: 'https://key@o1.ingest.sentry.io/1', reportError: () => {} })).get(
      '/api/client-config',
    );
    expect(res.body.sentryDsn).toBe('https://key@o1.ingest.sentry.io/1');
  });
});
