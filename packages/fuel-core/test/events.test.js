// docs/FUELING_RULES.md §9A, examples EV1–EV7
import { buildEventPlan, FuelInputError, gutTrainingRamp, projectEventIntensity } from '../src/index.js';

const TODAY = '2026-11-06T12:00:00.000Z';
const riderAStar = { weightKg: 75, age: 40, sex: 'male', ftpW: 270, lthr: 165, trainedCarbRateGph: 60, sweatSodium: 'average' };
const lastRace = { durationMin: 180, intensity: { avgPowerW: 210, normalizedPowerW: 230 }, ftpAtTimeW: 250 };
const ev1 = (overrides = {}) => ({ type: 'race', date: '2026-12-18T12:00:00.000Z', past: lastRace, ...overrides });

describe('projectEventIntensity (§9A.1)', () => {
  test('EV1: same effort scaled by today’s FTP', () => {
    const p = projectEventIntensity({ past: lastRace, currentFtpW: 270 });
    expect(p.ftpRatio).toBeCloseTo(1.08, 5);
    expect(p.intensity).toEqual({ avgPowerW: 226.8, normalizedPowerW: 248.4 });
    expect(p.basis).toBe('power');
    expect(p.notes).toEqual([]);
  });

  test('EV4: unknown FTP back then → same watts, with a note', () => {
    const p = projectEventIntensity({ past: { durationMin: 180, intensity: { avgPowerW: 210 } }, currentFtpW: 270 });
    expect(p.intensity).toEqual({ avgPowerW: 210 });
    expect(p.notes.map((n) => n.code)).toEqual(['FTP_RATIO_UNKNOWN']);
  });

  test('kJ only → average power from kJ ÷ time, then scaled', () => {
    const p = projectEventIntensity({ past: { durationMin: 120, intensity: { workKj: 1440 }, ftpAtTimeW: 200 }, currentFtpW: 220 });
    expect(p.intensity).toEqual({ avgPowerW: 220 }); // 200 W × 1.1
  });

  test('EV5: heart rate only → reused as-is', () => {
    const p = projectEventIntensity({ past: { durationMin: 180, intensity: { avgHr: 160 } }, currentFtpW: 270 });
    expect(p).toMatchObject({ intensity: { avgHr: 160 }, basis: 'hr', ftpRatio: null });
  });

  test('no effort data or bad duration → FuelInputError', () => {
    expect(() => projectEventIntensity({ past: { durationMin: 180, intensity: {} } })).toThrow(FuelInputError);
    expect(() => projectEventIntensity({ past: { durationMin: 5, intensity: { avgHr: 150 } } })).toThrow(FuelInputError);
  });
});

describe('gutTrainingRamp (§9A.3)', () => {
  test('EV1: 6 weeks out → 5 build weeks of +5 from 60, goal 90 not reachable', () => {
    const r = gutTrainingRamp({ currentGph: 60, goalGph: 90, today: TODAY, eventDate: '2026-12-18T12:00:00.000Z' });
    expect(r.daysUntil).toBe(42);
    expect(r.weeksUntil).toBe(6);
    expect(r.weeks.map((w) => w.targetGph)).toEqual([65, 70, 75, 80, 85]);
    expect(r.weeks[0].startDate).toBe('2026-11-06');
    expect(r.weeks[1].startDate).toBe('2026-11-13');
    expect(r).toMatchObject({ raceDayGph: 85, reachable: false });
  });

  test('counts calendar days whatever the time of day (event dates sit at midday)', () => {
    const event = '2026-12-18T12:00:00.000Z';
    for (const now of ['2026-11-06T00:30:00.000Z', '2026-11-06T12:00:00.000Z', '2026-11-06T23:30:00.000Z']) {
      expect(gutTrainingRamp({ currentGph: 60, goalGph: 90, today: now, eventDate: event }).daysUntil).toBe(42);
    }
  });

  test('EV2: from 50 → +10 to 60, then +5', () => {
    const r = gutTrainingRamp({ currentGph: 50, goalGph: 90, today: TODAY, eventDate: '2026-12-18T12:00:00.000Z' });
    expect(r.weeks.map((w) => w.targetGph)).toEqual([60, 65, 70, 75, 80]);
  });

  test('EV3: under a week away → no build-up', () => {
    const r = gutTrainingRamp({ currentGph: 60, goalGph: 90, today: TODAY, eventDate: '2026-11-11T12:00:00.000Z' });
    expect(r.weeks).toEqual([]);
    expect(r).toMatchObject({ weeksUntil: 0, raceDayGph: 60, reachable: false });
  });

  test('stops once the goal is reached', () => {
    const r = gutTrainingRamp({ currentGph: 60, goalGph: 70, today: TODAY, eventDate: '2026-12-18T12:00:00.000Z' });
    expect(r.weeks.map((w) => w.targetGph)).toEqual([65, 70]);
    expect(r).toMatchObject({ raceDayGph: 70, reachable: true });
  });

  test('already above the goal → race day uses the goal', () => {
    const r = gutTrainingRamp({ currentGph: 90, goalGph: 75, today: TODAY, eventDate: '2026-12-18T12:00:00.000Z' });
    expect(r).toMatchObject({ weeks: [], raceDayGph: 75, reachable: true });
  });
});

describe('buildEventPlan (§9A)', () => {
  test('EV1: projected race plan uses the race-day rate reached by the build-up', () => {
    const f = buildEventPlan({ event: ev1(), user: riderAStar, today: TODAY });
    expect(f.durationMin).toBe(180);
    expect(f.rideType).toBe('race');
    expect(f.plan.intensity.intensityFactor).toBeCloseTo(0.92, 2);
    expect(f.suggestedGoalGph).toBe(90);
    expect(f.goalGph).toBe(90);
    expect(f.gutTraining.raceDayGph).toBe(85);
    expect(f.plan.targets.carbsGph).toBe(85);
    expect(f.plan.kcalBurned).toBe(2449); // 226.8 W × 3 h
    expect(f.notes.map((n) => n.code)).toContain('GOAL_NOT_REACHABLE');
  });

  test('EV6: longer expected duration keeps the watts and reads the ≥ 240 row', () => {
    const f = buildEventPlan({ event: ev1({ durationMin: 240 }), user: riderAStar, today: TODAY });
    expect(f.durationMin).toBe(240);
    expect(f.plan.intensity.avgPowerW).toBe(226.8);
    expect(f.suggestedGoalGph).toBe(90);
  });

  test('EV7: rider-set goal of 70 → reachable, race day at 70', () => {
    const f = buildEventPlan({ event: ev1({ carbGoalGph: 70 }), user: riderAStar, today: TODAY });
    expect(f.goalGph).toBe(70);
    expect(f.gutTraining.weeks.map((w) => w.targetGph)).toEqual([65, 70]);
    expect(f.plan.targets.carbsGph).toBe(70);
    expect(f.notes.map((n) => n.code)).not.toContain('GOAL_NOT_REACHABLE');
  });

  test('group ride: no race bump in the goal', () => {
    const f = buildEventPlan({
      event: ev1({ type: 'group', past: { durationMin: 120, intensity: { avgPowerW: 175 }, ftpAtTimeW: 250 } }),
      user: { ...riderAStar, ftpW: 250 },
      today: TODAY,
    });
    expect(f.rideType).toBe('group');
    expect(f.suggestedGoalGph).toBe(60); // 120 min moderate, no bump
  });

  test('notes from last time: ran low, stomach struggled', () => {
    const f = buildEventPlan({
      event: ev1({ past: { ...lastRace, carbsGphEaten: 45, bonked: true, giScore: 2 } }),
      user: riderAStar,
      today: TODAY,
    });
    const messages = f.notes.map((n) => n.message).join('\n');
    expect(messages).toContain('Last time you ate 45 g/hr and ran low. This plan: 85 g/hr.');
    expect(messages).toContain('Your stomach struggled last time at 45 g/hr. The build-up trains it toward 90 g/hr.');
  });

  test('indoor event: indoor fluid rule applies', () => {
    const f = buildEventPlan({ event: ev1({ indoor: true }), user: riderAStar, today: TODAY });
    expect(f.plan.indoor).toBe(true);
    expect(f.plan.notes.map((n) => n.code)).toContain('INDOOR');
  });

  test('invalid type, missing today or bad goal → FuelInputError', () => {
    expect(() => buildEventPlan({ event: ev1({ type: 'training' }), user: riderAStar, today: TODAY })).toThrow(FuelInputError);
    expect(() => buildEventPlan({ event: ev1(), user: riderAStar })).toThrow(FuelInputError);
    expect(() => buildEventPlan({ event: ev1({ carbGoalGph: 200 }), user: riderAStar, today: TODAY })).toThrow(FuelInputError);
  });
});
