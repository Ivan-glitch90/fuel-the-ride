import { z } from 'zod';
import { objectId } from './foods.js';

const score = z.number().int().min(1).max(5);

const answers = {
  giScore: score,
  energyScore: score,
  legsScore: score,
  bonked: z.boolean(),
  cramped: z.boolean(),
  notes: z.string().trim().max(1000),
};

export const createCheckInBody = z.strictObject({
  rideId: objectId,
  ...answers,
  bonked: answers.bonked.default(false),
  cramped: answers.cramped.default(false),
  notes: answers.notes.optional(),
});

export const updateCheckInBody = z
  .strictObject({ ...answers, notes: answers.notes.nullable() })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Provide at least one field to update');

export const listCheckInsQuery = z.object({
  rideId: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
