// docs/FUELING_RULES.md §7.3 (mixing drinks and food) and §7.5 (what to carry), example S3
import { buildFuelPlan, carryList } from '../src/index.js';

const riderA = { weightKg: 75, age: 40, sex: 'male', ftpW: 250, lthr: 165, trainedCarbRateGph: 70, sweatSodium: 'average' };
// 2 h, avg 175 W (moderate), 10 °C → 60 g carbs, 400 ml fluid
const coolRide = { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 10 };

const carbDrink = { id: 'mix', name: 'First endurance', type: 'drink', carbsG: 60, kcal: 240, sodiumMg: 300, fluidMl: 400 };
const gel = { id: 'gel', name: 'Energy gel', type: 'gel', carbsG: 22, kcal: 100, sodiumMg: 50, fluidMl: 0 };
const bar = { id: 'bar', name: 'Oat bar', type: 'bar', carbsG: 44, kcal: 250, sodiumMg: 150, fluidMl: 0 };
const electrolyte = { id: 'drink', name: 'Electrolyte drink', type: 'drink', carbsG: 15, kcal: 60, sodiumMg: 400, fluidMl: 500 };

const hour1 = (plan) => plan.schedule[0].items.map((i) => [i.name, i.servings]);

describe('§7.3 drinks cover at most half the carbs when solid foods are picked', () => {
  test('S3: a 60 g carb drink + gels → ½ bottle + 1 gel + water, not 1 bottle alone', () => {
    const plan = buildFuelPlan({ ride: coolRide, user: riderA, foods: [carbDrink, gel] });
    expect(plan.targets).toMatchObject({ carbsGph: 60, fluidMlPerHr: 400 });
    expect(hour1(plan)).toEqual([
      ['First endurance', 0.5],
      ['Energy gel', 1],
    ]);
    expect(plan.schedule[0]).toMatchObject({ plainWaterMl: 200, carbsG: 52, fluidMl: 400 });
    expect(plan.schedule[0].warnings).toEqual([]); // 52 g is within 10 g of 60
  });

  test('with a bar too, food fills the other half (½ bar = 22 g ties with 1 gel; fewer servings wins)', () => {
    const plan = buildFuelPlan({ ride: coolRide, user: riderA, foods: [carbDrink, bar, gel] });
    expect(hour1(plan)).toEqual([
      ['First endurance', 0.5],
      ['Oat bar', 0.5],
    ]);
    expect(plan.schedule[0].carbsG).toBe(52);
  });

  test('only the drink picked → it still covers everything (nothing to mix with)', () => {
    const plan = buildFuelPlan({ ride: coolRide, user: riderA, foods: [carbDrink] });
    expect(hour1(plan)).toEqual([['First endurance', 1]]);
    expect(plan.schedule[0].plainWaterMl).toBe(0);
  });

  test('low-carb electrolyte drinks are unaffected (spec S1 unchanged)', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22 },
      user: riderA,
      foods: [bar, gel, electrolyte],
    });
    expect(hour1(plan)).toEqual([
      ['Electrolyte drink', 1],
      ['Oat bar', 1],
    ]);
  });

  test('never less than half a serving of the drink', () => {
    // 45 min ride: 0 g/hr carbs would skip the cap; use a hard 45 min → 30 g/hr, block 22.5 g
    const plan = buildFuelPlan({
      ride: { durationMin: 45, intensity: { avgPowerW: 220 }, tempC: 10 },
      user: riderA,
      foods: [carbDrink, gel],
    });
    expect(plan.schedule[0].items.find((i) => i.foodId === 'mix').servings).toBe(0.5);
  });
});

describe('§7.5 carryList', () => {
  test('sums every hour: spec S1 over 2 h → 2 drinks, 2 bars, 200 ml water', () => {
    const plan = buildFuelPlan({
      ride: { durationMin: 120, intensity: { avgPowerW: 175 }, tempC: 22 },
      user: riderA,
      foods: [bar, gel, electrolyte],
    });
    expect(carryList(plan)).toEqual({
      items: [
        { foodId: 'drink', name: 'Electrolyte drink', servings: 2 },
        { foodId: 'bar', name: 'Oat bar', servings: 2 },
      ],
      plainWaterMl: 200,
    });
  });

  test('S3 over 2 h → 1 bottle, 2 gels, 400 ml water', () => {
    const plan = buildFuelPlan({ ride: coolRide, user: riderA, foods: [carbDrink, gel] });
    expect(carryList(plan)).toEqual({
      items: [
        { foodId: 'mix', name: 'First endurance', servings: 1 },
        { foodId: 'gel', name: 'Energy gel', servings: 2 },
      ],
      plainWaterMl: 400,
    });
  });

  test('a plan without a schedule → nothing to carry', () => {
    expect(carryList({ schedule: [] })).toEqual({ items: [], plainWaterMl: 0 });
    expect(carryList(undefined)).toEqual({ items: [], plainWaterMl: 0 });
  });
});
