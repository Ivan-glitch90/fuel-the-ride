import { Router } from 'express';
import { usersController } from '../controllers/usersController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { updateProfileBody } from '../validators/users.js';
import { deleteAccountBody } from '../validators/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

/** @param auth the shared auth controller (also clears the session cookies when the account is deleted) */
export function usersRoutes(config, auth) {
  const router = Router();
  router.use(requireAuth(config));
  router.get('/me', usersController.getMe);
  router.patch('/me', validate({ body: updateProfileBody }), usersController.updateMe);
  // Deletes the account and all its data. Rate-limited: it checks a password.
  router.delete('/me', authRateLimiter(config), validate({ body: deleteAccountBody }), auth.deleteAccount);
  return router;
}
