import { z } from 'zod';

export const email = z.string().trim().toLowerCase().pipe(z.email({ error: 'Enter a valid email address' }));

/** Number in [min, max], using the ranges from fuel-core's LIMITS. */
export const inRange = ({ min, max }) => z.number().min(min).max(max);
