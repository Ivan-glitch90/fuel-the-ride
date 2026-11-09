import { CheckIn, Event, Food, Ride, User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { POLICY_VERSION } from '../policy.js';

/** Records explicit consent to the current Terms + Privacy Policy (incl. health data). */
export async function recordConsent(userId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  user.consentAt = new Date();
  user.consentVersion = POLICY_VERSION;
  await user.save();
  return user;
}

/**
 * Everything stored about the rider, in one JSON document (GDPR right of access / portability).
 * Secrets stay out: no password hash, Google id, sessions or link tokens.
 */
export async function exportData(userId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const [foods, rides, checkIns, events] = await Promise.all([
    Food.find({ userId }).sort({ createdAt: 1 }),
    Ride.find({ userId }).sort({ date: 1 }),
    CheckIn.find({ userId }).sort({ rideDate: 1 }),
    Event.find({ userId }).sort({ date: 1 }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    format: 'fuel-the-ride-export/1',
    account: user.toJSON(),
    foods: foods.map((d) => d.toJSON()),
    rides: rides.map((d) => d.toJSON()),
    checkIns: checkIns.map((d) => d.toJSON()),
    events: events.map((d) => d.toJSON()),
  };
}
