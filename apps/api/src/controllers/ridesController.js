import { createRide, deleteRide, getRide, listRides, updateRide } from '../services/rideService.js';

export const ridesController = {
  async list(req, res) {
    res.json({ rides: await listRides(req.user.id, req.valid.query) });
  },

  async get(req, res) {
    res.json({ ride: await getRide(req.user.id, req.valid.params.id) });
  },

  // The response includes the fueling plan
  async create(req, res) {
    res.status(201).json({ ride: await createRide(req.user.id, req.valid.body) });
  },

  async update(req, res) {
    res.json({ ride: await updateRide(req.user.id, req.valid.params.id, req.valid.body) });
  },

  async remove(req, res) {
    await deleteRide(req.user.id, req.valid.params.id);
    res.status(204).end();
  },
};
