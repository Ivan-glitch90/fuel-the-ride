import request from 'supertest';
import { translateMessage } from '../src/i18n.js';
import { clearDb, makeApp, newUser, startDb, stopDb } from './helpers.js';

const outbox = [];
const app = makeApp({
  sendEmail: async (message) => {
    outbox.push(message);
  },
  publicAppUrl: 'https://app.example',
});
const lastEmailTo = (to) => outbox.filter((m) => m.to === to).at(-1);

beforeAll(startDb);
afterEach(async () => {
  outbox.length = 0;
  await clearDb();
});
afterAll(stopDb);

describe('server messages follow Accept-Language', () => {
  test('errors come back in Spanish with the same codes', async () => {
    await request(app).post('/api/auth/register').send(newUser());
    const res = await request(app)
      .post('/api/auth/login')
      .set('Accept-Language', 'es-MX')
      .send({ email: newUser().email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'El correo o la contraseña no son correctos' });
  });

  test('English stays the default', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.body.error.message).toBe('Please log in');
  });

  test('validation: zod’s own messages and our custom ones are both Spanish', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Accept-Language', 'es')
      .send({ email: 'not-an-email', password: 'correct-horse', name: 'Ana', acceptTerms: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.message).toBe('Algunos datos no son válidos');
    const byPath = Object.fromEntries(res.body.error.details.map((d) => [d.path, d.message]));
    expect(byPath.email).toBe('Escribe un correo válido');
    expect(byPath.acceptTerms).toBe(
      'Confirma que tienes 16 años o más y que aceptas los Términos y la Política de privacidad',
    );
  });

  test('number ranges read plainly in Spanish', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(newUser());
    const res = await agent.patch('/api/users/me').set('Accept-Language', 'es').send({ weightKg: 5 });
    expect(res.body.error.details).toEqual([{ path: 'weightKg', message: 'Debe ser al menos 30' }]);
  });

  test('calculator range errors are shown under the field, without the technical name', () => {
    expect(translateMessage('durationMin must be between 30 and 600', 'es')).toBe('Debe estar entre 30 y 600');
    expect(translateMessage('avgHr is required', 'es')).toBe('Este dato es obligatorio');
    expect(translateMessage('Something nobody translated', 'es')).toBe('Something nobody translated');
  });
});

describe('emails use the account language', () => {
  test('signing up in Spanish saves the language and sends the confirmation in Spanish', async () => {
    const res = await request(app).post('/api/auth/register').set('Accept-Language', 'es').send(newUser());
    expect(res.body.user.language).toBe('es');
    const email = lastEmailTo(newUser().email);
    expect(email.subject).toBe('Confirma tu correo para Fuel the Ride');
    expect(email.text).toMatch(/^Hola Test Rider,/);
    expect(email.html).toContain('Confirmar mi correo');
  });

  test('switching the language in Profile changes later emails', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(newUser());
    expect(lastEmailTo(newUser().email).subject).toBe('Confirm your email for Fuel the Ride');

    const patch = await agent.patch('/api/users/me').send({ language: 'es' });
    expect(patch.body.user.language).toBe('es');
    await agent.post('/api/auth/resend-verification');
    expect(lastEmailTo(newUser().email).subject).toBe('Confirma tu correo para Fuel the Ride');

    expect((await agent.patch('/api/users/me').send({ language: 'fr' })).status).toBe(400);
  });
});
