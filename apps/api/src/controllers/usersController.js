import { getUser, updateProfile } from '../services/userService.js';

export const usersController = {
  async getMe(req, res) {
    res.json({ user: await getUser(req.user.id) });
  },

  async updateMe(req, res) {
    res.json({ user: await updateProfile(req.user.id, req.valid.body) });
  },
};
