// docs/FUELING_RULES.md §7.0: the app picks the foods, matched to the effort
import { buildEventPlan, buildFuelPlan, FuelInputError, selectFoodsForRide } from '../src/index.js';

const f = (id, type, extra = {}) => ({ id, name: id, type, carbsG: 25, kcal: 100, sodiumMg: 50, fluidMl: 0, ...extra });
const library = [
  f('banana', 'real', { carbsG: 27 }),
  f('oat-bar', 'bar', { carbsG: 44 }),
  f('gel-a', 'gel', { carbsG: 22 }),
  f('gel-b', 'gel', { carbsG: 22, favorite: true }),
  f('mix', 'drink', { carbsG: 15, sodiumMg: 400, fluidMl: 500 }),
  f('salt', 'electrolyte', { carbsG: 0, sodiumMg: 250 }),
];
const ids = (sel) => sel.foods.map((x) => x.id);

describe('selectFoodsForRide', () => {
  test('hard or race → Fast: gels and drinks first; favorite gel before the other', () => {
    expect(ids(selectFoodsForRide({ foods: library, level: 'hard' }))).toEqual([
      'gel-b',
      'gel-a',
      'mix',
      'salt',
      'oat-bar',
      'banana',
    ]);
    expect(selectFoodsForRide({ foods: library, level: 'moderate', rideType: 'race' }).profile).toBe('fast');
  });

  test('moderate → Mixed: bars first', () => {
    const sel = selectFoodsForRide({ foods: library, level: 'moderate' });
    expect(sel.profile).toBe('mixed');
    expect(ids(sel)).toEqual(['oat-bar', 'gel-b', 'gel-a', 'mix', 'banana', 'salt']);
  });

  test('easy → Steady: real food first', () => {
    expect(ids(selectFoodsForRide({ foods: library, level: 'easy' }))[0]).toBe('banana');
  });

  test('archived foods are never picked; limits: 4 solids, 2 drinks, 1 tab', () => {
    const big = [
      ...['a', 'b', 'c', 'd', 'e'].map((n) => f(`gel-${n}`, 'gel')),
      ...['x', 'y', 'z'].map((n) => f(`drink-${n}`, 'drink', { fluidMl: 500 })),
      f('tab-1', 'electrolyte', { carbsG: 0, sodiumMg: 200 }),
      f('tab-2', 'electrolyte', { carbsG: 0, sodiumMg: 200 }),
      f('old', 'gel', { archived: true }),
    ];
    const picked = ids(selectFoodsForRide({ foods: big, level: 'hard' }));
    expect(picked).toEqual(['gel-a', 'gel-b', 'gel-c', 'gel-d', 'drink-x', 'drink-y', 'tab-1']);
  });

  test('empty library → nothing picked; not an array → FuelInputError', () => {
    expect(ids(selectFoodsForRide({ foods: [], level: 'easy' }))).toEqual([]);
    expect(() => selectFoodsForRide({ foods: null, level: 'easy' })).toThrow(FuelInputError);
  });
});

describe('buildFuelPlan with autoSelectFoods', () => {
  const riderA = { weightKg: 75, age: 40, sex: 'male', ftpW: 250, trainedCarbRateGph: 70, sweatSodium: 'average' };
  const s1Library = [
    { id: 'drink', name: 'Electrolyte drink', type: 'drink', carbsG: 15, kcal: 60, sodiumMg: 400, fluidMl: 500 },
    { id: 'gel', name: 'Energy gel', type: 'gel', carbsG: 22, kcal: 100, sodiumMg: 50, fluidMl: 0 },
    { id: 'bar', name: 'Oat bar', type: 'bar', carbsG: 44, kcal: 250, sodiumMg: 150, fluidMl: 0 },
  ];
  const t1 = { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22 };

  test('spec S1 library on T1 → same plan as S1 (bar, gel, drink order)', () => {
    const plan = buildFuelPlan({ ride: t1, user: riderA, foods: s1Library, autoSelectFoods: true });
    expect(plan.foodSelection).toEqual({ mode: 'auto', profile: 'mixed', foodIds: ['bar', 'gel', 'drink'] });
    expect(plan.schedule[0].items.map((i) => [i.foodId, i.servings])).toEqual([
      ['drink', 1],
      ['bar', 1],
    ]);
  });

  test('a race reaches for gels instead of the bar', () => {
    const plan = buildFuelPlan({ ride: { ...t1, rideType: 'race' }, user: riderA, foods: s1Library, autoSelectFoods: true });
    expect(plan.foodSelection.profile).toBe('fast');
    expect(plan.schedule[0].items.map((i) => i.foodId)).toEqual(['drink', 'gel']);
  });

  test('preferred type can’t get within 10 g → the next type steps in', () => {
    const tinyGel = { id: 'tiny', name: 'Tiny gel', type: 'gel', carbsG: 5, kcal: 20, sodiumMg: 0, fluidMl: 0 };
    const bar = s1Library[2];
    const plan = buildFuelPlan({ ride: { ...t1, rideType: 'race' }, user: riderA, foods: [tinyGel, bar], autoSelectFoods: true });
    // 4 tiny gels max = 20 g of the 70 g target (50+ g off) → the bar is used too
    expect(plan.schedule[0].items.map((i) => i.foodId)).toContain('bar');
    expect(Math.abs(plan.schedule[0].carbsG - 70)).toBeLessThanOrEqual(10);
  });

  test('manual picks are used as given', () => {
    const plan = buildFuelPlan({ ride: t1, user: riderA, foods: [s1Library[1]] });
    expect(plan.foodSelection).toEqual({ mode: 'manual', profile: null, foodIds: ['gel'] });
  });

  test('events pass autoSelectFoods through', () => {
    const f2 = buildEventPlan({
      event: { type: 'race', date: '2026-12-20T12:00:00.000Z', past: { durationMin: 120, intensity: { avgPowerW: 175 } } },
      user: riderA,
      foods: s1Library,
      today: '2026-11-08T12:00:00.000Z',
      autoSelectFoods: true,
    });
    expect(f2.plan.foodSelection.mode).toBe('auto');
  });
});
