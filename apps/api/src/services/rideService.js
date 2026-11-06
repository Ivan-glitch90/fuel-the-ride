import { buildFuelPlan, summarizeIntake, toCalculatorUser } from '@fuel-ride/fuel-core';
import { CheckIn, Food, Ride } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { getUser } from './userService.js';
import { withFuelErrors } from './fuelErrors.js';

const PLAN_INPUTS = ['durationMin', 'intensity', 'tempC', 'indoor', 'rideType', 'foodIds'];

const notFound = () => new HttpError(404, 'RIDE_NOT_FOUND', 'Ride not found');

/** Loads the rider's foods by id, keeping the given order. Unknown or foreign ids → 400. */
async function loadFoods(userId, ids, path) {
  if (ids.length === 0) return [];
  const docs = await Food.find({ _id: { $in: ids }, userId });
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const missing = ids.filter((id) => !byId.has(String(id)));
  if (missing.length > 0) {
    throw new HttpError(
      400,
      'FOOD_NOT_FOUND',
      'Some foods were not found in your library',
      missing.map((id) => ({ path, message: `Unknown food ${id}` })),
    );
  }
  return ids.map((id) => byId.get(String(id)).toJSON());
}

async function computePlan(user, { date, durationMin, intensity, tempC, indoor, rideType, foodIds }) {
  if (!user.weightKg) {
    throw new HttpError(400, 'PROFILE_INCOMPLETE', 'Complete your profile to plan this ride', [
      { path: 'profile.weightKg', message: 'Add your weight' },
    ]);
  }
  const foods = await loadFoods(user._id, foodIds.map(String), 'foodIds');
  return withFuelErrors(() =>
    // Same profile → calculator mapping the web app uses for its live preview
    buildFuelPlan({
      ride: { durationMin, intensity, tempC, indoor, rideType },
      user: toCalculatorUser(user, date),
      foods,
    }),
  );
}

async function computeActual(ride) {
  if (ride.intake.length === 0 && !ride.plainWaterMl) return null;
  const foodIds = ride.intake.map((i) => String(i.foodId));
  const foods = await loadFoods(ride.userId, foodIds, 'intake');
  return withFuelErrors(() =>
    summarizeIntake({
      intake: ride.intake.map((i) => ({ foodId: String(i.foodId), servings: i.servings })),
      plainWaterMl: ride.plainWaterMl,
      foods,
      durationMin: ride.durationMin,
    }),
  );
}

export async function getRide(userId, rideId) {
  const ride = await Ride.findOne({ _id: rideId, userId });
  if (!ride) throw notFound();
  return ride;
}

export async function listRides(userId, { from, to, status, limit = 20 } = {}) {
  const filter = { userId };
  if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  if (status) filter.status = status;
  return Ride.find(filter).sort({ date: -1, _id: -1 }).limit(limit);
}

export async function createRide(userId, input) {
  const user = await getUser(userId);
  const plan = await computePlan(user, input);
  return Ride.create({
    userId,
    name: input.name,
    date: input.date,
    durationMin: input.durationMin,
    intensity: input.intensity,
    tempC: input.tempC,
    indoor: input.indoor,
    rideType: input.rideType,
    foodIds: input.foodIds,
    plan,
    intensitySource: plan.intensity.source,
  });
}

export async function updateRide(userId, rideId, patch) {
  const ride = await getRide(userId, rideId);

  for (const [key, value] of Object.entries(patch)) {
    ride.set(key, value === null ? undefined : value);
  }

  if (PLAN_INPUTS.some((key) => key in patch)) {
    const user = await getUser(userId);
    const plan = await computePlan(user, {
      date: ride.date,
      durationMin: ride.durationMin,
      intensity: ride.intensity.toObject(),
      tempC: ride.tempC,
      indoor: ride.indoor,
      rideType: ride.rideType,
      foodIds: ride.foodIds,
    });
    ride.plan = plan;
    ride.intensitySource = plan.intensity.source;
  }

  if (['intake', 'plainWaterMl', 'durationMin'].some((key) => key in patch)) {
    ride.actual = await computeActual(ride);
  }

  await ride.save();
  return ride;
}

export async function deleteRide(userId, rideId) {
  const ride = await getRide(userId, rideId);
  await ride.deleteOne();
  await CheckIn.deleteMany({ rideId: ride._id, userId }); // a ride's check-in goes with it
}
