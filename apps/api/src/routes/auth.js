import { Router } from 'express';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import {
  forgotPasswordBody,
  googleBody,
  loginBody,
  refreshBody,
  registerBody,
  resetPasswordBody,
  verifyEmailBody,
} from '../validators/auth.js';

/** @param auth the shared auth controller (see routes/index.js) */
export function authRoutes(config, auth) {
  const router = Router();
  const limiter = authRateLimiter(config);

  router.post('/register', limiter, validate({ body: registerBody }), auth.register);
  router.post('/login', limiter, validate({ body: loginBody }), auth.login);
  router.post('/google', limiter, validate({ body: googleBody }), auth.google);
  router.get('/providers', auth.providers);
  router.post('/refresh', validate({ body: refreshBody }), auth.refresh);
  router.post('/logout', validate({ body: refreshBody }), auth.logout);
  router.get('/me', requireAuth(config), auth.me);

  // Account basics. Everything that sends email is rate-limited, so it can't be used to spam an inbox.
  router.post('/verify-email', limiter, validate({ body: verifyEmailBody }), auth.verifyEmail);
  router.post('/resend-verification', limiter, requireAuth(config), auth.resendVerification);
  router.post('/forgot-password', limiter, validate({ body: forgotPasswordBody }), auth.forgotPassword);
  router.post('/reset-password', limiter, validate({ body: resetPasswordBody }), auth.resetPassword);

  return router;
}
