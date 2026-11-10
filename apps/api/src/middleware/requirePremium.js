import { getUser } from '../services/userService.js';
import { HttpError } from '../utils/httpError.js';

/** After requireAuth: only premium riders get through (403 PREMIUM_REQUIRED otherwise). */
export const requirePremium = async (req, _res, next) => {
  const user = await getUser(req.user.id);
  if (user.plan !== 'premium') throw new HttpError(403, 'PREMIUM_REQUIRED', 'This is a Premium feature');
  next();
};
