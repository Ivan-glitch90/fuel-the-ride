import { Router } from 'express';
import { eventsController as events } from '../controllers/eventsController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { createEventBody, listEventsQuery, updateEventBody } from '../validators/events.js';
import { idParams } from '../validators/foods.js';

export function eventsRoutes(config) {
  const router = Router();
  router.use(requireAuth(config));

  router.get('/', validate({ query: listEventsQuery }), events.list);
  router.post('/', validate({ body: createEventBody }), events.create);
  router.get('/:id', validate({ params: idParams }), events.get);
  router.patch('/:id', validate({ params: idParams, body: updateEventBody }), events.update);
  router.delete('/:id', validate({ params: idParams }), events.remove);

  return router;
}
