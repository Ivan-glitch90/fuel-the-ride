import { createEvent, deleteEvent, getEvent, listEvents, updateEvent } from '../services/eventService.js';

// Every event comes back with `forecast`: projected effort, gut-training build-up and race-day plan
export const eventsController = {
  async list(req, res) {
    res.json({ events: await listEvents(req.user.id, req.valid.query) });
  },

  async get(req, res) {
    res.json({ event: await getEvent(req.user.id, req.valid.params.id) });
  },

  async create(req, res) {
    res.status(201).json({ event: await createEvent(req.user.id, req.valid.body) });
  },

  async update(req, res) {
    res.json({ event: await updateEvent(req.user.id, req.valid.params.id, req.valid.body) });
  },

  async remove(req, res) {
    await deleteEvent(req.user.id, req.valid.params.id);
    res.status(204).end();
  },
};
