import { z } from 'zod';
import { constants } from '@fuel-ride/fuel-core';
import { inRange } from './common.js';
import { SEXES, UNIT_SYSTEMS } from '../models/User.js';
import { MIN_AGE, POLICY_VERSION } from '../policy.js';
import { SUPPORTED_LANGUAGES } from '../i18n.js';

export const consentBody = z.strictObject({
  version: z.literal(POLICY_VERSION, { error: 'Please reload the page to see the latest Terms and Privacy Policy' }),
});

const { LIMITS } = constants;
const thisYear = new Date().getFullYear();

export const updateProfileBody = z
  .strictObject({
    name: z.string().trim().min(1).max(80),
    weightKg: inRange(LIMITS.weightKg),
    birthYear: z
      .number()
      .int()
      .min(thisYear - LIMITS.age.max)
      .max(thisYear - MIN_AGE, `Fuel the Ride is for riders aged ${MIN_AGE} and over`),
    sex: z.enum(SEXES),
    ftpW: inRange(LIMITS.ftpW).nullable(),
    maxHr: inRange(LIMITS.maxHr).int().nullable(),
    lthr: inRange(LIMITS.lthr).int().nullable(),
    restingHr: z.number().int().min(30).max(120).nullable(),
    trainedCarbRateGph: inRange(LIMITS.trainedCarbRateGph),
    sweatRateMlPerHr: inRange(LIMITS.sweatRateMlPerHr).nullable(),
    sweatSodium: z.enum(constants.SWEAT_SODIUM_LEVELS),
    units: z.enum(UNIT_SYSTEMS),
    language: z.enum(SUPPORTED_LANGUAGES), // emails use it; the app sends Accept-Language itself
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Provide at least one field to update');
