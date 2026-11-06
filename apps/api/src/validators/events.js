import { z } from 'zod';
import { constants } from '@fuel-ride/fuel-core';
import { objectId } from './foods.js';

// Types only here; ranges come from fuel-core and return as 400s from the calculator.
const pastIntensity = z
  .strictObject({ workKj: z.number(), avgPowerW: z.number(), normalizedPowerW: z.number(), avgHr: z.number() })
  .partial()
  .refine((i) => Object.keys(i).length > 0, "Enter last time's power, kilojoules or average heart rate");

const score = z.number().int().min(1).max(5);

const past = z.strictObject({
  rideId: objectId.optional(),
  durationMin: z.number(),
  intensity: pastIntensity,
  ftpAtTimeW: z.number().optional(),
  carbsGphEaten: z.number().min(0).max(150).optional(),
  giScore: score.optional(),
  energyScore: score.optional(),
  bonked: z.boolean().optional(),
});

const foodIds = z
  .array(objectId)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, 'Each food can only be picked once');

const fields = {
  name: z.string().trim().min(1).max(80),
  type: z.enum(constants.EVENT_TYPES),
  date: z.coerce.date(),
  durationMin: z.number(),
  indoor: z.boolean(),
  tempC: z.number(),
  carbGoalGph: z.number(),
  foodIds,
  past,
};

export const createEventBody = z.strictObject({
  ...fields,
  durationMin: fields.durationMin.optional(),
  indoor: fields.indoor.default(false),
  tempC: fields.tempC.optional(),
  carbGoalGph: fields.carbGoalGph.optional(),
  foodIds: foodIds.default([]),
});

export const updateEventBody = z
  .strictObject({
    ...fields,
    durationMin: fields.durationMin.nullable(),
    tempC: fields.tempC.nullable(),
    carbGoalGph: fields.carbGoalGph.nullable(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Provide at least one field to update');

export const listEventsQuery = z.object({
  when: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
});
