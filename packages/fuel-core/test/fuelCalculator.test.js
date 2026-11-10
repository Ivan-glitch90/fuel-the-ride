// Tests mirror docs/FUELING_RULES.md §8 (worked examples) and §9 (suggestions).
import {
  resolveIntensity,
  estimateKcalBurned,
  targetCarbRate,
  targetHydration,
  buildFuelPlan,
  summarizeIntake,
  estimateSweatRate,
  suggestAdjustments,
  intakeStatus,
  FuelInputError,
} from '../src/index.js';

// kcal is compared with ±1% tolerance (§1)
const expectWithin1Pct = (actual, expected) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(expected * 0.01);
};

// Rider A (§8)
const riderA = {
  weightKg: 75,
  age: 40,
  sex: 'male',
  ftpW: 250,
  lthr: 165,
  trainedCarbRateGph: 70,
  sweatSodium: 'average',
};

// Rider B (§8)
const riderB = {
  weightKg: 60,
  age: 30,
  sex: 'female',
  trainedCarbRateGph: 50,
  sweatSodium: 'salty',
  sweatRateMlPerHr: 1000,
};

// Example food library (§8)
const oatBar = { id: 'bar', name: 'Oat bar', type: 'bar', carbsG: 44, kcal: 250, sodiumMg: 150, fluidMl: 0 };
const gel = { id: 'gel', name: 'Energy gel', type: 'gel', carbsG: 22, kcal: 100, sodiumMg: 50, fluidMl: 0 };
const electrolyteDrink = {
  id: 'drink',
  name: 'Electrolyte drink',
  type: 'drink',
  carbsG: 15,
  kcal: 60,
  sodiumMg: 400,
  fluidMl: 500,
};
const library = [oatBar, gel, electrolyteDrink];

describe('target cases (§8 T1–T5)', () => {
  test('T1: 120 min, avg 175 W, 22 °C', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22 },
      user: riderA,
      foods: [],
    });
    expect(plan.intensity.source).toBe('power');
    expect(plan.intensity.intensityFactor).toBeCloseTo(0.7, 3);
    expect(plan.intensity.level).toBe('moderate');
    expect(plan.intensity.confidence).toBe('high');
    expectWithin1Pct(plan.kcalBurned, 1260);
    expect(plan.targets).toEqual({ carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300 });
  });

  test('T2: 210 min, 2,275 kJ, 30 °C, carbs capped by trained rate', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 210, intensity: { workKj: 2275 }, tempC: 30 },
      user: riderA,
      foods: [],
    });
    expect(plan.intensity.source).toBe('kj');
    expect(plan.intensity.avgPowerW).toBeCloseTo(180.6, 1);
    expect(plan.intensity.intensityFactor).toBeCloseTo(0.722, 3);
    expect(plan.intensity.level).toBe('moderate');
    expectWithin1Pct(plan.kcalBurned, 2275);
    expect(plan.targets).toEqual({ carbsGph: 70, fluidMlPerHr: 900, sodiumMgPerHr: 450 });
    expect(plan.notes.map((n) => n.code)).toContain('CAPPED_BY_TRAINED_RATE');
    expect(plan.targetTotals).toEqual({ carbsG: 245, fluidMl: 3150, sodiumMg: 1575 });
  });

  test('T2: final 30-min block gets half the hourly targets', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 210, intensity: { workKj: 2275 }, tempC: 30 },
      user: riderA,
      foods: library,
    });
    expect(plan.schedule).toHaveLength(4);
    const last = plan.schedule[3];
    expect(last.minutes).toBe(30);
    expect(last.targets).toEqual({ carbsG: 35, fluidMl: 450, sodiumMg: 225 });
  });

  test('T3: 90 min, avg HR 145, 18 °C (HR → IF, kcal from FTP)', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 90, intensity: { avgHr: 145 }, tempC: 18 },
      user: riderA,
      foods: [],
    });
    expect(plan.intensity.source).toBe('hr');
    expect(plan.intensity.intensityFactor).toBeCloseTo(0.73, 2);
    expect(plan.intensity.level).toBe('moderate');
    expect(plan.intensity.confidence).toBe('medium');
    expect(plan.intensity.kcalMethod).toBe('ftp');
    expectWithin1Pct(plan.kcalBurned, 985);
    expect(plan.targets).toEqual({ carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300 });
  });

  test('T4: 45 min, power zone 2, 10 °C (sodium optional)', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 45, intensity: { powerZone: 2 }, tempC: 10 },
      user: riderA,
      foods: [],
    });
    expect(plan.intensity.source).toBe('power-zone');
    expect(plan.intensity.intensityFactor).toBeCloseTo(0.65, 3);
    expect(plan.intensity.level).toBe('moderate');
    expectWithin1Pct(plan.kcalBurned, 439);
    expect(plan.targets).toEqual({ carbsGph: 0, fluidMlPerHr: 400, sodiumMgPerHr: 0 });
    expect(plan.notes.map((n) => n.code)).toContain('SODIUM_OPTIONAL');
  });

  test('T5: rider B, 180 min, HR zone 2, 20 °C (Keytel, estimated LTHR)', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 180, intensity: { hrZone: 2 }, tempC: 20 },
      user: riderB,
      foods: [],
    });
    expect(plan.intensity.source).toBe('hr-zone');
    expect(plan.intensity.lthr).toBeCloseTo(168.3, 1);
    expect(plan.intensity.avgHr).toBeCloseTo(143.1, 1);
    expect(plan.intensity.intensityFactor).toBeCloseTo(0.65, 3);
    expect(plan.intensity.kcalMethod).toBe('keytel');
    expect(plan.intensity.confidence).toBe('low');
    expectWithin1Pct(plan.kcalBurned, 1644);
    expect(plan.targets).toEqual({ carbsGph: 50, fluidMlPerHr: 700, sodiumMgPerHr: 560 });
  });
});

describe('schedule cases (§8 S1–S2)', () => {
  const t1Ride = { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22 };

  test('S1: drink + water + 1 oat bar each hour', () => {
    const plan = buildFuelPlan({ ride: t1Ride, user: riderA, foods: library });
    expect(plan.schedule).toHaveLength(2);
    for (const block of plan.schedule) {
      expect(block.items.map(({ foodId, servings }) => ({ foodId, servings }))).toEqual([
        { foodId: 'drink', servings: 1 },
        { foodId: 'bar', servings: 1 },
      ]);
      expect(block.plainWaterMl).toBe(100);
      expect(block.carbsG).toBe(59);
      expect(block.fluidMl).toBe(600);
      expect(block.sodiumMg).toBe(550);
      expect(block.kcal).toBe(310);
      expect(block.note).toMatch(/Spread across the hour/);
      expect(block.warnings).toEqual([]);
    }
    expect(plan.totals).toEqual({ carbsG: 118, fluidMl: 1200, sodiumMg: 1100, kcal: 620 });
  });

  test('S2: gels only → 3 gels + plain water, sodium short warning', () => {
    const plan = buildFuelPlan({ ride: t1Ride, user: riderA, foods: [gel] });
    const block = plan.schedule[0];
    expect(block.items).toEqual([expect.objectContaining({ foodId: 'gel', servings: 3 })]);
    expect(block.plainWaterMl).toBe(600);
    expect(block.carbsG).toBe(66);
    const sodiumWarning = block.warnings.find((w) => w.code === 'SODIUM_SHORT');
    expect(sodiumWarning.message).toMatch(/150 mg\/hr short on sodium/);
    expect(plan.warnings.filter((w) => w.code === 'SODIUM_SHORT')).toHaveLength(1);
  });

  test('electrolyte tabs fill a sodium gap', () => {
    const tab = { id: 'tab', name: 'Salt tab', type: 'electrolyte', carbsG: 0, kcal: 0, sodiumMg: 200, fluidMl: 0 };
    const plan = buildFuelPlan({ ride: t1Ride, user: riderA, foods: [gel, tab] });
    const block = plan.schedule[0];
    expect(block.items).toContainEqual(expect.objectContaining({ foodId: 'tab', servings: 1 }));
    expect(block.sodiumMg).toBe(350);
    expect(block.warnings.find((w) => w.code === 'SODIUM_SHORT')).toBeUndefined();
  });

  test('warns when carbs cannot get within 10 g of the target', () => {
    const banana = { id: 'banana', name: 'Banana', type: 'real', carbsG: 5, kcal: 25, sodiumMg: 0, fluidMl: 0 };
    const plan = buildFuelPlan({ ride: t1Ride, user: riderA, foods: [banana] });
    const warning = plan.schedule[0].warnings.find((w) => w.code === 'CARBS_OFF_TARGET');
    expect(warning.message).toMatch(/Can't hit 60 g/);
  });

  test('never schedules more than 4 food servings per block', () => {
    const plan = buildFuelPlan({ ride: t1Ride, user: { ...riderA, trainedCarbRateGph: 120 }, foods: [gel] });
    for (const block of plan.schedule) {
      const servings = block.items.reduce((sum, i) => sum + i.servings, 0);
      expect(servings).toBeLessThanOrEqual(4);
    }
  });
});

describe('edge cases (§8 E1–E6)', () => {
  test('E1: 130 min ride → final 10-min block gets no fueling', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 130, intensity: { avgPowerW: 175 }, tempC: 22 },
      user: riderA,
      foods: library,
    });
    expect(plan.schedule).toHaveLength(2);
    expect(plan.targetTotals.carbsG).toBe(120);
  });

  test('E2: power zone 6 → validation error', () => {
    expect(() =>
      buildFuelPlan({ ride: { durationMin: 60, intensity: { powerZone: 6 } }, user: riderA, foods: [] }),
    ).toThrow(/whole-ride average/);
  });

  test('E3: no intensity → validation error', () => {
    expect(() => buildFuelPlan({ ride: { durationMin: 60, intensity: {} }, user: riderA, foods: [] })).toThrow(
      FuelInputError,
    );
    expect(() => buildFuelPlan({ ride: { durationMin: 60 }, user: riderA, foods: [] })).toThrow(/Intensity required/);
  });

  test('E4: IF 1.2 on a 120-min ride → plan with "very hard" warning', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 120, intensity: { avgPowerW: 300 } },
      user: riderA,
      foods: [],
    });
    expect(plan.warnings.map((w) => w.code)).toContain('VERY_HARD');
    expect(plan.intensity.level).toBe('hard');
    expect(plan.targets.carbsGph).toBe(70); // [90,150) hard = 75, capped by trained rate 70
  });

  test('E5: empty food library → targets but empty schedule', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 120, intensity: { avgPowerW: 175 } },
      user: riderA,
      foods: [],
    });
    expect(plan.schedule).toEqual([]);
    expect(plan.targets.carbsGph).toBe(60);
    expect(plan.notes.map((n) => n.code)).toContain('NO_FOODS');
  });

  test('E6: measured sweat rate 2,000 ml/hr → fluid clamped to 1,000', () => {
    const hydration = targetHydration({
      durationMin: 120,
      tempC: 20,
      level: 'moderate',
      user: { ...riderA, sweatRateMlPerHr: 2000 },
    });
    expect(hydration.fluidMlPerHr).toBe(1000);
  });
});

describe('validation (§2)', () => {
  const ride = (overrides) => ({ durationMin: 120, intensity: { avgPowerW: 175 }, ...overrides });
  test.each([
    ['duration too short', { durationMin: 10 }],
    ['duration too long', { durationMin: 800 }],
    ['kJ too high', { intensity: { workKj: 20000 } }],
    ['power too high', { intensity: { avgPowerW: 700 } }],
    ['HR too low', { intensity: { avgHr: 40 } }],
    ['HR zone 6', { intensity: { hrZone: 6 } }],
    ['temperature too hot', { tempC: 55 }],
  ])('%s → FuelInputError', (_name, overrides) => {
    expect(() => buildFuelPlan({ ride: ride(overrides), user: riderA, foods: [] })).toThrow(FuelInputError);
  });

  test('weight out of range → FuelInputError', () => {
    expect(() => buildFuelPlan({ ride: ride({}), user: { ...riderA, weightKg: 20 }, foods: [] })).toThrow(
      FuelInputError,
    );
  });

  test('invalid food → FuelInputError', () => {
    expect(() =>
      buildFuelPlan({ ride: ride({}), user: riderA, foods: [{ id: 'x', name: 'X', type: 'pizza', carbsG: 10 }] }),
    ).toThrow(FuelInputError);
  });
});

describe('intensity details (§3)', () => {
  test('kJ outranks power and HR when several inputs are given', () => {
    const r = resolveIntensity({
      durationMin: 120,
      intensity: { workKj: 1200, avgPowerW: 250, avgHr: 170 },
      user: riderA,
    });
    expect(r.source).toBe('kj');
    expectWithin1Pct(r.kcalBurned, 1200);
  });

  test('normalized power only: avg ≈ NP / 1.05, IF from NP', () => {
    const r = resolveIntensity({ durationMin: 60, intensity: { normalizedPowerW: 210 }, user: riderA });
    expect(r.intensityFactor).toBeCloseTo(0.84, 3);
    expectWithin1Pct(r.kcalBurned, 720); // 200 W × 3600 s
  });

  test('missing FTP → estimated at 2.5 W/kg and confidence drops', () => {
    const { ftpW, ...noFtp } = riderA;
    const r = resolveIntensity({ durationMin: 60, intensity: { avgPowerW: 150 }, user: noFtp });
    expect(r.intensityFactor).toBeCloseTo(150 / 187.5, 3);
    expect(r.estimated.ftp).toBe(true);
    expect(r.confidence).toBe('medium');
  });

  test('LTHR from max HR when LTHR is missing', () => {
    const { lthr, ...noLthr } = riderA;
    const r = resolveIntensity({ durationMin: 60, intensity: { hrZone: 3 }, user: { ...noLthr, maxHr: 190 } });
    expect(r.lthr).toBeCloseTo(171, 3);
  });

  test('HR → IF clamps at both ends of the table', () => {
    const low = resolveIntensity({ durationMin: 60, intensity: { avgHr: 100 }, user: riderA });
    const high = resolveIntensity({ durationMin: 60, intensity: { avgHr: 200 }, user: riderA });
    expect(low.intensityFactor).toBeCloseTo(0.45, 3);
    expect(high.intensityFactor).toBeCloseTo(1.1, 3);
  });

  test('estimateKcalBurned matches resolveIntensity', () => {
    const args = { durationMin: 120, intensity: { avgPowerW: 175 }, user: riderA };
    expect(estimateKcalBurned(args)).toBe(resolveIntensity(args).kcalBurned);
  });
});

describe('targetCarbRate (§4)', () => {
  test.each([
    [30, 'hard', 30],
    [59, 'moderate', 0],
    [60, 'easy', 30],
    [90, 'moderate', 60],
    [150, 'hard', 90],
    [240, 'moderate', 80],
  ])('%i min %s → %i g/hr (trained 120)', (durationMin, level, expected) => {
    expect(targetCarbRate({ durationMin, level, trainedGph: 120 }).carbsGph).toBe(expected);
  });

  test('never rounds above the trained rate', () => {
    const r = targetCarbRate({ durationMin: 200, level: 'moderate', trainedGph: 73 });
    expect(r.carbsGph).toBe(70);
    expect(r.cappedByTrained).toBe(true);
  });

  test('mixed-carb tip appears above 60 g/hr', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 180, intensity: { avgPowerW: 175 } },
      user: riderA,
      foods: [],
    });
    expect(plan.targets.carbsGph).toBe(70);
    expect(plan.notes.map((n) => n.code)).toContain('MIXED_CARBS_TIP');
  });
});

describe('targetHydration (§5–6)', () => {
  test.each([
    [10, 'moderate', 400],
    [15, 'moderate', 600],
    [25, 'moderate', 750],
    [30, 'moderate', 900],
    [20, 'easy', 500],
    [30, 'hard', 1000],
    [-10, 'easy', 300],
  ])('%i °C %s → %i ml/hr', (tempC, level, expected) => {
    expect(targetHydration({ durationMin: 120, tempC, level, user: riderA }).fluidMlPerHr).toBe(expected);
  });

  test('sodium clamps to 200 mg/hr minimum', () => {
    const h = targetHydration({ durationMin: 120, tempC: 10, level: 'easy', user: { ...riderA, sweatSodium: 'low' } });
    expect(h.fluidMlPerHr).toBe(300);
    expect(h.sodiumMgPerHr).toBe(200); // 0.3 L × 300 = 90 → clamped
  });

  test('missing temperature defaults to 20 °C', () => {
    expect(targetHydration({ durationMin: 120, level: 'moderate', user: riderA }).fluidMlPerHr).toBe(600);
  });
});

describe('summarizeIntake', () => {
  test('totals and per-hour rates', () => {
    const s = summarizeIntake({
      intake: [
        { foodId: 'bar', servings: 2 },
        { foodId: 'drink', servings: 2 },
      ],
      plainWaterMl: 200,
      foods: library,
      durationMin: 120,
    });
    expect(s).toEqual({
      carbsG: 118,
      kcal: 620,
      fluidMl: 1200,
      sodiumMg: 1100,
      carbsGph: 59,
      fluidMlPerHr: 600,
      sodiumMgPerHr: 550,
    });
  });

  test('unknown food → FuelInputError', () => {
    expect(() =>
      summarizeIntake({ intake: [{ foodId: 'nope', servings: 1 }], foods: library, durationMin: 60 }),
    ).toThrow(FuelInputError);
  });
});

describe('estimateSweatRate (§9.3)', () => {
  test('H1 numbers: 75.0 → 73.2 kg, 1,200 ml, 120 min → 1,500 ml/hr', () => {
    expect(estimateSweatRate({ weightPreKg: 75, weightPostKg: 73.2, fluidMl: 1200, durationMin: 120 })).toBe(1500);
  });

  test('rides under 60 min → null', () => {
    expect(estimateSweatRate({ weightPreKg: 75, weightPostKg: 74.5, fluidMl: 300, durationMin: 45 })).toBeNull();
  });

  test('missing weigh-in → null', () => {
    expect(estimateSweatRate({ weightPreKg: 75, fluidMl: 300, durationMin: 90 })).toBeNull();
  });

  test('clamped to 200–2,500 ml/hr', () => {
    expect(estimateSweatRate({ weightPreKg: 75, weightPostKg: 70, fluidMl: 2000, durationMin: 60 })).toBe(2500);
  });
});

describe('suggestAdjustments: gut training (§9.1)', () => {
  const baseCheckIn = (overrides = {}) => ({
    date: '2026-11-06',
    durationMin: 120,
    giScore: 4,
    energyScore: 4,
    legsScore: 4,
    bonked: false,
    cramped: false,
    targets: { carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300 },
    actual: { carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300 },
    ...overrides,
  });

  test('G1: trained 60, stomach 4/5/4, last increase 10 days ago → 65', () => {
    const r = suggestAdjustments({
      trainedGph: 60,
      checkIn: baseCheckIn({ giScore: 4, actual: { carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300 } }),
      history: [
        { date: '2026-11-03', durationMin: 120, actualGph: 62, giScore: 5 },
        { date: '2026-11-01', durationMin: 150, actualGph: 58, giScore: 4 },
      ],
      lastIncreaseDate: '2026-10-27',
    });
    expect(r.carbRate.suggestedGph).toBe(65);
    expect(r.carbRate.change).toBe(5);
  });

  test('G2: trained 50, stomach 5/5/4 → +10 → 60', () => {
    const r = suggestAdjustments({
      trainedGph: 50,
      checkIn: baseCheckIn({ giScore: 5, actual: { carbsGph: 50, fluidMlPerHr: 600, sodiumMgPerHr: 300 } }),
      history: [
        { date: '2026-11-03', durationMin: 120, actualGph: 50, giScore: 5 },
        { date: '2026-11-01', durationMin: 120, actualGph: 48, giScore: 4 },
      ],
    });
    expect(r.carbRate.suggestedGph).toBe(60);
  });

  test('G3: trained 70, ate 68, stomach 2 → −10 → 60', () => {
    const r = suggestAdjustments({
      trainedGph: 70,
      checkIn: baseCheckIn({ giScore: 2, actual: { carbsGph: 68, fluidMlPerHr: 600, sodiumMgPerHr: 300 } }),
      history: [],
    });
    expect(r.carbRate.suggestedGph).toBe(60);
    expect(r.carbRate.change).toBe(-10);
  });

  test('G4: trained 70, ate 40 (not qualifying), energy 2 → no change, eat-more', () => {
    const r = suggestAdjustments({
      trainedGph: 70,
      checkIn: baseCheckIn({
        giScore: 5,
        energyScore: 2,
        targets: { carbsGph: 70, fluidMlPerHr: 600, sodiumMgPerHr: 300 },
        actual: { carbsGph: 40, fluidMlPerHr: 600, sodiumMgPerHr: 300 },
      }),
      history: [
        { date: '2026-11-03', durationMin: 120, actualGph: 70, giScore: 5 },
        { date: '2026-11-01', durationMin: 120, actualGph: 70, giScore: 5 },
        { date: '2026-10-30', durationMin: 120, actualGph: 70, giScore: 5 },
      ],
    });
    expect(r.carbRate.suggestedGph).toBeNull();
    expect(r.flags.map((f) => f.code)).toContain('eat-more');
  });

  test('G5: same as G1 but last increase 3 days ago → no change', () => {
    const r = suggestAdjustments({
      trainedGph: 60,
      checkIn: baseCheckIn({ giScore: 4 }),
      history: [
        { date: '2026-11-03', durationMin: 120, actualGph: 62, giScore: 5 },
        { date: '2026-11-01', durationMin: 150, actualGph: 58, giScore: 4 },
      ],
      lastIncreaseDate: '2026-11-03',
    });
    expect(r.carbRate.suggestedGph).toBeNull();
    expect(r.carbRate.reason).toMatch(/7 days/);
  });

  test('short rides never change the rate', () => {
    const r = suggestAdjustments({
      trainedGph: 70,
      checkIn: baseCheckIn({ durationMin: 60, giScore: 1, actual: { carbsGph: 70, fluidMlPerHr: 600, sodiumMgPerHr: 300 } }),
      history: [],
    });
    expect(r.carbRate.suggestedGph).toBeNull();
  });

  test('decrease never goes below 30 g/hr', () => {
    const r = suggestAdjustments({
      trainedGph: 35,
      checkIn: baseCheckIn({ giScore: 1, actual: { carbsGph: 35, fluidMlPerHr: 600, sodiumMgPerHr: 300 } }),
      history: [],
    });
    expect(r.carbRate.suggestedGph).toBe(30);
  });

  test('invalid score → FuelInputError', () => {
    expect(() => suggestAdjustments({ trainedGph: 60, checkIn: baseCheckIn({ legsScore: 7 }), history: [] })).toThrow(
      FuelInputError,
    );
  });
});

describe('suggestAdjustments: hydration flags (§9.2)', () => {
  const checkIn = (overrides = {}) => ({
    date: '2026-11-06',
    durationMin: 120,
    giScore: 4,
    energyScore: 4,
    legsScore: 4,
    bonked: false,
    cramped: false,
    targets: { carbsGph: 60, fluidMlPerHr: 900, sodiumMgPerHr: 450 },
    actual: { carbsGph: 60, fluidMlPerHr: 900, sodiumMgPerHr: 450, fluidMl: 1800 },
    ...overrides,
  });

  test('H1: 2.4% weight loss → more-fluid, sweat rate 1,500 offered', () => {
    const r = suggestAdjustments({
      trainedGph: 70,
      checkIn: checkIn({
        weightPreKg: 75,
        weightPostKg: 73.2,
        actual: { carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300, fluidMl: 1200 },
      }),
      history: [],
    });
    expect(r.flags.map((f) => f.code)).toContain('more-fluid');
    expect(r.measuredSweatRateMlPerHr).toBe(1500);
  });

  test('H2: cramped with sodium 200 vs target 450 → more-sodium', () => {
    const r = suggestAdjustments({
      trainedGph: 70,
      checkIn: checkIn({ cramped: true, actual: { carbsGph: 60, fluidMlPerHr: 900, sodiumMgPerHr: 200, fluidMl: 1800 } }),
      history: [],
    });
    const codes = r.flags.map((f) => f.code);
    expect(codes).toContain('more-sodium');
    expect(codes).not.toContain('more-fluid');
  });

  test('H3: gained 0.6 kg → less-fluid', () => {
    const r = suggestAdjustments({
      trainedGph: 70,
      checkIn: checkIn({ weightPreKg: 75, weightPostKg: 75.6 }),
      history: [],
    });
    expect(r.flags.map((f) => f.code)).toContain('less-fluid');
  });

  test('good ride → no flags', () => {
    const r = suggestAdjustments({ trainedGph: 70, checkIn: checkIn(), history: [] });
    expect(r.flags).toEqual([]);
  });

  test('H4 (a real ride): 85 min, ate 27 of 60 g/hr and no sodium, felt fine → eat more, add sodium', () => {
    const r = suggestAdjustments({
      trainedGph: 60,
      checkIn: checkIn({
        durationMin: 85,
        giScore: 4,
        energyScore: 4,
        targets: { carbsGph: 60, fluidMlPerHr: 600, sodiumMgPerHr: 300 },
        actual: { carbsGph: 27, fluidMlPerHr: 500, sodiumMgPerHr: 0, fluidMl: 708 },
      }),
      history: [],
    });
    expect(r.carbRate.suggestedGph).toBeNull(); // the rate only changes after rides that tested it
    expect(r.flags).toEqual([
      {
        code: 'eat-more',
        message: 'You ate 27 g/hr of carbs; the plan was 60. Eat closer to your plan next time.',
        params: { eatenGph: 27, targetGph: 60 },
      },
      {
        code: 'more-sodium',
        message: 'You had 0 mg/hr of sodium; the plan was 300. Add sodium next time.',
        params: { eatenMg: 0, targetMg: 300 },
      },
    ]); // 500 of 600 ml/hr is 83%: enough fluid
  });

  test('H5: under the plan but the stomach struggled → go easier, not "eat more"', () => {
    const r = suggestAdjustments({
      trainedGph: 60,
      checkIn: checkIn({ giScore: 2, actual: { carbsGph: 20, fluidMlPerHr: 300, sodiumMgPerHr: 0, fluidMl: 600 } }),
      history: [],
    });
    expect(r.flags.map((f) => f.code)).toEqual(['easy-on-stomach']);
  });

  test('H6: nothing logged at all → eat more (0 g/hr), drink more, add sodium', () => {
    const r = suggestAdjustments({ trainedGph: 60, checkIn: checkIn({ actual: {} }), history: [] });
    expect(r.flags.map((f) => [f.code, f.params])).toEqual([
      ['eat-more', { eatenGph: 0, targetGph: 60 }],
      ['drink-more', { pct: 0 }],
      ['more-sodium', { eatenMg: 0, targetMg: 450 }],
    ]);
  });

  test('H7: drank 60% of the planned fluid → drink-more with the percentage; not after gaining weight', () => {
    const low = { carbsGph: 60, fluidMlPerHr: 540, sodiumMgPerHr: 450, fluidMl: 1080 };
    const r = suggestAdjustments({ trainedGph: 70, checkIn: checkIn({ actual: low }), history: [] });
    expect(r.flags).toEqual([
      { code: 'drink-more', message: 'You drank 60% of the planned fluid. Drink more next time.', params: { pct: 60 } },
    ]);
    const gained = suggestAdjustments({
      trainedGph: 70,
      checkIn: checkIn({ actual: low, weightPreKg: 75, weightPostKg: 75.6 }),
      history: [],
    });
    expect(gained.flags.map((f) => f.code)).toEqual(['less-fluid']);
  });

  test('a sodium-optional ride (target 0) never asks for sodium', () => {
    const r = suggestAdjustments({
      trainedGph: 70,
      checkIn: checkIn({ targets: { carbsGph: 60, fluidMlPerHr: 900, sodiumMgPerHr: 0 } }),
      history: [],
    });
    expect(r.flags).toEqual([]);
  });
});

describe('intakeStatus (§9.0): the colour of "what you ate"', () => {
  const targets = { carbsGph: 60 };
  test.each([
    [60, 'on-plan', 100],
    [54, 'on-plan', 90], // 90% is on plan
    [75, 'on-plan', 125], // more than planned is fine
    [53, 'under', 88],
    [27, 'under', 45],
    [0, 'none', 0],
  ])('ate %i of 60 g/hr → %s', (carbsGph, status, pct) => {
    expect(intakeStatus({ actual: { carbsGph }, targets })).toEqual({ status, pct });
  });

  test('nothing logged → none; a plan that needs no carbs → always on plan', () => {
    expect(intakeStatus({ actual: null, targets }).status).toBe('none');
    expect(intakeStatus({ actual: { carbsGph: 0 }, targets: { carbsGph: 0 } })).toEqual({ status: 'on-plan', pct: null });
  });
});
