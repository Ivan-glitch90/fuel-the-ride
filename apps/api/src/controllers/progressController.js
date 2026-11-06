import { getProgress } from '../services/progressService.js';

export const progressController = {
  // One call feeds both charts (carb rate over time, kcal burned vs eaten)
  async get(req, res) {
    res.json(await getProgress(req.user.id, req.valid.query));
  },
};
