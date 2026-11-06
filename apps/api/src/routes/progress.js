import { Router } from 'express';
import { progressController as progress } from '../controllers/progressController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { progressQuery } from '../validators/progress.js';

export function progressRoutes(config) {
  const router = Router();
  router.use(requireAuth(config));
  router.get('/', validate({ query: progressQuery }), progress.get);
  return router;
}
