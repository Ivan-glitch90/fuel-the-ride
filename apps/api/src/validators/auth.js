import { z } from 'zod';
import { email } from './common.js';

// bcrypt only uses the first 72 bytes of a password
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password is too long');

export const registerBody = z.strictObject({
  email,
  password,
  name: z.string().trim().min(1).max(80),
});

export const loginBody = z.object({
  email,
  password: z.string().min(1).max(200),
});

export const refreshBody = z.object({
  refreshToken: z.string().optional(), // mobile clients send it in the body; web uses the cookie
});
