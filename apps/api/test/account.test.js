import request from 'supertest';
import { ActionToken, CheckIn, Event, Food, Ride, Session, User } from '../src/models/index.js';
import { clearDb, cookieValue, makeApp, newUser, startDb, stopDb } from './helpers.js';

// Fake mailbox: every "sent" email lands here
const outbox = [];
const sendEmail = async (message) => {
  outbox.push(message);
};
const app = makeApp({ sendEmail, publicAppUrl: 'https://app.example' });
const linkToken = (message) => message.text.match(/token=([\w-]+)/)[1];
const lastEmailTo = (to) => outbox.filter((m) => m.to === to).at(-1);

async function registered(email = 'rider@example.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(newUser({ email }));
  return agent;
}
async function confirmed(email = 'rider@example.com') {
  const agent = await registered(email);
  await request(app).post('/api/auth/verify-email').send({ token: linkToken(lastEmailTo(email)) });
  return agent;
}

beforeAll(startDb);
beforeEach(() => {
  outbox.length = 0;
});
afterEach(clearDb);
afterAll(stopDb);

describe('confirm account', () => {
  test('signup sends a confirmation link to PUBLIC_APP_URL; the user starts unconfirmed', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser());
    expect(res.body.user).toMatchObject({ emailVerified: false, hasPassword: true });
    const email = lastEmailTo('rider@example.com');
    expect(email.subject).toBe('Confirm your email for Fuel the Ride');
    expect(email.text).toMatch(/^https:\/\/app\.example\/verify-email\?token=[\w-]{40,}$/m);
    expect(email.html).toContain('Confirm my email');
  });

  test('the link confirms the email, once', async () => {
    const agent = await registered();
    const token = linkToken(lastEmailTo('rider@example.com'));
    const res = await request(app).post('/api/auth/verify-email').send({ token });
    expect(res.status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user.emailVerified).toBe(true);
    const again = await request(app).post('/api/auth/verify-email').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('INVALID_TOKEN');
  });

  test('only a hash of the token is stored', async () => {
    await registered();
    const token = linkToken(lastEmailTo('rider@example.com'));
    const stored = await ActionToken.findOne({});
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('expired or made-up tokens are rejected', async () => {
    await registered();
    await ActionToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: linkToken(lastEmailTo('rider@example.com')) });
    expect(expired.status).toBe(400);
    const fake = await request(app).post('/api/auth/verify-email').send({ token: 'x'.repeat(43) });
    expect(fake.status).toBe(400);
  });

  test('resend sends a new link while unconfirmed, nothing once confirmed', async () => {
    const agent = await registered();
    expect((await agent.post('/api/auth/resend-verification')).status).toBe(204);
    expect(outbox.filter((m) => m.to === 'rider@example.com')).toHaveLength(2);
    await request(app).post('/api/auth/verify-email').send({ token: linkToken(lastEmailTo('rider@example.com')) });
    await agent.post('/api/auth/resend-verification');
    expect(outbox.filter((m) => m.to === 'rider@example.com')).toHaveLength(2);
    expect((await request(app).post('/api/auth/resend-verification')).status).toBe(401);
  });

  test('a failing email provider never fails signup', async () => {
    const broken = makeApp({ sendEmail: async () => { throw new Error('provider down'); }, publicAppUrl: 'https://app.example' });
    const res = await request(broken).post('/api/auth/register').send(newUser({ email: 'b@example.com' }));
    expect(res.status).toBe(201);
  });

  test('in production without PUBLIC_APP_URL: no link is built from the Host header, and signup still works', async () => {
    const prodApp = makeApp({ sendEmail, publicAppUrl: undefined, isProd: true });
    const res = await request(prodApp)
      .post('/api/auth/register')
      .set('Host', 'evil.example')
      .send(newUser({ email: 'p@example.com' }));
    expect(res.status).toBe(201);
    expect(outbox.filter((m) => m.to === 'p@example.com')).toEqual([]);
  });

  test('outside production, links follow the caller’s origin when PUBLIC_APP_URL is unset', async () => {
    const devApp = makeApp({ sendEmail, publicAppUrl: undefined });
    await request(devApp).post('/api/auth/register').set('Host', 'localhost:5173').send(newUser({ email: 'dev@example.com' }));
    expect(lastEmailTo('dev@example.com').text).toContain('http://localhost:5173/verify-email?token=');
  });
});

describe('forgot / reset password', () => {
  test('confirmed rider: link resets the password, ends every session, old password stops working', async () => {
    const agent = await confirmed();
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    expect((await request(app).post('/api/auth/forgot-password').send({ email: 'RIDER@example.com' })).status).toBe(204);
    const email = lastEmailTo('rider@example.com');
    expect(email.subject).toBe('Reset your Fuel the Ride password');
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: linkToken(email), password: 'brand-new-password' });
    expect(res.status).toBe(204);

    expect((await agent.post('/api/auth/refresh')).status).toBe(401); // logged out everywhere
    const oldLogin = await request(app).post('/api/auth/login').send({ email: 'rider@example.com', password: newUser().password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/auth/login').send({ email: 'rider@example.com', password: 'brand-new-password' });
    expect(newLogin.status).toBe(200);
  });

  test('same answer for unknown and unconfirmed emails, and no email is sent', async () => {
    await registered('unconfirmed@example.com');
    outbox.length = 0;
    for (const email of ['nobody@example.com', 'unconfirmed@example.com']) {
      expect((await request(app).post('/api/auth/forgot-password').send({ email })).status).toBe(204);
    }
    expect(outbox).toEqual([]);
  });

  test('reset links are single-use, and a reset invalidates other pending links', async () => {
    await confirmed();
    await request(app).post('/api/auth/forgot-password').send({ email: 'rider@example.com' });
    const first = linkToken(lastEmailTo('rider@example.com'));
    await request(app).post('/api/auth/forgot-password').send({ email: 'rider@example.com' });
    const second = linkToken(lastEmailTo('rider@example.com'));

    expect((await request(app).post('/api/auth/reset-password').send({ token: second, password: 'another-password-1' })).status).toBe(204);
    expect((await request(app).post('/api/auth/reset-password').send({ token: second, password: 'another-password-2' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: first, password: 'another-password-3' })).status).toBe(400);
  });

  test('a verify-email link can’t be used to reset a password', async () => {
    await registered();
    const verifyToken = linkToken(lastEmailTo('rider@example.com'));
    const res = await request(app).post('/api/auth/reset-password').send({ token: verifyToken, password: 'sneaky-password-1' });
    expect(res.status).toBe(400);
  });

  test('new password must meet the rules', async () => {
    await confirmed();
    await request(app).post('/api/auth/forgot-password').send({ email: 'rider@example.com' });
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: linkToken(lastEmailTo('rider@example.com')), password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('delete account', () => {
  async function withData(agent) {
    await agent.patch('/api/users/me').send({ weightKg: 75 });
    const food = (await agent.post('/api/foods').send({ name: 'Gel', type: 'gel', carbsG: 22, kcal: 100 })).body.food;
    const ride = (await agent.post('/api/rides').send({ durationMin: 120, intensity: { avgPowerW: 175 } })).body.ride;
    await agent.post('/api/checkins').send({ rideId: ride.id, giScore: 4, energyScore: 4, legsScore: 4 });
    await agent.post('/api/events').send({
      name: 'Fondo',
      type: 'race',
      date: new Date(Date.now() + 30 * 86400000).toISOString(),
      past: { durationMin: 120, intensity: { avgPowerW: 175 } },
    });
    return { food, ride };
  }

  test('needs DELETE and the password; removes the account and all its data; others untouched', async () => {
    const rider = await registered();
    const other = await registered('other@example.com');
    await withData(rider);
    await withData(other);

    expect((await rider.delete('/api/users/me').send({ password: newUser().password })).status).toBe(400); // no DELETE
    const wrong = await rider.delete('/api/users/me').send({ confirm: 'DELETE', password: 'wrong-password' });
    expect(wrong.status).toBe(401);

    const res = await rider.delete('/api/users/me').send({ confirm: 'DELETE', password: newUser().password });
    expect(res.status).toBe(204);
    expect(cookieValue(res, 'ftr_access')).toBe('');

    const otherUser = await User.findOne({ email: 'other@example.com' });
    expect(await User.countDocuments()).toBe(1);
    for (const Model of [Food, Ride, CheckIn, Event]) {
      const docs = await Model.find({});
      expect(docs.length).toBeGreaterThan(0);
      expect(docs.every((d) => String(d.userId) === String(otherUser._id))).toBe(true);
    }
    expect(await Session.countDocuments({ userId: { $ne: otherUser._id } })).toBe(0);
    expect(await ActionToken.countDocuments({ userId: { $ne: otherUser._id } })).toBe(0);
    expect((await rider.get('/api/auth/me')).status).toBe(401);
    expect((await other.get('/api/foods')).body.foods).toHaveLength(1);
  });

  test('Google-only riders confirm with DELETE alone', async () => {
    const googleApp = makeApp({
      sendEmail,
      googleClientIds: ['test'],
      verifyGoogleIdToken: async () => ({ sub: 'g-1', email: 'g@example.com', email_verified: true, name: 'G' }),
    });
    const agent = request.agent(googleApp);
    const login = await agent.post('/api/auth/google').send({ credential: 'x'.repeat(30) });
    expect(login.body.user).toMatchObject({ hasPassword: false, emailVerified: true });
    expect((await agent.delete('/api/users/me').send({ confirm: 'DELETE' })).status).toBe(204);
    expect(await User.countDocuments({ email: 'g@example.com' })).toBe(0);
  });
});
