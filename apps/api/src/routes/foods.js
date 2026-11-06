import { Router } from 'express';
import { foodsController as foods } from '../controllers/foodsController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { createFoodBody, idParams, listFoodsQuery, updateFoodBody } from '../validators/foods.js';

export function foodsRoutes(config) {
  const router = Router();
  router.use(requireAuth(config));

  router.get('/', validate({ query: listFoodsQuery }), foods.list);
  router.post('/', validate({ body: createFoodBody }), foods.create);
  router.get('/:id', validate({ params: idParams }), foods.get);
  router.patch('/:id', validate({ params: idParams, body: updateFoodBody }), foods.update);
  router.delete('/:id', validate({ params: idParams }), foods.remove);

  return router;
}
