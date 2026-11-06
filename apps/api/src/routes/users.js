import { Router } from 'express';
import { usersController } from '../controllers/usersController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { updateProfileBody } from '../validators/users.js';

export function usersRoutes(config) {
  const router = Router();
  router.use(requireAuth(config));
  router.get('/me', usersController.getMe);
  router.patch('/me', validate({ body: updateProfileBody }), usersController.updateMe);
  return router;
}
