import { buildFuelPlan, PROFILE_FIELD_FOR, toCalculatorUser } from '../src/index.js';

describe('toCalculatorUser', () => {
  const profile = {
    weightKg: 75,
    birthYear: 1986,
    sex: 'male',
    ftpW: 250,
    lthr: 165,
    trainedCarbRateGph: 70,
    sweatSodium: 'average',
    email: 'not-needed@example.com',
  };

  test('maps the profile and works out age for the ride year', () => {
    expect(toCalculatorUser(profile, '2026-11-03T08:00:00.000Z')).toEqual({
      weightKg: 75,
      age: 40,
      sex: 'male',
      ftpW: 250,
      lthr: 165,
      maxHr: undefined,
      trainedCarbRateGph: 70,
      sweatRateMlPerHr: undefined,
      sweatSodium: 'average',
    });
    expect(toCalculatorUser(profile, new Date('2030-06-01')).age).toBe(44);
  });

  test('null optional fields (cleared in the profile) become undefined', () => {
    const user = toCalculatorUser({ ...profile, ftpW: null, birthYear: null }, '2026-11-03');
    expect(user.ftpW).toBeUndefined();
    expect(user.age).toBeUndefined();
  });

  test('output plugs straight into buildFuelPlan (spec T1)', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22 },
      user: toCalculatorUser(profile, '2026-11-03'),
      foods: [],
    });
    expect(plan.targets).toEqual({ carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300 });
  });

  test('PROFILE_FIELD_FOR points the calculator’s "age" at the profile’s birth year', () => {
    expect(PROFILE_FIELD_FOR.age).toBe('birthYear');
    expect(PROFILE_FIELD_FOR.weightKg).toBe('weightKg');
  });
});
