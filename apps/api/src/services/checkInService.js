import { suggestAdjustments } from '@fuel-ride/fuel-core';
import { CheckIn, Ride } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { withFuelErrors } from './fuelErrors.js';
import { getRide } from './rideService.js';
import { getUser } from './userService.js';

const HISTORY_SIZE = 10;
const ANSWER_FIELDS = ['giScore', 'energyScore', 'legsScore', 'bonked', 'cramped'];

const notFound = () => new HttpError(404, 'CHECKIN_NOT_FOUND', 'Check-in not found');

/**
 * Earlier check-ins (by ride date), newest first, in the shape suggestAdjustments expects.
 * Reads each ride's current `actual`, so intake logged after a check-in still counts.
 */
async function loadHistory(userId, ride) {
  const previous = await CheckIn.find({ userId, rideId: { $ne: ride._id }, rideDate: { $lt: ride.date } })
    .sort({ rideDate: -1 })
    .limit(HISTORY_SIZE);
  const rides = await Ride.find({ userId, _id: { $in: previous.map((c) => c.rideId) } });
  const rideById = new Map(rides.map((r) => [String(r._id), r]));

  return previous
    .map((checkIn) => {
      const r = rideById.get(String(checkIn.rideId));
      return (
        r && {
          date: r.date.toISOString(),
          durationMin: r.durationMin,
          actualGph: r.actual?.carbsGph ?? 0,
          giScore: checkIn.giScore,
        }
      );
    })
    .filter(Boolean);
}

async function computeSuggestions({ userId, ride, answers, trainedGph }) {
  const user = await getUser(userId);
  const history = await loadHistory(userId, ride);
  return withFuelErrors(() =>
    suggestAdjustments({
      trainedGph,
      checkIn: {
        date: ride.date.toISOString(),
        durationMin: ride.durationMin,
        ...answers,
        targets: ride.plan.targets,
        actual: ride.actual ?? {}, // nothing logged → the ride didn't test the rate
        weightPreKg: ride.weightPreKg,
        weightPostKg: ride.weightPostKg,
      },
      history,
      lastIncreaseDate: user.lastCarbRateIncreaseAt?.toISOString() ?? null,
    }),
  );
}

const pickAnswers = (source) => Object.fromEntries(ANSWER_FIELDS.map((key) => [key, source[key]]));

export async function listCheckIns(userId, { rideId, limit = 20 } = {}) {
  const filter = { userId };
  if (rideId) filter.rideId = rideId;
  return CheckIn.find(filter).sort({ rideDate: -1 }).limit(limit);
}

export async function getCheckIn(userId, checkInId) {
  const checkIn = await CheckIn.findOne({ _id: checkInId, userId });
  if (!checkIn) throw notFound();
  return checkIn;
}

/** Saves the check-in, computes suggestions and marks the ride completed. */
export async function createCheckIn(userId, { rideId, notes, ...answers }) {
  const ride = await getRide(userId, rideId);
  if (await CheckIn.exists({ rideId: ride._id })) {
    throw new HttpError(409, 'CHECKIN_EXISTS', 'This ride already has a check-in. Edit it instead.');
  }
  const user = await getUser(userId);
  const suggestions = await computeSuggestions({ userId, ride, answers, trainedGph: user.trainedCarbRateGph });

  const checkIn = await CheckIn.create({
    userId,
    rideId: ride._id,
    rideDate: ride.date,
    ...answers,
    notes,
    trainedGphAtCheckIn: user.trainedCarbRateGph,
    suggestions,
  });

  if (ride.status !== 'completed') {
    ride.status = 'completed';
    await ride.save();
  }
  return checkIn;
}

/** Updates answers and recomputes suggestions against the trained rate at the time of the check-in. */
export async function updateCheckIn(userId, checkInId, patch) {
  const checkIn = await getCheckIn(userId, checkInId);
  for (const [key, value] of Object.entries(patch)) {
    checkIn.set(key, value === null ? undefined : value);
  }
  if (ANSWER_FIELDS.some((key) => key in patch)) {
    const ride = await getRide(userId, checkIn.rideId);
    checkIn.suggestions = await computeSuggestions({
      userId,
      ride,
      answers: pickAnswers(checkIn),
      trainedGph: checkIn.trainedGphAtCheckIn,
    });
  }
  await checkIn.save();
  return checkIn;
}

export async function deleteCheckIn(userId, checkInId) {
  const checkIn = await getCheckIn(userId, checkInId);
  await checkIn.deleteOne();
}
