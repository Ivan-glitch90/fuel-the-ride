import mongoose from 'mongoose';
import { buildFuelPlan, summarizeIntake } from '@fuel-ride/fuel-core';
import { Food, Ride } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { getUser } from './userService.js';

const PLAN_INPUTS = ['durationMin', 'intensity', 'tempC', 'foodIds'];
const INTENSITY_FIELDS = ['workKj', 'avgPowerW', 'normalizedPowerW', 'avgHr', 'powerZone', 'hrZone'];
// fuel-core field → profile field the rider needs to fill in
const PROFILE_FIELDS = {
  weightKg: 'weightKg',
  age: 'birthYear',
  ftpW: 'ftpW',
  lthr: 'lthr',
  maxHr: 'maxHr',
  trainedCarbRateGph: 'trainedCarbRateGph',
  sweatRateMlPerHr: 'sweatRateMlPerHr',
  sweatSodium: 'sweatSodium',
};

const notFound = () => new HttpError(404, 'RIDE_NOT_FOUND', 'Ride not found');

/** The rider's profile in the shape fuel-core expects. Age is worked out for the ride's date. */
function toFuelUser(user, date) {
  return {
    weightKg: user.weightKg,
    age: user.birthYear ? date.getUTCFullYear() - user.birthYear : undefined,
    sex: user.sex,
    ftpW: user.ftpW,
    lthr: user.lthr,
    maxHr: user.maxHr,
    trainedCarbRateGph: user.trainedCarbRateGph,
    sweatRateMlPerHr: user.sweatRateMlPerHr,
    sweatSodium: user.sweatSodium,
  };
}

/** Turns fuel-core's FuelInputError into an API error that points at the right field. */
function translateFuelError(err) {
  if (err?.name !== 'FuelInputError') return err;
  if (PROFILE_FIELDS[err.field]) {
    const path = `profile.${PROFILE_FIELDS[err.field]}`;
    return new HttpError(400, 'PROFILE_INCOMPLETE', 'Complete your profile to plan this ride', [
      { path, message: err.message },
    ]);
  }
  const path = INTENSITY_FIELDS.includes(err.field) ? `intensity.${err.field}` : err.field;
  return new HttpError(400, 'VALIDATION_FAILED', 'Some fields are invalid', [{ path, message: err.message }]);
}

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

async function computePlan(user, { date, durationMin, intensity, tempC, foodIds }) {
  if (!user.weightKg) {
    throw new HttpError(400, 'PROFILE_INCOMPLETE', 'Complete your profile to plan this ride', [
      { path: 'profile.weightKg', message: 'Add your weight' },
    ]);
  }
  const foods = await loadFoods(user._id, foodIds.map(String), 'foodIds');
  try {
    return buildFuelPlan({ ride: { durationMin, intensity, tempC }, user: toFuelUser(user, date), foods });
  } catch (err) {
    throw translateFuelError(err);
  }
}

async function computeActual(ride) {
  if (ride.intake.length === 0 && !ride.plainWaterMl) return null;
  const foodIds = ride.intake.map((i) => String(i.foodId));
  const foods = await loadFoods(ride.userId, foodIds, 'intake');
  try {
    return summarizeIntake({
      intake: ride.intake.map((i) => ({ foodId: String(i.foodId), servings: i.servings })),
      plainWaterMl: ride.plainWaterMl,
      foods,
      durationMin: ride.durationMin,
    });
  } catch (err) {
    throw translateFuelError(err);
  }
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
  // A ride's check-in goes with it (raw collection: works before the CheckIn model exists)
  await mongoose.connection.collection('checkIns').deleteMany({ rideId: ride._id });
}
