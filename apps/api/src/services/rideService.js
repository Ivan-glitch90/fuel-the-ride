import { buildFuelPlan, summarizeIntake, toCalculatorUser } from '@fuel-ride/fuel-core';
import { CheckIn, Food, Ride } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { getUser } from './userService.js';
import { withFuelErrors } from './fuelErrors.js';

const PLAN_INPUTS = ['durationMin', 'intensity', 'tempC', 'indoor', 'rideType', 'foodIds', 'foodsAuto'];

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

/** The rider's whole active library, for the app to pick from (FUELING_RULES.md §7.0). */
export async function loadLibrary(userId) {
  const docs = await Food.find({ userId, archived: false });
  return docs.map((d) => d.toJSON());
}

async function computePlan(user, { date, durationMin, intensity, tempC, indoor, rideType, foodIds, foodsAuto }) {
  if (!user.weightKg) {
    throw new HttpError(400, 'PROFILE_INCOMPLETE', 'Complete your profile to plan this ride', [
      { path: 'profile.weightKg', message: 'Add your weight' },
    ]);
  }
  const foods = foodsAuto ? await loadLibrary(user._id) : await loadFoods(user._id, foodIds.map(String), 'foodIds');
  return withFuelErrors(() =>
    // Same profile → calculator mapping and food selection the web app uses for its live preview
    buildFuelPlan({
      ride: { durationMin, intensity, tempC, indoor, rideType },
      user: toCalculatorUser(user, date),
      foods,
      autoSelectFoods: foodsAuto,
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

/** archived: 'false' (default, the lists riders see) | 'true' | 'all'. Progress ignores this on purpose. */
export async function listRides(userId, { from, to, status, archived = 'false', limit = 20 } = {}) {
  const filter = { userId };
  if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  if (status) filter.status = status;
  // $ne: rides saved before archiving existed have no field and count as not archived
  if (archived !== 'all') filter.archived = archived === 'true' ? true : { $ne: true };
  return Ride.find(filter).sort({ date: -1, _id: -1 }).limit(limit);
}

/** No `foodIds` → the app picks the foods from the library; `foodIds` → exactly the rider's picks. */
export async function createRide(userId, input) {
  const user = await getUser(userId);
  const foodsAuto = input.foodIds === undefined;
  const plan = await computePlan(user, { ...input, foodsAuto });
  return Ride.create({
    userId,
    name: input.name,
    date: input.date,
    durationMin: input.durationMin,
    intensity: input.intensity,
    tempC: input.tempC,
    indoor: input.indoor,
    rideType: input.rideType,
    foodsAuto,
    foodIds: plan.foodSelection.foodIds,
    plan,
    intensitySource: plan.intensity.source,
    ftpAtRideW: user.ftpW,
  });
}

export async function updateRide(userId, rideId, patch) {
  const ride = await getRide(userId, rideId);

  for (const [key, value] of Object.entries(patch)) {
    ride.set(key, value === null ? undefined : value);
  }
  if ('foodIds' in patch) ride.foodsAuto = false; // the rider chose their own foods

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
      foodsAuto: ride.foodsAuto,
    });
    ride.plan = plan;
    ride.foodIds = plan.foodSelection.foodIds; // app-picked rides re-pick from the current library
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
