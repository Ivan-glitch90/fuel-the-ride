import { createRide, deleteRide, getRide, listRides, similarRides, updateRide } from '../services/rideService.js';

/** Premium: read a ride summary screenshot → the same summary a ride file gives (nothing is saved). */
export const screenshotController = (readScreenshot) => async (req, res) => {
  res.json({ summary: await readScreenshot(req.valid.body) });
};

export const ridesController = {
  async similar(req, res) {
    res.json({ rides: await similarRides(req.user.id, req.valid.query) });
  },

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
