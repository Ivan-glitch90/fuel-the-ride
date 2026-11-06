import mongoose from 'mongoose';
import { Food } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { fluidRuleIssues } from '../validators/foods.js';

const notFound = () => new HttpError(404, 'FOOD_NOT_FOUND', 'Food not found');

export async function listFoods(userId, { archived = 'false', favorite } = {}) {
  const filter = { userId };
  if (archived !== 'all') filter.archived = archived === 'true';
  if (favorite !== undefined) filter.favorite = favorite === 'true';
  return Food.find(filter).sort({ favorite: -1, name: 1 }).collation({ locale: 'en', strength: 2 });
}

/** Always scoped to the owner: another user's food looks exactly like a missing one. */
export async function getFood(userId, foodId) {
  const food = await Food.findOne({ _id: foodId, userId });
  if (!food) throw notFound();
  return food;
}

export async function createFood(userId, data) {
  return Food.create({ ...data, userId });
}

export async function updateFood(userId, foodId, patch) {
  const food = await getFood(userId, foodId);
  const issues = fluidRuleIssues({ type: patch.type ?? food.type, fluidMl: patch.fluidMl ?? food.fluidMl });
  if (issues.length > 0) throw new HttpError(400, 'VALIDATION_FAILED', 'Some fields are invalid', issues);

  for (const [key, value] of Object.entries(patch)) {
    food.set(key, value === null ? undefined : value);
  }
  await food.save();
  return food;
}

// Rides store food ids in their intake log and their plan snapshot.
// Queried on the raw collection so this works before (and independently of) the Ride model.
async function isUsedInRides(userId, foodId) {
  const ids = { $in: [foodId, String(foodId)] };
  const ride = await mongoose.connection
    .collection('rides')
    .findOne({ userId, $or: [{ 'intake.foodId': ids }, { 'plan.schedule.items.foodId': ids }] }, { projection: { _id: 1 } });
  return ride !== null;
}

/**
 * Deletes a food, or archives it if any ride used it (so past rides still display correctly).
 * @returns {{ archived: boolean, food?: Food }}
 */
export async function deleteFood(userId, foodId) {
  const food = await getFood(userId, foodId);
  if (await isUsedInRides(food.userId, food._id)) {
    food.archived = true;
    await food.save();
    return { archived: true, food };
  }
  await food.deleteOne();
  return { archived: false };
}
