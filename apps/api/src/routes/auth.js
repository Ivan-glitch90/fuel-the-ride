import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { googleBody, loginBody, refreshBody, registerBody } from '../validators/auth.js';

export function authRoutes(config) {
  const router = Router();
  const auth = createAuthController(config);
  const limiter = authRateLimiter(config);

  router.post('/register', limiter, validate({ body: registerBody }), auth.register);
  router.post('/login', limiter, validate({ body: loginBody }), auth.login);
  router.post('/google', limiter, validate({ body: googleBody }), auth.google);
  router.get('/providers', auth.providers);
  router.post('/refresh', validate({ body: refreshBody }), auth.refresh);
  router.post('/logout', validate({ body: refreshBody }), auth.logout);
  router.get('/me', requireAuth(config), auth.me);

  return router;
}
