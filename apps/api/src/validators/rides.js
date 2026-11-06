import { z } from 'zod';
import { objectId } from './foods.js';

// Types only here: ranges live in fuel-core (single source of truth) and come back as 400s from the calculator.
const intensity = z
  .strictObject({
    workKj: z.number(),
    avgPowerW: z.number(),
    normalizedPowerW: z.number(),
    avgHr: z.number(),
    powerZone: z.number().int(),
    hrZone: z.number().int(),
  })
  .partial()
  .refine((i) => Object.keys(i).length > 0, 'Intensity required: enter kJ, power, heart rate or a zone');

const foodIds = z
  .array(objectId)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, 'Each food can only be picked once');

const intake = z
  .array(z.strictObject({ foodId: objectId, servings: z.number().min(0).max(50) }))
  .max(50)
  .refine((items) => new Set(items.map((i) => i.foodId)).size === items.length, 'List each food once');

const weightKg = z.number().min(30).max(200);

export const createRideBody = z.strictObject({
  name: z.string().trim().max(80).optional(),
  date: z.coerce.date().default(() => new Date()),
  durationMin: z.number(),
  intensity,
  tempC: z.number().optional(),
  foodIds: foodIds.default([]),
});

export const updateRideBody = z
  .strictObject({
    name: z.string().trim().max(80).nullable(),
    date: z.coerce.date(),
    // Changing any of these four recalculates the plan
    durationMin: z.number(),
    intensity, // replaces the whole intensity object
    tempC: z.number().nullable(),
    foodIds,
    // Logging what happened
    intake,
    plainWaterMl: z.number().min(0).max(20000),
    weightPreKg: weightKg.nullable(),
    weightPostKg: weightKg.nullable(),
    status: z.enum(['planned', 'completed']),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Provide at least one field to update');

export const listRidesQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(['planned', 'completed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
