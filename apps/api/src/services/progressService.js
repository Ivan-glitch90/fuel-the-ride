import { CheckIn, Ride } from '../models/index.js';
import { getUser } from './userService.js';

const dateRange = (from, to) => (from || to ? { ...(from && { $gte: from }), ...(to && { $lte: to }) } : undefined);

/**
 * Data for the two progress charts, oldest point first (left to right on a chart).
 *  - carbRate: one point per check-in: trained rate at the time, plan target and what was actually eaten
 *  - energyBalance: one point per ride with logged intake: kcal burned (plan) vs kcal eaten (actual)
 */
export async function getProgress(userId, { from, to, limit = 100 } = {}) {
  const user = await getUser(userId);
  const range = dateRange(from, to);

  const checkIns = await CheckIn.find({ userId, ...(range && { rideDate: range }) })
    .sort({ rideDate: -1 })
    .limit(limit)
    .select('rideId rideDate trainedGphAtCheckIn giScore');
  const checkInRides = await Ride.find({ userId, _id: { $in: checkIns.map((c) => c.rideId) } }).select(
    'plan.targets actual',
  );
  const rideById = new Map(checkInRides.map((r) => [String(r._id), r]));

  const carbRate = checkIns
    .map((c) => {
      const ride = rideById.get(String(c.rideId));
      return {
        rideId: String(c.rideId),
        date: c.rideDate,
        trainedGph: c.trainedGphAtCheckIn,
        targetGph: ride?.plan?.targets?.carbsGph ?? null,
        actualGph: ride?.actual?.carbsGph ?? null, // null when nothing was logged
        giScore: c.giScore,
      };
    })
    .reverse();

  const loggedRides = await Ride.find({ userId, actual: { $ne: null }, ...(range && { date: range }) })
    .sort({ date: -1 })
    .limit(limit)
    .select('name date plan.kcalBurned actual.kcal');

  const energyBalance = loggedRides
    .map((r) => ({
      rideId: String(r._id),
      date: r.date,
      name: r.name ?? null,
      kcalBurned: r.plan.kcalBurned,
      kcalEaten: r.actual.kcal,
    }))
    .reverse();

  return { current: { trainedGph: user.trainedCarbRateGph }, carbRate, energyBalance };
}
