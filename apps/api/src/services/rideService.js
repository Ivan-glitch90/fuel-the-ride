import { buildFuelPlan, findSimilarRides, summarizeIntake, toCalculatorUser } from '@fuel-ride/fuel-core';
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

/** How long the ride really took: what the rider logged, else the plan's time. */
export const rideMinutes = (ride) => ride.actualDurationMin ?? ride.durationMin;

/**
 * The plan's per-hour targets for the time actually ridden (FUELING_RULES.md §9.0), so the
 * comparison is fair when a ride ends shorter or longer than planned. Same effort: a kJ plan
 * (a total for the planned time) is turned into its average power first.
 */
async function targetsForActualTime(ride) {
  const minutes = rideMinutes(ride);
  if (minutes === ride.durationMin || !ride.plan?.targets) return ride.plan?.targets ?? null;
  const user = await getUser(ride.userId);
  const intensity = ride.intensity.toObject();
  const sameEffort =
    intensity.workKj !== undefined && ride.plan.intensity?.avgPowerW
      ? { avgPowerW: Math.round(ride.plan.intensity.avgPowerW) }
      : intensity;
  return withFuelErrors(
    () =>
      buildFuelPlan({
        ride: { durationMin: minutes, intensity: sameEffort, tempC: ride.tempC, indoor: ride.indoor, rideType: ride.rideType },
        user: toCalculatorUser(user, ride.date),
        foods: [],
      }).targets,
  );
}

/**
 * Totals and per-hour rates for what the rider logged, over the time actually ridden, plus the
 * targets to compare with. A finished ride always gets one (nothing logged = zeros), so the app
 * can say "you didn't log any carbs" instead of showing nothing.
 */
async function computeActual(ride) {
  if (ride.intake.length === 0 && !ride.plainWaterMl && ride.status !== 'completed') return null;
  const foodIds = ride.intake.map((i) => String(i.foodId));
  const foods = await loadFoods(ride.userId, foodIds, 'intake');
  const durationMin = rideMinutes(ride);
  const summary = withFuelErrors(() =>
    summarizeIntake({
      intake: ride.intake.map((i) => ({ foodId: String(i.foodId), servings: i.servings })),
      plainWaterMl: ride.plainWaterMl,
      foods,
      durationMin,
    }),
  );
  return { ...summary, durationMin, targets: await targetsForActualTime(ride) };
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
  const startTime = input.imported?.startTime;
  if (startTime && (await Ride.exists({ userId, 'imported.startTime': startTime }))) {
    throw new HttpError(409, 'RIDE_ALREADY_IMPORTED', 'This ride was already imported');
  }
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
    status: input.status,
    imported: input.imported,
  });
}

/**
 * Past rides like the one being planned (FUELING_RULES.md §9B), with what was eaten per hour
 * spelled out by food name. Archived rides count: they're hidden from Home, not forgotten.
 */
export async function similarRides(userId, target) {
  const rides = await Ride.find({ userId, actual: { $ne: null } })
    .sort({ date: -1 })
    .limit(200)
    .select('date name durationMin plan.kcalBurned actual intake');
  const checkIns = await CheckIn.find({ userId, rideId: { $in: rides.map((r) => r._id) } }).select(
    'rideId giScore energyScore bonked',
  );
  const checkInFor = new Map(checkIns.map((c) => [String(c.rideId), c]));
  const matches = findSimilarRides(
    target,
    rides.map((r) => ({
      id: String(r._id),
      date: r.date.toISOString(),
      name: r.name,
      durationMin: r.durationMin,
      kcalBurned: r.plan?.kcalBurned,
      actual: r.actual,
      intake: r.intake.map((i) => ({ foodId: String(i.foodId), servings: i.servings })),
      checkIn: checkInFor.get(String(r._id)) ?? null,
    })),
  );

  // Food names (archived foods included: an old ride may use them)
  const foodIds = [...new Set(matches.flatMap((m) => m.perHour.map((p) => p.foodId)))];
  const foods = await Food.find({ userId, _id: { $in: foodIds } }).select('name archived');
  const foodById = new Map(foods.map((f) => [String(f._id), f]));
  return matches.map((m) => ({
    ...m,
    perHour: m.perHour
      .filter((p) => foodById.has(p.foodId))
      .map((p) => ({ ...p, name: foodById.get(p.foodId).name, archived: foodById.get(p.foodId).archived })),
  }));
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

  // What was eaten, how long it took, or the plan changed → recompute the per-hour actuals and targets
  if (['intake', 'plainWaterMl', 'durationMin', 'actualDurationMin', 'status'].some((key) => key in patch) || (ride.actual && PLAN_INPUTS.some((key) => key in patch))) {
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
