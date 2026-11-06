import { HttpError } from '../utils/httpError.js';

const INTENSITY_FIELDS = ['workKj', 'avgPowerW', 'normalizedPowerW', 'avgHr', 'powerZone', 'hrZone'];

// fuel-core field → the profile field the rider needs to fill in
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

/** Turns fuel-core's FuelInputError into an API error that points at the right field. Other errors pass through. */
export function translateFuelError(err) {
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

/** Runs a fuel-core call and translates its input errors. */
export function withFuelErrors(fn) {
  try {
    return fn();
  } catch (err) {
    throw translateFuelError(err);
  }
}
