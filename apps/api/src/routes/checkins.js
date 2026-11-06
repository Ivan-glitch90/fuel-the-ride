import { Router } from 'express';
import { checkInsController as checkIns } from '../controllers/checkInsController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { createCheckInBody, listCheckInsQuery, updateCheckInBody } from '../validators/checkins.js';
import { idParams } from '../validators/foods.js';

export function checkInsRoutes(config) {
  const router = Router();
  router.use(requireAuth(config));

  router.get('/', validate({ query: listCheckInsQuery }), checkIns.list);
  router.post('/', validate({ body: createCheckInBody }), checkIns.create);
  router.get('/:id', validate({ params: idParams }), checkIns.get);
  router.patch('/:id', validate({ params: idParams, body: updateCheckInBody }), checkIns.update);
  router.delete('/:id', validate({ params: idParams }), checkIns.remove);

  return router;
}
