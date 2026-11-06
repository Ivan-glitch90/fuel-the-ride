// Indoor rides and ride types: docs/FUELING_RULES.md §4.1, §5.1 and examples T6–T8.
import { buildFuelPlan, FuelInputError, targetCarbRate, targetHydration } from '../src/index.js';

const riderA = { weightKg: 75, age: 40, sex: 'male', ftpW: 250, lthr: 165, trainedCarbRateGph: 70, sweatSodium: 'average' };
const t1 = (extra = {}) => ({ durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22, ...extra });
const codes = (plan) => plan.notes.map((n) => n.code);

describe('indoor rides (§5.1)', () => {
  test('T6: T1 indoors with no temperature → 22 °C room, +150 ml/hr fluid, sodium follows', () => {
    const plan = buildFuelPlan({ ride: t1({ tempC: undefined, indoor: true }), user: riderA });
    expect(plan.tempC).toBe(22);
    expect(plan.indoor).toBe(true);
    expect(plan.targets).toEqual({ carbsGph: 60, fluidMlPerHr: 750, sodiumMgPerHr: 380 }); // 0.75 L × 500 = 375 → 380
    expect(codes(plan)).toContain('INDOOR');
  });

  test('indoors with a room temperature uses it, still +150', () => {
    const plan = buildFuelPlan({ ride: t1({ tempC: 28, indoor: true }), user: riderA });
    expect(plan.targets.fluidMlPerHr).toBe(900); // 750 + 150
  });

  test('indoor extra also applies on top of a measured sweat rate, then clamps', () => {
    const h = targetHydration({
      durationMin: 120,
      tempC: 22,
      level: 'moderate',
      user: { ...riderA, sweatRateMlPerHr: 1000 },
      indoor: true,
    });
    expect(h.fluidMlPerHr).toBe(850); // 0.7 × 1000 + 150
    const hot = targetHydration({ durationMin: 120, tempC: 32, level: 'hard', user: riderA, indoor: true });
    expect(hot.fluidMlPerHr).toBe(1000); // 900 + 100 + 150 → clamped
  });

  test('outdoor rides are unchanged (default)', () => {
    const plan = buildFuelPlan({ ride: t1(), user: riderA });
    expect(plan.indoor).toBe(false);
    expect(plan.targets).toEqual({ carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300 });
    expect(codes(plan)).not.toContain('INDOOR');
  });
});

describe('ride types (§4.1)', () => {
  test('T7: T1 as a race → moderate reads the hard column (75), capped by trained 70', () => {
    const plan = buildFuelPlan({ ride: t1({ rideType: 'race' }), user: riderA });
    expect(plan.rideType).toBe('race');
    expect(plan.targets.carbsGph).toBe(70);
    expect(codes(plan)).toEqual(expect.arrayContaining(['RACE_DAY', 'CAPPED_BY_TRAINED_RATE']));
  });

  test('race bumps easy → moderate, and hard stays hard', () => {
    expect(targetCarbRate({ durationMin: 120, level: 'easy', trainedGph: 120, rideType: 'race' }).carbsGph).toBe(60);
    expect(targetCarbRate({ durationMin: 120, level: 'easy', trainedGph: 120 }).carbsGph).toBe(40);
    expect(targetCarbRate({ durationMin: 200, level: 'hard', trainedGph: 120, rideType: 'race' }).carbsGph).toBe(90);
  });

  test('T8: group ride keeps the numbers and adds the surges note', () => {
    const plan = buildFuelPlan({ ride: t1({ rideType: 'group' }), user: riderA });
    expect(plan.targets).toEqual({ carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300 });
    expect(codes(plan)).toContain('GROUP_RIDE');
  });

  test('training is the default', () => {
    expect(buildFuelPlan({ ride: t1(), user: riderA }).rideType).toBe('training');
  });

  test('unknown ride type or non-boolean indoor → FuelInputError', () => {
    expect(() => buildFuelPlan({ ride: t1({ rideType: 'crit' }), user: riderA })).toThrow(FuelInputError);
    expect(() => buildFuelPlan({ ride: t1({ indoor: 'yes' }), user: riderA })).toThrow(FuelInputError);
  });
});
