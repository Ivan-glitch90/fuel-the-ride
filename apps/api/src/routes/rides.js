import { Router } from 'express';
import { ridesController as rides } from '../controllers/ridesController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/foods.js';
import { createRideBody, listRidesQuery, similarRidesQuery, updateRideBody } from '../validators/rides.js';

export function ridesRoutes(config) {
  const router = Router();
  router.use(requireAuth(config));

  router.get('/', validate({ query: listRidesQuery }), rides.list);
  router.post('/', validate({ body: createRideBody }), rides.create);
  router.get('/similar', validate({ query: similarRidesQuery }), rides.similar); // before /:id

  router.get('/:id', validate({ params: idParams }), rides.get);
  router.patch('/:id', validate({ params: idParams, body: updateRideBody }), rides.update);
  router.delete('/:id', validate({ params: idParams }), rides.remove);

  return router;
}
