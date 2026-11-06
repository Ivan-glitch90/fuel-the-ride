// Turns a stored rider profile into calculator input. Shared by the API (when saving a ride),
// the web app (live preview) and the future mobile app, so all three compute the same plan.

/**
 * @param {object} profile  user profile as stored/returned by the API
 * @param {Date|string} rideDate  age is worked out for the year of the ride
 */
export function toCalculatorUser(profile, rideDate) {
  const year = new Date(rideDate).getUTCFullYear();
  return {
    weightKg: profile.weightKg ?? undefined,
    age: profile.birthYear ? year - profile.birthYear : undefined,
    sex: profile.sex,
    ftpW: profile.ftpW ?? undefined,
    lthr: profile.lthr ?? undefined,
    maxHr: profile.maxHr ?? undefined,
    trainedCarbRateGph: profile.trainedCarbRateGph ?? undefined,
    sweatRateMlPerHr: profile.sweatRateMlPerHr ?? undefined,
    sweatSodium: profile.sweatSodium ?? undefined,
  };
}

/**
 * Which profile field to fill in when the calculator rejects a value (FuelInputError.field).
 * e.g. the calculator needs `age`, the rider sets their `birthYear`.
 */
export const PROFILE_FIELD_FOR = {
  weightKg: 'weightKg',
  age: 'birthYear',
  ftpW: 'ftpW',
  lthr: 'lthr',
  maxHr: 'maxHr',
  trainedCarbRateGph: 'trainedCarbRateGph',
  sweatRateMlPerHr: 'sweatRateMlPerHr',
  sweatSodium: 'sweatSodium',
};
