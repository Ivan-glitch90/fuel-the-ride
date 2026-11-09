import { getUser, updateProfile } from '../services/userService.js';
import { exportData, recordConsent } from '../services/privacyService.js';

export const usersController = {
  async consent(req, res) {
    res.json({ user: await recordConsent(req.user.id) });
  },

  // Downloaded as a file named after the date
  async exportData(req, res) {
    const data = await exportData(req.user.id);
    res.set('Content-Disposition', `attachment; filename="fuel-the-ride-data-${data.exportedAt.slice(0, 10)}.json"`);
    res.set('Cache-Control', 'no-store');
    res.json(data);
  },

  async getMe(req, res) {
    res.json({ user: await getUser(req.user.id) });
  },

  async updateMe(req, res) {
    res.json({ user: await updateProfile(req.user.id, req.valid.body) });
  },
};
