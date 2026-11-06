// Every number the fueling calculator uses.
// Source of truth: docs/FUELING_RULES.md. Change the spec first, then this file.

// §2 Input validation ranges
export const LIMITS = {
  durationMin: { min: 15, max: 720 },
  workKj: { min: 50, max: 15000 },
  powerW: { min: 30, max: 600 },
  avgHr: { min: 60, max: 220 },
  tempC: { min: -20, max: 50 },
  weightKg: { min: 30, max: 200 },
  trainedCarbRateGph: { min: 20, max: 120 },
  age: { min: 10, max: 100 },
  ftpW: { min: 50, max: 600 },
  lthr: { min: 80, max: 220 },
  maxHr: { min: 100, max: 230 },
  sweatRateMlPerHr: { min: 200, max: 2500 },
  score: { min: 1, max: 5 },
};

export const DEFAULT_TEMP_C = 20;
export const DEFAULT_TRAINED_CARB_RATE_GPH = 60;
export const DEFAULT_SWEAT_SODIUM = 'average';

// §3 Intensity
export const KCAL_PER_KJ = 1.0; // ~24% efficiency cancels the 4.184 kJ/kcal conversion
export const NP_TO_AVG_POWER_RATIO = 1.05; // avg W ≈ NP / 1.05 when only NP is given
export const DEFAULT_FTP_W_PER_KG = 2.5;
export const LTHR_FROM_MAX_HR = 0.9;
export const TANAKA = { intercept: 208, slope: 0.7 }; // max HR = 208 − 0.7 × age

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'];

// §3.1 Coggan power zones → midpoint IF (zones 6–7 are rejected)
export const POWER_ZONE_IF = { 1: 0.45, 2: 0.65, 3: 0.83, 4: 0.98, 5: 1.13 };

// §3.2 Heart-rate zones → midpoint % LTHR
export const HR_ZONE_PCT_LTHR = { 1: 75, 2: 85, 3: 91.5, 4: 96.5, 5: 102 };

// §3.2 %LTHR → IF, interpolated linearly and clamped at both ends
export const HR_PCT_TO_IF_POINTS = [
  [70, 0.45],
  [75, 0.5],
  [85, 0.65],
  [91.5, 0.83],
  [96.5, 0.98],
  [102, 1.1],
];

// §3.3 Keytel et al. (2005): kJ/min, divided by 4.184 → kcal/min
export const KEYTEL = {
  male: { intercept: -55.0969, hr: 0.6309, weightKg: 0.1988, age: 0.2017 },
  female: { intercept: -20.4022, hr: 0.4472, weightKg: -0.1263, age: 0.074 },
  kjPerKcal: 4.184,
};

// §3.4 Intensity levels
export const INTENSITY_LEVEL_MIN_IF = { moderate: 0.65, hard: 0.8 };

// §2 Warning for implausibly hard long rides
export const VERY_HARD_WARNING = { ifAbove: 1.05, durationAboveMin: 60 };

// §4 Carb target by duration band (half-open, minDurationMin inclusive)
export const CARB_TABLE_GPH = [
  { minDurationMin: 0, easy: 0, moderate: 0, hard: 30 },
  { minDurationMin: 60, easy: 30, moderate: 40, hard: 60 },
  { minDurationMin: 90, easy: 40, moderate: 60, hard: 75 },
  { minDurationMin: 150, easy: 60, moderate: 75, hard: 90 },
  { minDurationMin: 240, easy: 60, moderate: 80, hard: 90 },
];
export const MAX_CARB_GPH = 120;
export const MIXED_CARB_TIP_ABOVE_GPH = 60;

// §5 Fluid
export const FLUID = {
  fromSweatRateFraction: 0.7,
  baseByTemp: [
    { minTempC: -Infinity, mlPerHr: 400 },
    { minTempC: 15, mlPerHr: 600 },
    { minTempC: 25, mlPerHr: 750 },
    { minTempC: 30, mlPerHr: 900 },
  ],
  intensityAdjustMl: { easy: -100, moderate: 0, hard: 100 },
  minMlPerHr: 300,
  maxMlPerHr: 1000,
};

// §5.1 Indoor (trainer, Zwift…): no wind cooling → more sweat
export const INDOOR = {
  defaultTempC: 22, // typical room when no temperature is entered
  extraFluidMlPerHr: 150, // added after the base / sweat-rate value, before clamping
};

// §4.1 Ride types
export const RIDE_TYPES = ['training', 'group', 'race'];
export const RACE = { carbLevelBump: 1 }; // race day reads the next-higher intensity column of the carb table

// §9A Events (an upcoming race or group ride planned from last time)
export const EVENT_TYPES = ['race', 'group'];
export const EVENTS = { holdWeeksBeforeEvent: 1 }; // race week: hold the rate, try nothing new

// §6 Sodium
export const SODIUM = {
  mgPerLitre: { low: 300, average: 500, salty: 800 },
  minMgPerHr: 200,
  maxMgPerHr: 1000,
  optionalBelowDurationMin: 90,
  optionalBelowTempC: 25,
};

// §1 Rounding steps
export const ROUND = { carbsGph: 5, fluidMlPerHr: 50, sodiumMgPerHr: 10, plainWaterMl: 50, sweatRateMlPerHr: 10 };

// §7 Schedule
export const SCHEDULE = {
  blockMin: 60,
  minFinalBlockMin: 20,
  maxFoodServingsPerBlock: 4,
  drinkServingStep: 0.5,
  servingStepByType: { gel: 1, bar: 0.5, real: 0.5, electrolyte: 1, drink: 0.5 },
  plainWaterMinGapMl: 100,
  sodiumMinGapMg: 100,
  carbToleranceG: 10,
  spreadNote: 'Spread across the hour: small bites every 15–20 min, sips every 10–15 min.',
};

export const FOOD_TYPES = ['gel', 'bar', 'drink', 'electrolyte', 'real'];
export const SWEAT_SODIUM_LEVELS = Object.keys(SODIUM.mgPerLitre);

// §9.1 Gut training
export const GUT_TRAINING = {
  qualifyingMinDurationMin: 90,
  qualifyingToleranceGph: 5,
  increaseLookback: 3,
  increaseMinGiScore: 4,
  smallRateBelowGph: 60,
  increaseStepSmallRateGph: 10,
  increaseStepGph: 5,
  increaseCooldownDays: 7,
  decreaseMaxGiScore: 2,
  decreaseStepGph: 10,
  minRateGph: 30,
  maxRateGph: 120,
};

// §9.2 Hydration, sodium and eating flags
export const FLAGS = {
  weightLossPct: 2,
  weightGainKg: 0.5,
  underTargetFraction: 0.8,
  heavyLegsMaxScore: 2,
  lowEnergyMaxScore: 2,
  goodGiMinScore: 4,
};

// §9.3 Sweat rate
export const SWEAT_RATE = { minDurationMin: 60, minMlPerHr: 200, maxMlPerHr: 2500 };
