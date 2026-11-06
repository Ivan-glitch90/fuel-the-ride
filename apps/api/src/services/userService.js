import { User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';

export async function getUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  return user;
}

/** Applies a validated profile patch. `null` clears an optional field. */
export async function updateProfile(userId, patch) {
  const user = await getUser(userId);
  if (patch.trainedCarbRateGph != null && patch.trainedCarbRateGph > user.trainedCarbRateGph) {
    user.lastCarbRateIncreaseAt = new Date();
  }
  for (const [key, value] of Object.entries(patch)) {
    user.set(key, value === null ? undefined : value);
  }
  await user.save();
  return user;
}
