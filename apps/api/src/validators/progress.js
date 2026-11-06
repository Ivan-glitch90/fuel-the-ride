import { z } from 'zod';

export const progressQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(365).default(100), // most recent points per series
});
