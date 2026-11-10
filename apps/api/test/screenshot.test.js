import request from 'supertest';
import { User } from '../src/models/index.js';
import { toSummary } from '../src/services/screenshotService.js';
import { clearDb, makeApp, newUser, startDb, stopDb } from './helpers.js';

// What Claude returns for a Strava screenshot in imperial units, already converted by the prompt
const modelOutput = {
  isRideSummary: true,
  name: 'Morning Ride',
  date: '2026-11-08',
  startTime: '07:42',
  movingTimeMin: 125.5,
  elapsedTimeMin: 140,
  distanceKm: 64.37,
  elevationGainM: 812.2,
  avgPowerW: 181,
  normalizedPowerW: null,
  workKj: 1363,
  avgHr: 139,
  tempC: null,
  indoor: false,
};
const image = 'A'.repeat(200); // base64-looking; the fake reader never looks at it
const seen = [];
const app = makeApp({
  readScreenshot: async (input) => {
    seen.push(input);
    return toSummary(modelOutput);
  },
});

let rider;
beforeAll(startDb);
beforeEach(async () => {
  seen.length = 0;
  rider = request.agent(app);
  await rider.post('/api/auth/register').send(newUser());
  await rider.patch('/api/users/me').send({ weightKg: 75 });
});
afterEach(clearDb);
afterAll(stopDb);

const makePremium = () => User.updateOne({ email: newUser().email }, { plan: 'premium' });

describe('POST /api/rides/read-screenshot (Premium)', () => {
  test('free riders get 403 PREMIUM_REQUIRED (translated), and see their plan', async () => {
    expect((await rider.get('/api/auth/me')).body.user.plan).toBe('free');
    const res = await rider.post('/api/rides/read-screenshot').send({ image, mediaType: 'image/jpeg' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PREMIUM_REQUIRED');
    const es = await rider.post('/api/rides/read-screenshot').set('Accept-Language', 'es').send({ image, mediaType: 'image/jpeg' });
    expect(es.body.error.message).toBe('Esta es una función Premium');
    expect(seen).toHaveLength(0); // never reached the reader
  });

  test('premium riders get the summary, in the same shape as a file import', async () => {
    await makePremium();
    const res = await rider.post('/api/rides/read-screenshot').send({ image, mediaType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      source: 'screenshot',
      name: 'Morning Ride',
      date: '2026-11-08',
      time: '07:42',
      durationMin: 126,
      elapsedMin: 140,
      distanceKm: 64.4,
      elevationGainM: 812,
      avgPowerW: 181,
      normalizedPowerW: null,
      workKj: 1363,
      avgHr: 139,
      tempC: null,
      indoor: false,
    });
    expect(seen[0]).toEqual({ image, mediaType: 'image/png' });
  });

  test('a real-size screenshot fits (bigger than the usual 100 KB body limit); other routes keep the small limit', async () => {
    await makePremium();
    const big = 'A'.repeat(1_500_000);
    expect((await rider.post('/api/rides/read-screenshot').send({ image: big, mediaType: 'image/jpeg' })).status).toBe(200);
    expect((await rider.post('/api/foods').send({ name: 'x'.repeat(200_000) })).status).toBe(413);
  });

  test('not an image, or the wrong kind → 400', async () => {
    await makePremium();
    expect((await rider.post('/api/rides/read-screenshot').send({ image: 'not base64!!', mediaType: 'image/jpeg' })).status).toBe(400);
    expect((await rider.post('/api/rides/read-screenshot').send({ image, mediaType: 'application/pdf' })).status).toBe(400);
  });

  test('without an Anthropic key the feature says it is unavailable (503), not a crash', async () => {
    const noKey = request.agent(makeApp());
    await noKey.post('/api/auth/register').send(newUser({ email: 'nokey@example.com' }));
    await User.updateOne({ email: 'nokey@example.com' }, { plan: 'premium' });
    const res = await noKey.post('/api/rides/read-screenshot').send({ image, mediaType: 'image/jpeg' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('FEATURE_UNAVAILABLE');
  });

  test('riders cannot make themselves premium', async () => {
    expect((await rider.patch('/api/users/me').send({ plan: 'premium' })).status).toBe(400);
  });
});

describe('the request the real SDK sends to Anthropic (fake server)', () => {
  const reply = (body) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const message = (overrides) => ({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text: JSON.stringify(modelOutput) }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1500, output_tokens: 150 },
    ...overrides,
  });

  test('model, fallback beta, low effort, JSON schema, image first; the reply is validated', async () => {
    const sent = [];
    const { createScreenshotReader } = await import('../src/services/screenshotService.js');
    const read = createScreenshotReader({
      anthropicApiKey: 'test-key',
      screenshotModel: 'claude-opus-5-5',
      anthropicFetch: async (url, init) => {
        sent.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) });
        return reply(message());
      },
    });
    const summary = await read({ image, mediaType: 'image/jpeg' });
    expect(summary).toMatchObject({ source: 'screenshot', durationMin: 126, workKj: 1363 });

    const [req] = sent;
    expect(req.url).toMatch(/\/v1\/messages/);
    expect(req.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(req.body).toMatchObject({
      model: 'claude-opus-5-5',
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    });
    expect(req.body.thinking).toBeUndefined(); // Opus 5.5: thinking can't be disabled; effort is the control
    expect(req.body.output_config.format.schema.required).toContain('isRideSummary');
    const [img, text] = req.body.messages[0].content;
    expect(img).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
    expect(text.text).toMatch(/Never estimate/);
  });

  test('a refusal or a reply that isn’t our JSON → 422, never a crash', async () => {
    const { createScreenshotReader } = await import('../src/services/screenshotService.js');
    for (const bad of [message({ stop_reason: 'refusal', content: [] }), message({ content: [{ type: 'text', text: 'hello' }] })]) {
      const read = createScreenshotReader({ anthropicApiKey: 'k', screenshotModel: 'claude-opus-5-5', anthropicFetch: async () => reply(bad) });
      await expect(read({ image, mediaType: 'image/jpeg' })).rejects.toMatchObject({ status: 422, code: 'SCREENSHOT_UNREADABLE' });
    }
  });
});

describe('reading the model output (toSummary)', () => {
  test('not a ride, or no time at all → 422 NOT_A_RIDE_SCREENSHOT', () => {
    expect(() => toSummary({ ...modelOutput, isRideSummary: false })).toThrow(
      expect.objectContaining({ status: 422, code: 'NOT_A_RIDE_SCREENSHOT' }),
    );
    expect(() => toSummary({ ...modelOutput, movingTimeMin: null, elapsedTimeMin: null })).toThrow(
      expect.objectContaining({ code: 'NOT_A_RIDE_SCREENSHOT' }),
    );
  });

  test('implausible numbers are dropped for the rider to fill in; bad date/time ignored', () => {
    const s = toSummary({ ...modelOutput, avgHr: 999, avgPowerW: 5, date: 'Nov 8', startTime: '7:42 AM' });
    expect(s).toMatchObject({ avgHr: null, avgPowerW: null, date: null, time: null });
  });

  test('only elapsed time shown → used as the duration', () => {
    expect(toSummary({ ...modelOutput, movingTimeMin: null }).durationMin).toBe(140);
  });
});

describe('saving a screenshot ride', () => {
  test('without a start time two rides on the same day are both kept', async () => {
    const body = {
      date: '2026-11-08T12:00:00.000Z',
      durationMin: 90,
      intensity: { avgPowerW: 170 },
      status: 'completed',
      imported: { source: 'screenshot', distanceKm: 40, elevationGainM: 300 },
    };
    expect((await rider.post('/api/rides').send(body)).status).toBe(201);
    expect((await rider.post('/api/rides').send(body)).status).toBe(201);
  });
});
