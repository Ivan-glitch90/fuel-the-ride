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
  // The signup checkbox: 16+, Terms, Privacy Policy and explicit consent to health data processing
  acceptTerms: z.literal(true, { error: 'Please confirm you are 16 or older and agree to the Terms and Privacy Policy' }),
});

export const loginBody = z.object({
  email,
  password: z.string().min(1).max(200),
});

const linkToken = z.string().min(20).max(200);

export const verifyEmailBody = z.strictObject({ token: linkToken });
export const forgotPasswordBody = z.strictObject({ email });
export const resetPasswordBody = z.strictObject({ token: linkToken, password });
// Typing DELETE is required; the password too for accounts that have one (checked in the service)
export const deleteAccountBody = z.strictObject({
  confirm: z.literal('DELETE', { error: 'Type DELETE to confirm' }),
  password: z.string().max(200).optional(),
});

export const googleBody = z.strictObject({
  credential: z.string().min(20).max(5000), // Google ID token (a JWT)
});

export const refreshBody = z.object({
  refreshToken: z.string().optional(), // mobile clients send it in the body; web uses the cookie
});
