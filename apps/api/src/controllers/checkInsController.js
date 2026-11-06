import {
  createCheckIn,
  deleteCheckIn,
  getCheckIn,
  listCheckIns,
  updateCheckIn,
} from '../services/checkInService.js';

export const checkInsController = {
  async list(req, res) {
    res.json({ checkIns: await listCheckIns(req.user.id, req.valid.query) });
  },

  async get(req, res) {
    res.json({ checkIn: await getCheckIn(req.user.id, req.valid.params.id) });
  },

  // The response includes suggestions (carb rate, hydration/sodium flags, measured sweat rate)
  async create(req, res) {
    res.status(201).json({ checkIn: await createCheckIn(req.user.id, req.valid.body) });
  },

  async update(req, res) {
    res.json({ checkIn: await updateCheckIn(req.user.id, req.valid.params.id, req.valid.body) });
  },

  async remove(req, res) {
    await deleteCheckIn(req.user.id, req.valid.params.id);
    res.status(204).end();
  },
};
