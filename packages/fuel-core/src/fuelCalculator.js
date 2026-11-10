// Fuel the Ride: fueling calculator.
// Pure functions only: no I/O, no Date.now(), no randomness. Every output is plain JSON.
// Spec: docs/FUELING_RULES.md (section numbers in comments refer to it).

import * as C from './constants.js';

// ---------------------------------------------------------------------------
// Errors and small helpers
// ---------------------------------------------------------------------------

export class FuelInputError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'FuelInputError';
    this.code = 'INVALID_INPUT';
    this.field = field;
  }
}

const EPS = 1e-9;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isSet = (v) => v !== undefined && v !== null;
const roundTo = (value, step) => Math.round(value / step) * step;
const floorTo = (value, step) => Math.floor(value / step) * step;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sum = (list, fn) => list.reduce((total, x) => total + fn(x), 0);

function checkRange(field, value, range, { required = false } = {}) {
  if (!isSet(value)) {
    if (required) throw new FuelInputError(field, `${field} is required`);
    return;
  }
  if (!isNum(value) || value < range.min || value > range.max) {
    throw new FuelInputError(field, `${field} must be between ${range.min} and ${range.max}`);
  }
}

function checkZone(field, value, maxZone, tooHighMessage) {
  if (!isSet(value)) return;
  if (!Number.isInteger(value) || value < 1) throw new FuelInputError(field, `${field} must be 1–${maxZone}`);
  if (value > maxZone) throw new FuelInputError(field, tooHighMessage ?? `${field} must be 1–${maxZone}`);
}

function checkScore(field, value) {
  if (!Number.isInteger(value) || value < C.LIMITS.score.min || value > C.LIMITS.score.max) {
    throw new FuelInputError(field, `${field} must be a whole number from 1 to 5`);
  }
}

function validateUser(user) {
  if (!user || typeof user !== 'object') throw new FuelInputError('user', 'user is required');
  checkRange('weightKg', user.weightKg, C.LIMITS.weightKg, { required: true });
  checkRange('trainedCarbRateGph', user.trainedCarbRateGph, C.LIMITS.trainedCarbRateGph);
  checkRange('age', user.age, C.LIMITS.age);
  checkRange('ftpW', user.ftpW, C.LIMITS.ftpW);
  checkRange('lthr', user.lthr, C.LIMITS.lthr);
  checkRange('maxHr', user.maxHr, C.LIMITS.maxHr);
  checkRange('sweatRateMlPerHr', user.sweatRateMlPerHr, C.LIMITS.sweatRateMlPerHr);
  if (isSet(user.sweatSodium) && !C.SWEAT_SODIUM_LEVELS.includes(user.sweatSodium)) {
    throw new FuelInputError('sweatSodium', `sweatSodium must be one of ${C.SWEAT_SODIUM_LEVELS.join(', ')}`);
  }
}

function validateFoods(foods) {
  if (!Array.isArray(foods)) throw new FuelInputError('foods', 'foods must be an array');
  return foods.map((food, i) => {
    const field = `foods[${i}]`;
    if (!food || !isSet(food.id)) throw new FuelInputError(field, `${field}.id is required`);
    if (!C.FOOD_TYPES.includes(food.type)) {
      throw new FuelInputError(`${field}.type`, `type must be one of ${C.FOOD_TYPES.join(', ')}`);
    }
    const n = (key) => {
      const v = food[key] ?? 0;
      if (!isNum(v) || v < 0) throw new FuelInputError(`${field}.${key}`, `${key} must be a number ≥ 0`);
      return v;
    };
    return {
      id: food.id,
      name: food.name ?? String(food.id),
      type: food.type,
      carbsG: n('carbsG'),
      kcal: n('kcal'),
      sodiumMg: n('sodiumMg'),
      fluidMl: n('fluidMl'),
    };
  });
}

// ---------------------------------------------------------------------------
// §3 Intensity
// ---------------------------------------------------------------------------

function interpolate(x, points) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

function intensityLevel(intensityFactor) {
  if (intensityFactor >= C.INTENSITY_LEVEL_MIN_IF.hard) return 'hard';
  if (intensityFactor >= C.INTENSITY_LEVEL_MIN_IF.moderate) return 'moderate';
  return 'easy';
}

function resolveFtp(user) {
  if (isNum(user.ftpW)) return { ftpW: user.ftpW, estimated: false };
  return { ftpW: C.DEFAULT_FTP_W_PER_KG * user.weightKg, estimated: true };
}

function requireAge(user, purpose) {
  if (!isNum(user.age)) throw new FuelInputError('age', `age is required to ${purpose}`);
}

// LTHR → 0.90 × max HR → 0.90 × (208 − 0.7 × age). Each fallback step lowers confidence.
function resolveLthr(user) {
  if (isNum(user.lthr)) return { lthr: user.lthr, fallbacks: 0 };
  if (isNum(user.maxHr)) return { lthr: C.LTHR_FROM_MAX_HR * user.maxHr, fallbacks: 1 };
  requireAge(user, 'estimate your heart-rate zones');
  const maxHr = C.TANAKA.intercept - C.TANAKA.slope * user.age;
  return { lthr: C.LTHR_FROM_MAX_HR * maxHr, fallbacks: 2 };
}

function keytelKcalPerMin({ hr, weightKg, age, sex }) {
  const calc = (k) => (k.intercept + k.hr * hr + k.weightKg * weightKg + k.age * age) / C.KEYTEL.kjPerKcal;
  if (sex === 'male') return calc(C.KEYTEL.male);
  if (sex === 'female') return calc(C.KEYTEL.female);
  return (calc(C.KEYTEL.male) + calc(C.KEYTEL.female)) / 2;
}

function lowerConfidence(base, steps) {
  const index = C.CONFIDENCE_LEVELS.indexOf(base);
  return C.CONFIDENCE_LEVELS[Math.max(0, index - steps)];
}

function validateIntensity(intensity) {
  checkRange('workKj', intensity.workKj, C.LIMITS.workKj);
  checkRange('avgPowerW', intensity.avgPowerW, C.LIMITS.powerW);
  checkRange('normalizedPowerW', intensity.normalizedPowerW, C.LIMITS.powerW);
  checkRange('avgHr', intensity.avgHr, C.LIMITS.avgHr);
  checkZone('powerZone', intensity.powerZone, 5, 'Use the zone of your whole-ride average (power zones 1–5)');
  checkZone('hrZone', intensity.hrZone, 5);
}

/**
 * §3 Pick the best intensity input and turn it into IF, level, kcal burned and confidence.
 * @returns {{ source, intensityFactor, level, confidence, kcalBurned, kcalMethod, avgPowerW, avgHr, lthr,
 *             estimated: { ftp, lthr }, warnings }}
 */
export function resolveIntensity({ durationMin, intensity, user }) {
  checkRange('durationMin', durationMin, C.LIMITS.durationMin, { required: true });
  validateUser(user);
  const input = intensity ?? {};
  validateIntensity(input);

  const seconds = durationMin * 60;
  const ftp = resolveFtp(user);
  const kjToKcal = (kj) => kj * C.KCAL_PER_KJ;
  let r;

  if (isNum(input.workKj)) {
    const avgPowerW = (input.workKj * 1000) / seconds;
    r = {
      source: 'kj',
      intensityFactor: avgPowerW / ftp.ftpW,
      avgPowerW,
      kcal: kjToKcal(input.workKj),
      kcalMethod: 'kj',
      base: 'high',
      fallbacks: ftp.estimated ? 1 : 0,
      estimated: { ftp: ftp.estimated, lthr: false },
    };
  } else if (isNum(input.avgPowerW) || isNum(input.normalizedPowerW)) {
    const avgPowerW = isNum(input.avgPowerW) ? input.avgPowerW : input.normalizedPowerW / C.NP_TO_AVG_POWER_RATIO;
    const powerForIf = isNum(input.normalizedPowerW) ? input.normalizedPowerW : avgPowerW;
    r = {
      source: 'power',
      intensityFactor: powerForIf / ftp.ftpW,
      avgPowerW,
      kcal: kjToKcal((avgPowerW * seconds) / 1000),
      kcalMethod: 'power',
      base: 'high',
      fallbacks: ftp.estimated ? 1 : 0,
      estimated: { ftp: ftp.estimated, lthr: false },
    };
  } else if (isNum(input.avgHr) || isNum(input.hrZone)) {
    const fromZone = !isNum(input.avgHr);
    const { lthr, fallbacks } = resolveLthr(user);
    const avgHr = fromZone ? (C.HR_ZONE_PCT_LTHR[input.hrZone] / 100) * lthr : input.avgHr;
    const intensityFactor = interpolate((avgHr / lthr) * 100, C.HR_PCT_TO_IF_POINTS);
    let kcal;
    let kcalMethod;
    let avgPowerW = null;
    if (isNum(user.ftpW)) {
      avgPowerW = intensityFactor * user.ftpW;
      kcal = kjToKcal((avgPowerW * seconds) / 1000);
      kcalMethod = 'ftp';
    } else {
      requireAge(user, 'estimate calories from heart rate');
      kcal = keytelKcalPerMin({ hr: avgHr, weightKg: user.weightKg, age: user.age, sex: user.sex }) * durationMin;
      kcalMethod = 'keytel';
    }
    r = {
      source: fromZone ? 'hr-zone' : 'hr',
      intensityFactor,
      avgPowerW,
      avgHr,
      lthr,
      kcal,
      kcalMethod,
      base: fromZone ? 'low' : 'medium',
      fallbacks,
      estimated: { ftp: false, lthr: fallbacks > 0 },
    };
  } else if (isNum(input.powerZone)) {
    const intensityFactor = C.POWER_ZONE_IF[input.powerZone];
    const avgPowerW = intensityFactor * ftp.ftpW;
    r = {
      source: 'power-zone',
      intensityFactor,
      avgPowerW,
      kcal: kjToKcal((avgPowerW * seconds) / 1000),
      kcalMethod: 'power',
      base: 'medium',
      fallbacks: ftp.estimated ? 1 : 0,
      estimated: { ftp: ftp.estimated, lthr: false },
    };
  } else {
    throw new FuelInputError('intensity', 'Intensity required: enter kJ, power, heart rate or a zone');
  }

  const warnings = [];
  if (r.intensityFactor > C.VERY_HARD_WARNING.ifAbove && durationMin > C.VERY_HARD_WARNING.durationAboveMin) {
    warnings.push({ code: 'VERY_HARD', message: "That's very hard for this long. Check your inputs." });
  }

  return {
    source: r.source,
    intensityFactor: r.intensityFactor,
    level: intensityLevel(r.intensityFactor),
    confidence: lowerConfidence(r.base, r.fallbacks),
    kcalBurned: Math.round(r.kcal),
    kcalMethod: r.kcalMethod,
    avgPowerW: r.avgPowerW ?? null,
    avgHr: r.avgHr ?? null,
    lthr: r.lthr ?? null,
    estimated: r.estimated,
    warnings,
  };
}

/** §3 Calories burned for a ride (shortcut over resolveIntensity). */
export function estimateKcalBurned(args) {
  return resolveIntensity(args).kcalBurned;
}

// ---------------------------------------------------------------------------
// §4 Carbs
// ---------------------------------------------------------------------------

const LEVELS = ['easy', 'moderate', 'hard'];

/**
 * §4 Carb target in g/hr, capped by the trained rate and rounded to 5 g (never above the trained rate).
 * §4.1 Race day reads the next-higher intensity column (easy → moderate → hard).
 */
export function targetCarbRate({ durationMin, level, trainedGph, rideType = 'training' }) {
  const row = [...C.CARB_TABLE_GPH].reverse().find((r) => durationMin >= r.minDurationMin);
  const carbLevel =
    rideType === 'race' ? LEVELS[Math.min(LEVELS.indexOf(level) + C.RACE.carbLevelBump, LEVELS.length - 1)] : level;
  const tableGph = row[carbLevel];
  if (!isNum(tableGph)) throw new FuelInputError('level', 'level must be easy, moderate or hard');
  const raw = Math.min(tableGph, trainedGph, C.MAX_CARB_GPH);
  let carbsGph = roundTo(raw, C.ROUND.carbsGph);
  if (carbsGph > trainedGph) carbsGph = floorTo(trainedGph, C.ROUND.carbsGph);
  return { carbsGph, tableGph, cappedByTrained: trainedGph < tableGph };
}

// ---------------------------------------------------------------------------
// §5–6 Fluid and sodium
// ---------------------------------------------------------------------------

/** §5–6 Fluid ml/hr and sodium mg/hr. §5.1 Indoors adds fluid (no wind to cool you). */
export function targetHydration({ durationMin, tempC = C.DEFAULT_TEMP_C, level, user, indoor = false }) {
  let fluid;
  let fluidSource;
  if (isNum(user.sweatRateMlPerHr)) {
    fluid = C.FLUID.fromSweatRateFraction * user.sweatRateMlPerHr;
    fluidSource = 'sweat-rate';
  } else {
    const band = [...C.FLUID.baseByTemp].reverse().find((b) => tempC >= b.minTempC);
    fluid = band.mlPerHr + C.FLUID.intensityAdjustMl[level];
    fluidSource = 'default';
  }
  if (indoor) fluid += C.INDOOR.extraFluidMlPerHr;
  const fluidMlPerHr = roundTo(clamp(fluid, C.FLUID.minMlPerHr, C.FLUID.maxMlPerHr), C.ROUND.fluidMlPerHr);

  const sodiumOptional = durationMin < C.SODIUM.optionalBelowDurationMin && tempC < C.SODIUM.optionalBelowTempC;
  const mgPerLitre = C.SODIUM.mgPerLitre[user.sweatSodium ?? C.DEFAULT_SWEAT_SODIUM];
  const sodiumMgPerHr = sodiumOptional
    ? 0
    : roundTo(clamp((fluidMlPerHr / 1000) * mgPerLitre, C.SODIUM.minMgPerHr, C.SODIUM.maxMgPerHr), C.ROUND.sodiumMgPerHr);

  return { fluidMlPerHr, sodiumMgPerHr, sodiumOptional, fluidSource };
}

// ---------------------------------------------------------------------------
// §7 Schedule
// ---------------------------------------------------------------------------

const isDrink = (food) => food.fluidMl > 0;
const servingStep = (food) => (isDrink(food) ? C.SCHEDULE.drinkServingStep : C.SCHEDULE.servingStepByType[food.type]);

function splitIntoBlocks(durationMin, blockMin) {
  const blocks = [];
  for (let start = 0; start < durationMin; start += blockMin) {
    const minutes = Math.min(blockMin, durationMin - start);
    if (minutes < blockMin && minutes < C.SCHEDULE.minFinalBlockMin) break; // §7.1 no fueling in a short final block
    blocks.push({ hour: blocks.length + 1, startMin: start, endMin: start + minutes, minutes });
  }
  return blocks;
}

// §7.3 step 2: servings closest to the carb target. Ties → fewer servings, then more of earlier-picked foods.
function bestCarbCombo(candidates, target) {
  const current = candidates.map(() => 0);
  let best = { diff: target, total: 0, servings: [...current] };

  const isBetter = (diff, total) => {
    if (diff < best.diff - EPS) return true;
    if (diff > best.diff + EPS) return false;
    if (total < best.total - EPS) return true;
    if (total > best.total + EPS) return false;
    for (let k = 0; k < current.length; k++) {
      if (current[k] !== best.servings[k]) return current[k] > best.servings[k];
    }
    return false;
  };

  const search = (i, carbs, total) => {
    if (i === candidates.length) {
      const diff = Math.abs(carbs - target);
      if (isBetter(diff, total)) best = { diff, total, servings: [...current] };
      return;
    }
    const step = servingStep(candidates[i]);
    for (let s = 0; total + s <= C.SCHEDULE.maxFoodServingsPerBlock + EPS; s += step) {
      const c = carbs + s * candidates[i].carbsG;
      if (s > 0 && c - target > best.diff + EPS) break; // adding more only moves further away
      current[i] = s;
      search(i + 1, c, total + s);
    }
    current[i] = 0;
  };

  search(0, 0, 0);
  return best.servings;
}

/**
 * §7.0 step 5: with app-picked foods (already ordered by preferred type), try the most preferred
 * type alone, then add the next type, and so on. Use the first set within the carb tolerance;
 * otherwise the closest, preferring fewer types on ties.
 */
function carbComboByPreferredTypes(carbFoods, target) {
  const groupEnds = [];
  carbFoods.forEach((food, i) => {
    if (i === carbFoods.length - 1 || carbFoods[i + 1].type !== food.type) groupEnds.push(i + 1);
  });
  let best = { diff: Infinity, servings: carbFoods.map(() => 0) };
  for (const end of groupEnds) {
    const subset = bestCarbCombo(carbFoods.slice(0, end), target);
    const carbs = subset.reduce((total, s, i) => total + s * carbFoods[i].carbsG, 0);
    const diff = Math.abs(carbs - target);
    if (diff < best.diff - EPS) best = { diff, servings: [...subset, ...carbFoods.slice(end).map(() => 0)] };
    if (diff <= C.SCHEDULE.carbToleranceG + EPS) break;
  }
  return best.servings;
}

function fillBlock(block, targets, foods, { preferredTypesFirst = false } = {}) {
  const f = block.minutes / 60;
  const t = { carbsG: targets.carbsGph * f, fluidMl: targets.fluidMlPerHr * f, sodiumMg: targets.sodiumMgPerHr * f };
  const items = [];
  const add = (food, servings) => {
    if (servings <= 0) return;
    const existing = items.find((it) => it.food.id === food.id);
    if (existing) existing.servings += servings;
    else items.push({ food, servings });
  };
  const totalOf = (key) => sum(items, (it) => it.servings * it.food[key]);
  const warnings = [];

  // 1. Fluid first
  let plainWaterMl = 0;
  const drinks = foods.filter(isDrink);
  const hasSolidCarbs = foods.some((food) => !isDrink(food) && food.carbsG > 0);
  if (drinks.length > 0) {
    const drink =
      t.sodiumMg > 0 ? drinks.reduce((best, d) => (d.sodiumMg > best.sodiumMg ? d : best), drinks[0]) : drinks[0];
    let servings = roundTo(t.fluidMl / drink.fluidMl, C.SCHEDULE.drinkServingStep);
    // §7.3 Mix: when solid foods were picked, a carb drink covers at most half the carb target
    // (at least half a serving), and the rest comes from food. The fluid gap becomes plain water.
    if (hasSolidCarbs && drink.carbsG > 0 && t.carbsG > 0) {
      const step = C.SCHEDULE.drinkServingStep;
      const maxByCarbs = floorTo((C.SCHEDULE.maxDrinkCarbShare * t.carbsG) / drink.carbsG + EPS, step);
      servings = Math.min(servings, Math.max(step, maxByCarbs));
    }
    add(drink, servings);
    const gap = t.fluidMl - servings * drink.fluidMl;
    if (gap >= C.SCHEDULE.plainWaterMinGapMl - EPS) plainWaterMl = roundTo(gap, C.ROUND.plainWaterMl);
  } else {
    plainWaterMl = roundTo(t.fluidMl, C.ROUND.plainWaterMl);
  }

  // 2. Carbs next
  const remainingCarbs = Math.max(0, t.carbsG - totalOf('carbsG'));
  const carbFoods = foods.filter((food) => !isDrink(food) && food.carbsG > 0);
  const servings = preferredTypesFirst
    ? carbComboByPreferredTypes(carbFoods, remainingCarbs)
    : bestCarbCombo(carbFoods, remainingCarbs);
  servings.forEach((s, i) => add(carbFoods[i], s));

  // 3. Sodium last
  if (t.sodiumMg > 0) {
    let gap = t.sodiumMg - totalOf('sodiumMg');
    const tabs = foods.filter((food) => !isDrink(food) && food.type === 'electrolyte' && food.sodiumMg > 0);
    if (gap >= C.SCHEDULE.sodiumMinGapMg - EPS && tabs.length > 0) {
      add(tabs[0], Math.max(1, Math.round(gap / tabs[0].sodiumMg)));
      gap = t.sodiumMg - totalOf('sodiumMg');
    }
    if (gap >= C.SCHEDULE.sodiumMinGapMg - EPS) {
      const perHour = roundTo(gap / f, C.ROUND.sodiumMgPerHr);
      warnings.push({
        code: 'SODIUM_SHORT',
        message: `About ${perHour} mg/hr short on sodium. Add an electrolyte drink or tabs.`,
        params: { perHour },
      });
    }
  }

  // 4. Carb accuracy check
  const carbsG = totalOf('carbsG');
  if (Math.abs(carbsG - t.carbsG) > C.SCHEDULE.carbToleranceG + EPS) {
    warnings.push({
      code: 'CARBS_OFF_TARGET',
      message: `Can't hit ${Math.round(t.carbsG)} g with these foods. Add a gel or a drink with carbs.`,
      params: { carbsG: Math.round(t.carbsG) },
    });
  }

  return {
    ...block,
    targets: { carbsG: Math.round(t.carbsG), fluidMl: Math.round(t.fluidMl), sodiumMg: Math.round(t.sodiumMg) },
    items: items.map(({ food, servings }) => ({
      foodId: food.id,
      name: food.name,
      servings,
      carbsG: servings * food.carbsG,
      fluidMl: servings * food.fluidMl,
      sodiumMg: servings * food.sodiumMg,
      kcal: servings * food.kcal,
    })),
    plainWaterMl,
    carbsG: Math.round(carbsG),
    fluidMl: Math.round(totalOf('fluidMl') + plainWaterMl),
    sodiumMg: Math.round(totalOf('sodiumMg')),
    kcal: Math.round(totalOf('kcal')),
    note: C.SCHEDULE.spreadNote,
    warnings,
  };
}

/**
 * §3–7 Build the full fueling plan for a ride.
 * @param {{ ride: { durationMin, intensity, tempC?, indoor?: boolean, rideType?: 'training'|'group'|'race' },
 *           user, foods?: object[], blockMin?: number, autoSelectFoods?: boolean }} args
 *   autoSelectFoods: `foods` is the whole library and the app picks from it (§7.0);
 *   otherwise `foods` are exactly the rider's picks, in their order.
 */
export function buildFuelPlan({ ride, user, foods = [], blockMin = C.SCHEDULE.blockMin, autoSelectFoods = false }) {
  if (!ride || typeof ride !== 'object') throw new FuelInputError('ride', 'ride is required');
  checkRange('tempC', ride.tempC, C.LIMITS.tempC);
  const indoor = ride.indoor ?? false;
  if (typeof indoor !== 'boolean') throw new FuelInputError('indoor', 'indoor must be true or false');
  const rideType = ride.rideType ?? 'training';
  if (!C.RIDE_TYPES.includes(rideType)) {
    throw new FuelInputError('rideType', `rideType must be one of ${C.RIDE_TYPES.join(', ')}`);
  }
  // §5.1 An empty temperature means a typical room indoors
  const tempC = ride.tempC ?? (indoor ? C.INDOOR.defaultTempC : C.DEFAULT_TEMP_C);
  const durationMin = ride.durationMin;

  const intensity = resolveIntensity({ durationMin, intensity: ride.intensity, user });
  const selection = autoSelectFoods
    ? selectFoodsForRide({ foods, level: intensity.level, rideType })
    : { mode: 'manual', profile: null, foods };
  const cleanFoods = validateFoods(selection.foods);
  const trainedGph = user.trainedCarbRateGph ?? C.DEFAULT_TRAINED_CARB_RATE_GPH;

  const carbs = targetCarbRate({ durationMin, level: intensity.level, trainedGph, rideType });
  const hydration = targetHydration({ durationMin, tempC, level: intensity.level, user, indoor });
  const targets = {
    carbsGph: carbs.carbsGph,
    fluidMlPerHr: hydration.fluidMlPerHr,
    sodiumMgPerHr: hydration.sodiumMgPerHr,
  };

  const blocks = splitIntoBlocks(durationMin, blockMin);
  const fueledHours = sum(blocks, (b) => b.minutes) / 60;
  const targetTotals = {
    carbsG: Math.round(targets.carbsGph * fueledHours),
    fluidMl: Math.round(targets.fluidMlPerHr * fueledHours),
    sodiumMg: Math.round(targets.sodiumMgPerHr * fueledHours),
  };

  const notes = [];
  if (carbs.cappedByTrained) {
    notes.push({
      code: 'CAPPED_BY_TRAINED_RATE',
      message: `Limited by your trained rate (${trainedGph} g/hr). Gut training can raise it.`,
      params: { trainedGph },
    });
  }
  if (targets.carbsGph > C.MIXED_CARB_TIP_ABOVE_GPH) {
    notes.push({
      code: 'MIXED_CARBS_TIP',
      message: 'Above 60 g/hr, use foods that mix glucose and fructose (most modern gels and drink mixes).',
    });
  }
  if (hydration.sodiumOptional) {
    notes.push({ code: 'SODIUM_OPTIONAL', message: 'Sodium optional for this ride.' });
  }
  if (indoor) {
    notes.push({
      code: 'INDOOR',
      message: `Indoors there's no wind to cool you, so you sweat more: we added ${C.INDOOR.extraFluidMlPerHr} ml/hr. A fan helps a lot.`,
      params: { extraMlPerHr: C.INDOOR.extraFluidMlPerHr },
    });
  }
  if (rideType === 'race') {
    notes.push({
      code: 'RACE_DAY',
      message: 'Race day: fuel at the top of your range, start in the first 20 minutes, and eat nothing you haven’t tried in training.',
    });
  }
  if (rideType === 'group') {
    notes.push({
      code: 'GROUP_RIDE',
      message: 'Group rides have surges: eat on schedule and before hard sections, not after.',
    });
  }
  if (cleanFoods.length === 0) {
    notes.push({ code: 'NO_FOODS', message: 'Add foods to get a schedule.' });
  }

  const schedule =
    cleanFoods.length > 0
      ? blocks.map((b) => fillBlock(b, targets, cleanFoods, { preferredTypesFirst: selection.mode === 'auto' }))
      : [];

  const seen = new Set();
  const warnings = [...intensity.warnings];
  for (const w of schedule.flatMap((b) => b.warnings)) {
    if (!seen.has(w.message)) {
      seen.add(w.message);
      warnings.push(w);
    }
  }

  return {
    durationMin,
    tempC,
    indoor,
    rideType,
    intensity,
    kcalBurned: intensity.kcalBurned,
    targets,
    targetTotals,
    totals: {
      carbsG: sum(schedule, (b) => b.carbsG),
      fluidMl: sum(schedule, (b) => b.fluidMl),
      sodiumMg: sum(schedule, (b) => b.sodiumMg),
      kcal: sum(schedule, (b) => b.kcal),
    },
    schedule,
    notes,
    warnings,
    foodSelection: { mode: selection.mode, profile: selection.profile, foodIds: cleanFoods.map((f) => f.id) },
  };
}

/**
 * §7.0 Picks the foods for a ride from the rider's library, matched to the effort.
 * Order matters: it becomes the tie-break order in the schedule (§7.3).
 * @param {{ foods: object[], level: 'easy'|'moderate'|'hard', rideType?: string }} args
 * @returns {{ mode: 'auto', profile: 'fast'|'mixed'|'steady', foods: object[] }}
 */
export function selectFoodsForRide({ foods, level, rideType = 'training' }) {
  if (!Array.isArray(foods)) throw new FuelInputError('foods', 'foods must be an array');
  const S = C.FOOD_SELECTION;
  const profile = rideType === 'race' || level === 'hard' ? 'fast' : level === 'easy' ? 'steady' : 'mixed';
  const order = S.typeOrder[profile];
  const rank = (food) => {
    const i = order.indexOf(food.type);
    return i === -1 ? order.length : i;
  };
  const sorted = foods
    .filter((food) => food && !food.archived)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) ||
        String(a.name ?? '').localeCompare(String(b.name ?? '')),
    );

  const drinks = sorted.filter((f) => (f.fluidMl ?? 0) > 0).slice(0, S.maxDrinks);
  const solids = sorted.filter((f) => !((f.fluidMl ?? 0) > 0) && (f.carbsG ?? 0) > 0).slice(0, S.maxSolids);
  const tabs = sorted
    .filter((f) => !((f.fluidMl ?? 0) > 0) && !((f.carbsG ?? 0) > 0) && (f.sodiumMg ?? 0) > 0)
    .slice(0, S.maxTabs);
  const picked = new Set([...drinks, ...solids, ...tabs]);
  return { mode: 'auto', profile, foods: sorted.filter((f) => picked.has(f)) };
}

/**
 * §7.5 What to carry for the whole ride: servings per food summed over every hour, plus plain water.
 * Works on any plan, including plans saved before this existed.
 * @returns {{ items: { foodId, name, servings }[], plainWaterMl: number }}
 */
export function carryList(plan) {
  const items = [];
  let plainWaterMl = 0;
  for (const block of plan?.schedule ?? []) {
    plainWaterMl += block.plainWaterMl ?? 0;
    for (const item of block.items) {
      const existing = items.find((i) => i.foodId === item.foodId);
      if (existing) existing.servings += item.servings;
      else items.push({ foodId: item.foodId, name: item.name, servings: item.servings });
    }
  }
  return { items, plainWaterMl };
}

// ---------------------------------------------------------------------------
// Logged intake
// ---------------------------------------------------------------------------

/** Totals and per-hour rates for what the rider actually ate and drank. */
export function summarizeIntake({ intake = [], plainWaterMl = 0, foods, durationMin }) {
  checkRange('durationMin', durationMin, C.LIMITS.durationMin, { required: true });
  if (!isNum(plainWaterMl) || plainWaterMl < 0) throw new FuelInputError('plainWaterMl', 'plainWaterMl must be ≥ 0');
  const byId = new Map(validateFoods(foods).map((food) => [food.id, food]));

  const lines = intake.map((entry, i) => {
    const food = byId.get(entry.foodId);
    if (!food) throw new FuelInputError(`intake[${i}].foodId`, `Unknown food: ${entry.foodId}`);
    if (!isNum(entry.servings) || entry.servings < 0) {
      throw new FuelInputError(`intake[${i}].servings`, 'servings must be ≥ 0');
    }
    return { food, servings: entry.servings };
  });

  const total = (key) => sum(lines, (l) => l.servings * l.food[key]);
  const hours = durationMin / 60;
  const carbsG = total('carbsG');
  const fluidMl = total('fluidMl') + plainWaterMl;
  const sodiumMg = total('sodiumMg');

  return {
    carbsG: Math.round(carbsG),
    kcal: Math.round(total('kcal')),
    fluidMl: Math.round(fluidMl),
    sodiumMg: Math.round(sodiumMg),
    carbsGph: Math.round(carbsG / hours),
    fluidMlPerHr: Math.round(fluidMl / hours),
    sodiumMgPerHr: Math.round(sodiumMg / hours),
  };
}

/**
 * §9.0 How what the rider ate compares with the plan (carbs per hour):
 *  'on-plan' ≥ 90% of the target (eating more is fine) · 'under' something, but less · 'none' no carbs at all.
 * A ride whose plan needs no carbs is always 'on-plan'.
 * @returns {{ status: 'on-plan' | 'under' | 'none', pct: number | null }}
 */
export function intakeStatus({ actual, targets }) {
  const eaten = actual?.carbsGph ?? 0;
  const target = targets?.carbsGph ?? 0;
  if (!(target > 0)) return { status: 'on-plan', pct: null };
  const pct = Math.round((eaten / target) * 100);
  if (!(eaten > 0)) return { status: 'none', pct: 0 };
  return { status: eaten >= C.INTAKE_STATUS.onPlanFraction * target ? 'on-plan' : 'under', pct };
}

// ---------------------------------------------------------------------------
// §9 Check-in suggestions
// ---------------------------------------------------------------------------

/** §9.3 Sweat rate in ml/hr from weigh-ins, or null if it can't be measured. */
export function estimateSweatRate({ weightPreKg, weightPostKg, fluidMl = 0, durationMin }) {
  if (!isNum(weightPreKg) || !isNum(weightPostKg) || !isNum(durationMin)) return null;
  if (durationMin < C.SWEAT_RATE.minDurationMin) return null;
  const lostMl = (weightPreKg - weightPostKg) * 1000 + fluidMl;
  const rate = lostMl / (durationMin / 60);
  return roundTo(clamp(rate, C.SWEAT_RATE.minMlPerHr, C.SWEAT_RATE.maxMlPerHr), C.ROUND.sweatRateMlPerHr);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function carbRateSuggestion({ trainedGph, checkIn, history, lastIncreaseDate }) {
  const G = C.GUT_TRAINING;
  const isQualifying = (r) =>
    r.durationMin >= G.qualifyingMinDurationMin && r.actualGph >= trainedGph - G.qualifyingToleranceGph;

  const current = {
    date: checkIn.date,
    durationMin: checkIn.durationMin,
    actualGph: checkIn.actual?.carbsGph ?? 0,
    giScore: checkIn.giScore,
  };
  // reasonCode + reasonParams let apps show the reason in other languages (English stays in `reason`)
  const none = (reasonCode, reason, reasonParams) => ({ suggestedGph: null, change: 0, reason, reasonCode, reasonParams });

  // Rate changes are only suggested right after a ride that actually tested the rate.
  if (!isQualifying(current)) {
    return none('RATE_NOT_TESTED', 'This ride did not test your trained rate (too short or ate below it).');
  }

  if (current.giScore <= G.decreaseMaxGiScore) {
    const suggestedGph = Math.max(G.minRateGph, trainedGph - G.decreaseStepGph);
    if (suggestedGph >= trainedGph) return none('RATE_AT_MIN', 'Already at the minimum rate.');
    return {
      suggestedGph,
      change: suggestedGph - trainedGph,
      reason: `Your stomach struggled at ${current.actualGph} g/hr. Try ${suggestedGph} g/hr for now.`,
      reasonCode: 'RATE_DECREASE',
      reasonParams: { actualGph: current.actualGph, suggestedGph },
    };
  }

  const recent = [current, ...history.filter(isQualifying)].slice(0, G.increaseLookback);
  const allGood = recent.length === G.increaseLookback && recent.every((r) => r.giScore >= G.increaseMinGiScore);
  if (!allGood) return none('RATE_NOT_ENOUGH_RIDES', 'Not enough good long rides at this rate yet.');

  if (isSet(lastIncreaseDate) && isSet(checkIn.date)) {
    const days = (Date.parse(checkIn.date) - Date.parse(lastIncreaseDate)) / DAY_MS;
    if (days < G.increaseCooldownDays) {
      return none('RATE_COOLDOWN', `Your rate went up less than ${G.increaseCooldownDays} days ago.`, {
        days: G.increaseCooldownDays,
      });
    }
  }

  const step = trainedGph < G.smallRateBelowGph ? G.increaseStepSmallRateGph : G.increaseStepGph;
  const suggestedGph = Math.min(G.maxRateGph, trainedGph + step);
  if (suggestedGph <= trainedGph) return none('RATE_AT_MAX', 'Already at the maximum rate.');
  return {
    suggestedGph,
    change: suggestedGph - trainedGph,
    reason: `Your stomach handled ${trainedGph} g/hr well on your last ${G.increaseLookback} long rides. Try ${suggestedGph} g/hr.`,
    reasonCode: 'RATE_INCREASE',
    reasonParams: { trainedGph, rides: G.increaseLookback, suggestedGph },
  };
}

function hydrationFlags(checkIn) {
  const F = C.FLAGS;
  const flags = [];
  const actual = checkIn.actual ?? {};
  const targets = checkIn.targets ?? {};
  // Below 80% of the plan's per-hour target (a target of 0 can't be missed; nothing logged counts as 0)
  const under = (key) => isNum(targets[key]) && targets[key] > 0 && (actual[key] ?? 0) < F.underTargetFraction * targets[key];
  const stomachStruggled = checkIn.giScore <= F.badGiMaxScore;
  const hasWeights = isNum(checkIn.weightPreKg) && isNum(checkIn.weightPostKg);
  const weightChangeKg = hasWeights ? checkIn.weightPostKg - checkIn.weightPreKg : 0;
  const lossPct = hasWeights ? (-weightChangeKg / checkIn.weightPreKg) * 100 : 0;
  const gained = weightChangeKg > F.weightGainKg + EPS;

  // §9.2: under the plan → eat / drink / add sodium, whatever the energy score, unless the stomach
  // struggled (eating more would make that worse: build up gradually instead)
  if (stomachStruggled) {
    flags.push({
      code: 'easy-on-stomach',
      message: 'Your stomach struggled. Stick to foods you know and build up gradually; don’t add more yet.',
    });
  } else if (under('carbsGph')) {
    const eatenGph = Math.round(actual.carbsGph ?? 0);
    flags.push({
      code: 'eat-more',
      message: `You ate ${eatenGph} g/hr of carbs; the plan was ${targets.carbsGph}. Eat closer to your plan next time.`,
      params: { eatenGph, targetGph: targets.carbsGph },
    });
  }
  if (lossPct > F.weightLossPct) {
    flags.push({ code: 'more-fluid', message: 'Drink more next time.' });
  } else if (!stomachStruggled && !gained && under('fluidMlPerHr')) {
    const pct = Math.round(((actual.fluidMlPerHr ?? 0) / targets.fluidMlPerHr) * 100);
    flags.push({
      code: 'drink-more',
      message: `You drank ${pct}% of the planned fluid. Drink more next time.`,
      params: { pct },
    });
  }
  if (gained) {
    flags.push({
      code: 'less-fluid',
      message: 'You gained weight. You may be overdrinking, which can be dangerous. Drink to thirst.',
    });
  }
  // (sodium-optional rides have a target of 0, which can't be missed)
  if (!stomachStruggled && under('sodiumMgPerHr')) {
    const eatenMg = Math.round(actual.sodiumMgPerHr ?? 0);
    flags.push({
      code: 'more-sodium',
      message: `You had ${eatenMg} mg/hr of sodium; the plan was ${targets.sodiumMgPerHr}. Add sodium next time.`,
      params: { eatenMg, targetMg: targets.sodiumMgPerHr },
    });
  }
  return flags;
}

/**
 * §9 Suggestions after a check-in. Never applied automatically.
 * @param {{ trainedGph: number,
 *           checkIn: { date, durationMin, giScore, energyScore, legsScore, bonked?, cramped?,
 *                      targets: { carbsGph, fluidMlPerHr, sodiumMgPerHr },
 *                      actual: { carbsGph, fluidMlPerHr, sodiumMgPerHr, fluidMl? },
 *                      weightPreKg?, weightPostKg? },
 *           history?: { date, durationMin, actualGph, giScore }[],   // previous check-ins, newest first
 *           lastIncreaseDate?: string }} args
 */
export function suggestAdjustments({ trainedGph, checkIn, history = [], lastIncreaseDate = null }) {
  checkRange('trainedGph', trainedGph, C.LIMITS.trainedCarbRateGph, { required: true });
  if (!checkIn || typeof checkIn !== 'object') throw new FuelInputError('checkIn', 'checkIn is required');
  checkRange('durationMin', checkIn.durationMin, C.LIMITS.durationMin, { required: true });
  checkScore('giScore', checkIn.giScore);
  checkScore('energyScore', checkIn.energyScore);
  checkScore('legsScore', checkIn.legsScore);

  return {
    carbRate: carbRateSuggestion({ trainedGph, checkIn, history, lastIncreaseDate }),
    flags: hydrationFlags(checkIn),
    measuredSweatRateMlPerHr: estimateSweatRate({
      weightPreKg: checkIn.weightPreKg,
      weightPostKg: checkIn.weightPostKg,
      fluidMl: checkIn.actual?.fluidMl ?? 0,
      durationMin: checkIn.durationMin,
    }),
  };
}
