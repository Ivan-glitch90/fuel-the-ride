import { z } from 'zod';
import { constants } from '@fuel-ride/fuel-core';
import { inRange } from './common.js';
import { SEXES, UNIT_SYSTEMS } from '../models/User.js';

const { LIMITS } = constants;
const thisYear = new Date().getFullYear();

export const updateProfileBody = z
  .strictObject({
    name: z.string().trim().min(1).max(80),
    weightKg: inRange(LIMITS.weightKg),
    birthYear: z.number().int().min(thisYear - LIMITS.age.max).max(thisYear - LIMITS.age.min),
    sex: z.enum(SEXES),
    ftpW: inRange(LIMITS.ftpW).nullable(),
    maxHr: inRange(LIMITS.maxHr).int().nullable(),
    lthr: inRange(LIMITS.lthr).int().nullable(),
    restingHr: z.number().int().min(30).max(120).nullable(),
    trainedCarbRateGph: inRange(LIMITS.trainedCarbRateGph),
    sweatRateMlPerHr: inRange(LIMITS.sweatRateMlPerHr).nullable(),
    sweatSodium: z.enum(constants.SWEAT_SODIUM_LEVELS),
    units: z.enum(UNIT_SYSTEMS),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Provide at least one field to update');
