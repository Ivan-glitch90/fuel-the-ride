import { createFood, deleteFood, getFood, listFoods, updateFood } from '../services/foodService.js';

export const foodsController = {
  async list(req, res) {
    res.json({ foods: await listFoods(req.user.id, req.valid.query) });
  },

  async get(req, res) {
    res.json({ food: await getFood(req.user.id, req.valid.params.id) });
  },

  async create(req, res) {
    res.status(201).json({ food: await createFood(req.user.id, req.valid.body) });
  },

  async update(req, res) {
    res.json({ food: await updateFood(req.user.id, req.valid.params.id, req.valid.body) });
  },

  // 204 when deleted; 200 with the food when it was archived because past rides use it
  async remove(req, res) {
    const result = await deleteFood(req.user.id, req.valid.params.id);
    if (result.archived) return res.json({ archived: true, food: result.food });
    return res.status(204).end();
  },
};
