import request from 'supertest';
import { User } from '../src/models/index.js';
import { clearDb, cookieValue, makeApp, newUser, startDb, stopDb } from './helpers.js';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';

// Fake Google: a "credential" is just a key into this table. Anything else is a forged token.
const GOOGLE_ACCOUNTS = {
  'token-ana': { sub: 'google-ana', email: 'Ana@Gmail.com', email_verified: true, name: 'Ana Ríos' },
  'token-ana-new-email': { sub: 'google-ana', email: 'ana.rios@gmail.com', email_verified: true, name: 'Ana' },
  'token-rider': { sub: 'google-rider', email: 'rider@example.com', email_verified: true, name: 'Rider' },
  'token-unverified': { sub: 'google-x', email: 'x@example.com', email_verified: false },
};
const fakeVerifier = async (credential) => {
  const payload = GOOGLE_ACCOUNTS[credential.replace(/(-padding)+$/, '')];
  if (!payload) throw new Error('invalid token');
  return payload;
};
const pad = (token) => `${token}-padding-padding-padding`; // the API expects a JWT-sized string

const app = makeApp({ googleClientIds: [CLIENT_ID], verifyGoogleIdToken: fakeVerifier });
const googleLogin = (token, agent = request(app)) => agent.post('/api/auth/google').send({ credential: pad(token) });

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

describe('GET /api/auth/providers', () => {
  test('shows the Google client ID when configured', async () => {
    const res = await request(app).get('/api/auth/providers');
    expect(res.body).toEqual({ google: { clientId: CLIENT_ID } });
  });

  test('google is null when not configured', async () => {
    const res = await request(makeApp()).get('/api/auth/providers');
    expect(res.body).toEqual({ google: null });
  });
});

describe('POST /api/auth/google', () => {
  test('first sign-in creates the rider (201, created: true) and starts a session', async () => {
    const agent = request.agent(app);
    const res = await googleLogin('token-ana', agent);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ created: true, user: { email: 'ana@gmail.com', name: 'Ana Ríos' } });
    expect(res.body.user.googleId).toBeUndefined();
    expect(cookieValue(res, 'ftr_access')).toBeDefined();
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('ana@gmail.com');
  });

  test('returning rider is found by Google id, even if their email changed', async () => {
    const first = await googleLogin('token-ana');
    const again = await googleLogin('token-ana-new-email');
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
    expect(again.body.user.id).toBe(first.body.user.id);
    expect(await User.countDocuments()).toBe(1);
  });

  test('an email that already has a password account is not merged → 409', async () => {
    await request(app).post('/api/auth/register').send(newUser()); // rider@example.com
    const res = await googleLogin('token-rider');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_REGISTERED_WITH_PASSWORD');
    const stored = await User.findOne({ email: 'rider@example.com' });
    expect(stored.googleId).toBeUndefined();
  });

  test('unverified Google email → 401', async () => {
    const res = await googleLogin('token-unverified');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('GOOGLE_EMAIL_UNVERIFIED');
  });

  test('forged or expired token → 401', async () => {
    const res = await googleLogin('token-forged');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_GOOGLE_TOKEN');
  });

  test('missing credential → 400', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(400);
  });

  test('Google sign-in disabled → 404', async () => {
    const res = await request(makeApp()).post('/api/auth/google').send({ credential: pad('token-ana') });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('GOOGLE_DISABLED');
  });

  test('a Google-only rider cannot log in with a password', async () => {
    await googleLogin('token-ana');
    const res = await request(app).post('/api/auth/login').send({ email: 'ana@gmail.com', password: 'anything-at-all' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('mobile clients get the tokens in the body', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .set('X-Client-Type', 'mobile')
      .send({ credential: pad('token-ana') });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('security headers allow Google Identity Services', () => {
  test('CSP, COOP and Referrer-Policy', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("script-src 'self' https://accounts.google.com/gsi/client");
    expect(csp).toContain('frame-src');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});
