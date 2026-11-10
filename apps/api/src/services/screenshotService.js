// Premium: read a ride summary screenshot (Strava, Garmin Connect, Wahoo, Zwift…) with Claude.
// The image is sent to Anthropic for this one request and never stored by us; only the numbers
// come back to the app, where the rider checks them before saving (same form as a file import).
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';

// Everything nullable: the model fills only what the screenshot actually shows.
const RideScreenshot = z.object({
  isRideSummary: z.boolean(),
  name: z.string().nullable(),
  date: z.string().nullable(), // YYYY-MM-DD
  startTime: z.string().nullable(), // HH:MM, 24-hour, as shown
  movingTimeMin: z.number().nullable(),
  elapsedTimeMin: z.number().nullable(),
  distanceKm: z.number().nullable(),
  elevationGainM: z.number().nullable(),
  avgPowerW: z.number().nullable(),
  normalizedPowerW: z.number().nullable(),
  workKj: z.number().nullable(),
  avgHr: z.number().nullable(),
  tempC: z.number().nullable(),
  indoor: z.boolean().nullable(),
});

const PROMPT = `This is a screenshot a cyclist took of one ride's summary in a fitness app (for example Strava, Garmin Connect, Wahoo, Zwift, TrainingPeaks or a bike computer). Read the ride's numbers.

Rules:
- Fill a field only when the screenshot shows that value for this ride. Never estimate or compute a value that isn't shown; use null instead.
- Convert to metric: miles → km, feet → m, °F → °C. Durations in minutes (1:45:30 → 105.5).
- "Moving time" goes in movingTimeMin; "elapsed" or "total time" goes in elapsedTimeMin. If only one time is shown, use movingTimeMin.
- workKj is total work in kilojoules ("Total work", "kJ"). Calories are not kilojoules: ignore calories.
- normalizedPowerW is "Normalized Power" / "NP" / "Weighted avg power".
- date as YYYY-MM-DD and startTime as HH:MM (24-hour) only if shown. The screenshot may be in any language.
- indoor is true for virtual or trainer rides (Zwift, "Virtual Ride", "Indoor Cycling"), false for outdoor rides, null if unclear.
- If the image is not a single ride's summary, set isRideSummary to false and everything else to null.`;

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const round = (v, digits = 0) => (v === null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const inRange = (v, min, max) => (v !== null && v >= min && v <= max ? v : null);

/**
 * @param {object} config  app config (anthropicApiKey, screenshotModel; tests pass readScreenshot)
 * @returns {(input: { image: string, mediaType: string }) => Promise<object>} the ride summary, in the
 *   same shape the web app's file reader produces (source 'screenshot'), plus date/startTime strings.
 */
export function createScreenshotReader(config) {
  if (config.readScreenshot) return config.readScreenshot; // tests: no network
  if (!config.anthropicApiKey) {
    return async () => {
      throw new HttpError(503, 'FEATURE_UNAVAILABLE', "Reading screenshots isn't available right now");
    };
  }
  const client = new Anthropic({
    apiKey: config.anthropicApiKey,
    maxRetries: 2,
    timeout: 60_000,
    ...(config.anthropicFetch && { fetch: config.anthropicFetch }), // tests: a fake Anthropic server
  });

  return async function readScreenshot({ image, mediaType }) {
    if (!MEDIA_TYPES.includes(mediaType)) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Some fields are invalid', [
        { path: 'mediaType', message: 'Use a JPEG, PNG or WebP image' },
      ]);
    }
    let response;
    try {
      response = await client.beta.messages.create({
        model: config.screenshotModel,
        max_tokens: 4000,
        // A declined request is retried on Anthropic's recommended fallback model, server-side
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: zodOutputFormat(RideScreenshot) },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      });
    } catch (err) {
      if (err instanceof Anthropic.BadRequestError) {
        throw new HttpError(422, 'SCREENSHOT_UNREADABLE', "Couldn't read that screenshot. Try a clearer one.");
      }
      if (err instanceof Anthropic.APIError) {
        // Rate limits, overload, outages: not the rider's fault, and nothing they can fix
        throw new HttpError(503, 'FEATURE_UNAVAILABLE', "Reading screenshots isn't available right now");
      }
      throw err;
    }

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      throw new HttpError(422, 'SCREENSHOT_UNREADABLE', "Couldn't read that screenshot. Try a clearer one.");
    }
    const text = response.content.find((b) => b.type === 'text')?.text;
    let parsed;
    try {
      parsed = RideScreenshot.safeParse(JSON.parse(text));
    } catch {
      parsed = { success: false };
    }
    if (!parsed.success) {
      throw new HttpError(422, 'SCREENSHOT_UNREADABLE', "Couldn't read that screenshot. Try a clearer one.");
    }
    return toSummary(parsed.data);
  };
}

/** Model output → the app's ride summary. Out-of-range numbers are dropped (the rider fills them in). */
export function toSummary(r) {
  if (!r.isRideSummary) {
    throw new HttpError(422, 'NOT_A_RIDE_SCREENSHOT', "That doesn't look like a ride summary. Try a screenshot of one ride.");
  }
  const moving = inRange(r.movingTimeMin ?? r.elapsedTimeMin, 1, 24 * 60);
  if (moving === null) {
    throw new HttpError(422, 'NOT_A_RIDE_SCREENSHOT', "That doesn't look like a ride summary. Try a screenshot of one ride.");
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') ? r.date : null;
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(r.startTime ?? '') ? r.startTime : null;
  return {
    source: 'screenshot',
    name: r.name?.trim().slice(0, 80) || null,
    date, // the app turns date + time into a start time in the rider's time zone
    time,
    durationMin: round(moving),
    elapsedMin: round(inRange(r.elapsedTimeMin, 1, 24 * 60) ?? moving),
    distanceKm: round(inRange(r.distanceKm, 0.1, 2000), 1),
    elevationGainM: round(inRange(r.elevationGainM, 1, 20000)),
    avgPowerW: round(inRange(r.avgPowerW, 20, 2000)),
    normalizedPowerW: round(inRange(r.normalizedPowerW, 20, 2000)),
    workKj: round(inRange(r.workKj, 10, 20000)),
    avgHr: round(inRange(r.avgHr, 40, 230)),
    tempC: round(inRange(r.tempC, -30, 55)),
    indoor: r.indoor === true,
  };
}
