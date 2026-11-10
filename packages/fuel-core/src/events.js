// Events: planning a race or group ride from last time's data (FUELING_RULES.md §9A).
// Pure functions: "today" is always passed in, never read from the clock.

import * as C from './constants.js';
import { buildFuelPlan, FuelInputError, resolveIntensity, targetCarbRate } from './fuelCalculator.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round1 = (v) => Math.round(v * 10) / 10;

function checkOptionalRange(field, value, { min, max }) {
  if (value === undefined || value === null) return;
  if (!isNum(value) || value < min || value > max) {
    throw new FuelInputError(field, `${field} must be between ${min} and ${max}`);
  }
}

/** YYYY-MM-DD for a date `days` after `iso` (UTC). */
const addDays = (iso, days) => new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * §9A.1 Last time's effort, projected to today's FTP.
 * @param {{ past: { durationMin, intensity: { avgPowerW?, normalizedPowerW?, workKj?, avgHr? }, ftpAtTimeW? }, currentFtpW?: number }} args
 * @returns {{ intensity, basis: 'power'|'hr', ftpRatio: number|null, pastAvgPowerW: number|null, pastFtpW, currentFtpW, notes }}
 */
export function projectEventIntensity({ past, currentFtpW }) {
  if (!past || typeof past !== 'object') throw new FuelInputError('past', "Enter last time's ride data");
  if (!isNum(past.durationMin) || past.durationMin < C.LIMITS.durationMin.min || past.durationMin > C.LIMITS.durationMin.max) {
    throw new FuelInputError('past.durationMin', `Last time's duration must be between 15 and 720 minutes`);
  }
  checkOptionalRange('past.ftpAtTimeW', past.ftpAtTimeW, C.LIMITS.ftpW);
  const i = past.intensity ?? {};
  const notes = [];
  const seconds = past.durationMin * 60;

  let pastAvg = null;
  if (isNum(i.avgPowerW)) pastAvg = i.avgPowerW;
  else if (isNum(i.workKj)) pastAvg = (i.workKj * 1000) / seconds;
  else if (isNum(i.normalizedPowerW)) pastAvg = i.normalizedPowerW / C.NP_TO_AVG_POWER_RATIO;

  if (pastAvg !== null) {
    const known = isNum(past.ftpAtTimeW) && isNum(currentFtpW);
    const ftpRatio = known ? currentFtpW / past.ftpAtTimeW : 1;
    if (!known) {
      notes.push({
        code: 'FTP_RATIO_UNKNOWN',
        message: "Planned at the same watts as last time. Add last time's FTP and your current FTP to scale it to today's fitness.",
      });
    }
    const intensity = { avgPowerW: round1(pastAvg * ftpRatio) };
    if (isNum(i.normalizedPowerW)) intensity.normalizedPowerW = round1(i.normalizedPowerW * ftpRatio);
    return {
      intensity,
      basis: 'power',
      ftpRatio,
      pastAvgPowerW: round1(pastAvg),
      pastFtpW: past.ftpAtTimeW ?? null,
      currentFtpW: currentFtpW ?? null,
      notes,
    };
  }

  if (isNum(i.avgHr)) {
    notes.push({
      code: 'HR_BASED',
      message: "Based on last time's average heart rate. Add power data for a more accurate plan.",
    });
    return {
      intensity: { avgHr: i.avgHr },
      basis: 'hr',
      ftpRatio: null,
      pastAvgPowerW: null,
      pastFtpW: null,
      currentFtpW: currentFtpW ?? null,
      notes,
    };
  }

  throw new FuelInputError('past.intensity', "Enter last time's power, kilojoules or average heart rate");
}

/**
 * §9A.3 Week-by-week gut-training build-up from today's trained rate to the race-day goal.
 * The last week before the event holds steady (race week).
 * @param {{ currentGph: number, goalGph: number, today: string|Date, eventDate: string|Date }} args
 */
export function gutTrainingRamp({ currentGph, goalGph, today, eventDate }) {
  const G = C.GUT_TRAINING;
  const todayIso = new Date(today).toISOString();
  // Calendar days: event dates are stored at local midday, so "now" is always within ±12 h of a
  // whole number of days. Rounding gives the calendar-day count whatever the time of day
  // (the tiny offset makes exactly 12 h before midnight round down, not up).
  const daysUntil = Math.round((Date.parse(new Date(eventDate).toISOString()) - Date.parse(todayIso)) / DAY_MS - 1e-6);
  const weeksUntil = Math.max(0, Math.floor(daysUntil / 7));
  const buildWeeks = Math.max(0, weeksUntil - C.EVENTS.holdWeeksBeforeEvent);

  const weeks = [];
  let rate = currentGph;
  for (let week = 1; week <= buildWeeks && rate < goalGph; week++) {
    const step = rate < G.smallRateBelowGph ? G.increaseStepSmallRateGph : G.increaseStepGph;
    rate = Math.min(goalGph, rate + step, G.maxRateGph);
    weeks.push({ week, startDate: addDays(todayIso, (week - 1) * 7), targetGph: rate });
  }

  return {
    daysUntil,
    weeksUntil,
    weeks,
    goalGph,
    raceDayGph: Math.min(goalGph, rate),
    reachable: rate >= goalGph,
  };
}

/**
 * §9A Full event forecast: projected effort, race-day carb goal, gut-training build-up and the race-day plan.
 * @param {{ event: { type: 'race'|'group', date, durationMin?, tempC?, indoor?, carbGoalGph?,
 *                    past: { durationMin, intensity, ftpAtTimeW?, carbsGphEaten?, giScore?, bonked?, energyScore? } },
 *           user: object, foods?: object[], today: string|Date }} args
 */
export function buildEventPlan({ event, user, foods = [], today, autoSelectFoods = false }) {
  if (!event || typeof event !== 'object') throw new FuelInputError('event', 'event is required');
  if (!C.EVENT_TYPES.includes(event.type)) {
    throw new FuelInputError('type', `type must be one of ${C.EVENT_TYPES.join(', ')}`);
  }
  if (!event.date || Number.isNaN(Date.parse(new Date(event.date)))) throw new FuelInputError('date', 'date is required');
  if (!today) throw new FuelInputError('today', 'today is required');
  checkOptionalRange('carbGoalGph', event.carbGoalGph, C.LIMITS.trainedCarbRateGph);

  const projection = projectEventIntensity({ past: event.past, currentFtpW: user.ftpW });
  const durationMin = event.durationMin ?? event.past.durationMin;
  const rideType = event.type === 'race' ? 'race' : 'group';

  const resolved = resolveIntensity({ durationMin, intensity: projection.intensity, user });
  const suggestedGoalGph = targetCarbRate({
    durationMin,
    level: resolved.level,
    trainedGph: C.MAX_CARB_GPH, // the goal is what the event needs, not what the gut handles today
    rideType,
  }).carbsGph;
  const goalGph = event.carbGoalGph ?? suggestedGoalGph;
  const currentGph = user.trainedCarbRateGph ?? C.DEFAULT_TRAINED_CARB_RATE_GPH;
  const gutTraining = gutTrainingRamp({ currentGph, goalGph, today, eventDate: event.date });

  const plan = buildFuelPlan({
    ride: { durationMin, intensity: projection.intensity, tempC: event.tempC, indoor: event.indoor ?? false, rideType },
    user: { ...user, trainedCarbRateGph: gutTraining.raceDayGph },
    foods,
    autoSelectFoods,
  });

  const notes = [...projection.notes];
  if (!gutTraining.reachable && gutTraining.daysUntil >= 0) {
    notes.push({
      code: 'GOAL_NOT_REACHABLE',
      message: `Race day is in ${gutTraining.weeksUntil} ${gutTraining.weeksUntil === 1 ? 'week' : 'weeks'}: at a safe +5–10 g/hr per week you can reach about ${gutTraining.raceDayGph} g/hr. The plan uses ${gutTraining.raceDayGph}.`,
      params: { count: gutTraining.weeksUntil, raceDayGph: gutTraining.raceDayGph }, // count picks singular/plural
    });
  }
  const past = event.past;
  if (isNum(past.carbsGphEaten)) {
    const ranLow = past.bonked || (isNum(past.energyScore) && past.energyScore <= 2);
    if (ranLow && past.carbsGphEaten < plan.targets.carbsGph) {
      notes.push({
        code: 'LAST_TIME_RAN_LOW',
        message: `Last time you ate ${past.carbsGphEaten} g/hr and ran low. This plan: ${plan.targets.carbsGph} g/hr.`,
        params: { eatenGph: past.carbsGphEaten, planGph: plan.targets.carbsGph },
      });
    }
    if (isNum(past.giScore) && past.giScore <= 2) {
      notes.push({
        code: 'LAST_TIME_STOMACH',
        message: `Your stomach struggled last time at ${past.carbsGphEaten} g/hr. The build-up trains it toward ${goalGph} g/hr.`,
        params: { eatenGph: past.carbsGphEaten, goalGph },
      });
    }
  }

  return { durationMin, rideType, projection, suggestedGoalGph, goalGph, gutTraining, plan, notes };
}
