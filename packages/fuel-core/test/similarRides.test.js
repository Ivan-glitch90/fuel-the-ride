import { findSimilarRides } from '../src/index.js';

// FUELING_RULES.md §9B
const target = { durationMin: 120, kcalPerHour: 630 };
const ride = (id, durationMin, kcalPerHour, overrides = {}) => ({
  id,
  date: `2026-10-${String(10 + id.charCodeAt(0) - 64).padStart(2, '0')}T08:00:00.000Z`,
  durationMin,
  kcalBurned: (kcalPerHour * durationMin) / 60,
  actual: { carbsGph: 60, fluidMlPerHr: 500, sodiumMgPerHr: 300 },
  intake: [{ foodId: 'bar', servings: 2 }],
  checkIn: null,
  ...overrides,
});

describe('findSimilarRides (§9B)', () => {
  test('R1: rides that worked come first, then the closest match', () => {
    const rides = [
      ride('B', 125, 620, { checkIn: { giScore: 2, energyScore: 4 } }),
      ride('A', 110, 650, { checkIn: { giScore: 5, energyScore: 4 } }),
    ];
    const result = findSimilarRides(target, rides);
    expect(result.map((r) => [r.id, r.worked])).toEqual([
      ['A', true],
      ['B', false],
    ]);
    expect(result[0]).toMatchObject({ durationMin: 110, kcalPerHour: 650, carbsGph: 60, checkIn: { giScore: 5 } });
  });

  test('R2: too long, too hard, or nothing logged → nothing to suggest', () => {
    const rides = [
      ride('C', 200, 630),
      ride('D', 120, 900),
      ride('E', 120, 630, { actual: null }),
      ride('F', 120, 630, { actual: { carbsGph: 0, fluidMlPerHr: 500, sodiumMgPerHr: 0 } }),
    ];
    expect(findSimilarRides(target, rides)).toEqual([]);
  });

  test('R3: what was eaten, per hour, rounded to the nearest half serving', () => {
    const [r] = findSimilarRides(target, [
      ride('F', 120, 630, {
        intake: [
          { foodId: 'bar', servings: 2 },
          { foodId: 'gel', servings: 3 },
          { foodId: 'unused', servings: 0 },
        ],
      }),
    ]);
    expect(r.perHour).toEqual([
      { foodId: 'bar', servings: 1 },
      { foodId: 'gel', servings: 1.5 },
    ]);
  });

  test('a bonk means it did not work, even with good scores', () => {
    const [r] = findSimilarRides(target, [ride('G', 120, 630, { checkIn: { giScore: 5, energyScore: 5, bonked: true } })]);
    expect(r.worked).toBe(false);
  });

  test('closest first among equals, at most 3', () => {
    const rides = [ride('H', 140, 700), ride('I', 120, 630), ride('J', 100, 600), ride('K', 125, 640)];
    expect(findSimilarRides(target, rides).map((r) => r.id)).toEqual(['I', 'K', 'J']);
  });

  test('bad target or no history → empty', () => {
    expect(findSimilarRides({ durationMin: 0, kcalPerHour: 600 }, [ride('A', 120, 630)])).toEqual([]);
    expect(findSimilarRides(target, undefined)).toEqual([]);
  });
});
