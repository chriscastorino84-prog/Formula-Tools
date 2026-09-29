/**
 * Fitness Applied — calculation engine v1.0.0
 *
 * GENERATED FILE. Do not edit here.
 * Source of truth: the @fitnessapplied/formulas repository.
 * Rebuild with `npm run build:velo` and paste the whole file back in.
 *
 * Built 2026-09-29
 *
 * Usage in Velo page code:
 *   import { tdee, bmi } from 'public/formulas.js';
 */

export const VERSION = '1.0.0';

/* ====================================================================
   units.js
   ==================================================================== */

/**
 * Unit conversion. Every formula in this library works in metric.
 * Convert at the edges, never in the middle of a calculation.
 */

export const LB_PER_KG = 2.2046226218;
export const CM_PER_INCH = 2.54;

/** @param {number} lb @returns {number} kilograms */
export const lbToKg = (lb) => lb / LB_PER_KG;

/** @param {number} kg @returns {number} pounds */
export const kgToLb = (kg) => kg * LB_PER_KG;

/** @param {number} inches @returns {number} centimetres */
export const inToCm = (inches) => inches * CM_PER_INCH;

/** @param {number} cm @returns {number} inches */
export const cmToIn = (cm) => cm / CM_PER_INCH;

/**
 * Feet and inches to centimetres.
 * @param {number} feet
 * @param {number} [inches=0]
 * @returns {number} centimetres
 */
export const feetInchesToCm = (feet, inches = 0) => inToCm(feet * 12 + inches);

/**
 * Round to a fixed number of decimal places without floating-point drift.
 * @param {number} value
 * @param {number} [places=0]
 * @returns {number}
 */
export function round(value, places = 0) {
  const f = Math.pow(10, places);
  return Math.round((value + Number.EPSILON) * f) / f;
}

/* ====================================================================
   validate.js
   ==================================================================== */

/**
 * Input guards. These exist because the calculators are public-facing: a user
 * can and will type a negative age or leave a field blank, and a silent NaN
 * propagating into a calorie target is worse than an error.
 */

export class InvalidInputError extends Error {
  /** @param {string} field @param {string} message */
  constructor(field, message) {
    super(`${field}: ${message}`);
    this.name = 'InvalidInputError';
    this.field = field;
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {{min?: number, max?: number}} [range]
 * @returns {number}
 */
export function num(value, field, range = {}) {
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new InvalidInputError(field, 'must be a number');
  }
  if (range.min !== undefined && n < range.min) {
    throw new InvalidInputError(field, `must be at least ${range.min}`);
  }
  if (range.max !== undefined && n > range.max) {
    throw new InvalidInputError(field, `must be at most ${range.max}`);
  }
  return n;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {readonly string[]} allowed
 * @returns {string}
 */
export function oneOf(value, field, allowed) {
  const v = String(value ?? '').trim().toLowerCase();
  const match = allowed.find((a) => a.toLowerCase() === v);
  if (!match) {
    throw new InvalidInputError(field, `must be one of: ${allowed.join(', ')}`);
  }
  return match;
}

/** Plausible human ranges, used by every calculator that takes these. */
export const LIMITS = {
  age: { min: 1, max: 120 },
  heightCm: { min: 50, max: 260 },
  weightKg: { min: 15, max: 500 },
  bodyFatPct: { min: 1, max: 75 },
  restingHr: { min: 25, max: 140 },
  reps: { min: 1, max: 12 },
};

/* ====================================================================
   bmi.js
   ==================================================================== */

/**
 * WHO body mass index categories.
 * Boundaries are inclusive of the lower bound, exclusive of the upper.
 * @type {ReadonlyArray<{key:string,label:string,min:number,max:number}>}
 */
export const BMI_CATEGORIES = Object.freeze([
  { key: 'underweight',    label: 'Underweight',        min: 0,    max: 18.5 },
  { key: 'normal',         label: 'Normal weight',      min: 18.5, max: 25 },
  { key: 'overweight',     label: 'Overweight',         min: 25,   max: 30 },
  { key: 'obese_1',        label: 'Obese (class I)',    min: 30,   max: 35 },
  { key: 'obese_2',        label: 'Obese (class II)',   min: 35,   max: 40 },
  { key: 'obese_3',        label: 'Obese (class III)',  min: 40,   max: Infinity },
]);

/**
 * Body mass index.
 *
 * BMI is a population screening tool, not a body-composition measure. It does
 * not distinguish muscle from fat, so it misclassifies lean, heavily trained
 * people as overweight. Present it with that caveat or not at all.
 *
 * @param {{weightKg:number, heightCm:number}} input
 * @returns {{bmi:number, category:string, categoryLabel:string}}
 */
export function bmi({ weightKg, heightCm }) {
  const w = num(weightKg, 'weightKg', LIMITS.weightKg);
  const h = num(heightCm, 'heightCm', LIMITS.heightCm);
  const metres = h / 100;
  const value = w / (metres * metres);
  const cat = BMI_CATEGORIES.find((c) => value >= c.min && value < c.max) ?? BMI_CATEGORIES[BMI_CATEGORIES.length - 1];
  return { bmi: round(value, 1), category: cat.key, categoryLabel: cat.label };
}

/**
 * The weight range that would put this height in the normal BMI band.
 * @param {number} heightCm
 * @returns {{minKg:number, maxKg:number}}
 */
export function healthyWeightRangeKg(heightCm) {
  const h = num(heightCm, 'heightCm', LIMITS.heightCm) / 100;
  return { minKg: round(18.5 * h * h, 1), maxKg: round(24.9 * h * h, 1) };
}

/* ====================================================================
   bmr.js
   ==================================================================== */

export const SEXES = Object.freeze(['male', 'female']);

/**
 * Mifflin-St Jeor (1990). The default, and the one to use when body-fat
 * percentage is unknown. Validated as more accurate than Harris-Benedict for
 * contemporary populations.
 *
 * @param {{sex:string, weightKg:number, heightCm:number, age:number}} input
 * @returns {number} kcal/day at complete rest
 */
export function bmrMifflinStJeor({ sex, weightKg, heightCm, age }) {
  const s = oneOf(sex, 'sex', SEXES);
  const w = num(weightKg, 'weightKg', LIMITS.weightKg);
  const h = num(heightCm, 'heightCm', LIMITS.heightCm);
  const a = num(age, 'age', LIMITS.age);
  const base = 10 * w + 6.25 * h - 5 * a;
  return round(s === 'male' ? base + 5 : base - 161, 1);
}

/**
 * Harris-Benedict, Roza & Shizgal 1984 revision. Included for comparison;
 * it tends to read slightly high against Mifflin-St Jeor.
 *
 * @param {{sex:string, weightKg:number, heightCm:number, age:number}} input
 * @returns {number} kcal/day
 */
export function bmrHarrisBenedict({ sex, weightKg, heightCm, age }) {
  const s = oneOf(sex, 'sex', SEXES);
  const w = num(weightKg, 'weightKg', LIMITS.weightKg);
  const h = num(heightCm, 'heightCm', LIMITS.heightCm);
  const a = num(age, 'age', LIMITS.age);
  return round(
    s === 'male'
      ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * a
      : 447.593 + 9.247 * w + 3.098 * h - 4.330 * a,
    1
  );
}

/**
 * Katch-McArdle. Drives off lean body mass, so it is the most accurate of the
 * three when body-fat percentage is actually known — and the least accurate
 * when that number is a guess, which it usually is.
 *
 * @param {{weightKg:number, bodyFatPct:number}} input
 * @returns {number} kcal/day
 */
export function bmrKatchMcArdle({ weightKg, bodyFatPct }) {
  const w = num(weightKg, 'weightKg', LIMITS.weightKg);
  const bf = num(bodyFatPct, 'bodyFatPct', LIMITS.bodyFatPct);
  const leanMassKg = w * (1 - bf / 100);
  return round(370 + 21.6 * leanMassKg, 1);
}

/**
 * Picks the best available formula for the inputs given: Katch-McArdle when a
 * real body-fat figure is supplied, Mifflin-St Jeor otherwise.
 *
 * @param {{sex?:string, weightKg:number, heightCm?:number, age?:number, bodyFatPct?:number}} input
 * @returns {{bmr:number, formula:string}}
 */
export function bmr(input) {
  if (input.bodyFatPct !== undefined && input.bodyFatPct !== null && input.bodyFatPct !== '') {
    return { bmr: bmrKatchMcArdle(input), formula: 'katch-mcardle' };
  }
  return { bmr: bmrMifflinStJeor(input), formula: 'mifflin-st-jeor' };
}

/* ====================================================================
   tdee.js
   ==================================================================== */

/**
 * Activity multipliers. The labels match the dropdown on the live site exactly,
 * so page code can map the selected label straight to a key without a lookup
 * table of its own drifting out of sync.
 * @type {ReadonlyArray<{key:string,label:string,multiplier:number}>}
 */
export const ACTIVITY_LEVELS = Object.freeze([
  { key: 'sedentary',   label: 'Sedentary (little/no exercise)',          multiplier: 1.2 },
  { key: 'light',       label: 'Light (1-3 days/week)',                   multiplier: 1.375 },
  { key: 'moderate',    label: 'Moderate (3-5 days/week)',                multiplier: 1.55 },
  { key: 'active',      label: 'Active (6-7 days/week)',                  multiplier: 1.725 },
  { key: 'very_active', label: 'Very Active (physical job/2x per day)',   multiplier: 1.9 },
]);

const ACTIVITY_KEYS = ACTIVITY_LEVELS.map((l) => l.key);

/**
 * Accepts either the key or the exact dropdown label.
 * @param {string} value
 * @returns {{key:string,label:string,multiplier:number}}
 */
export function resolveActivity(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  const byLabel = ACTIVITY_LEVELS.find((l) => l.label.toLowerCase() === raw);
  if (byLabel) return byLabel;
  const key = oneOf(raw, 'activityLevel', ACTIVITY_KEYS);
  return ACTIVITY_LEVELS.find((l) => l.key === key);
}

/**
 * Goal adjustments, expressed as a percentage of maintenance rather than a flat
 * calorie figure, because a 500 kcal deficit is a very different stimulus for a
 * 1,900 kcal maintenance than for a 3,400 kcal one.
 * @type {ReadonlyArray<{key:string,label:string,adjustment:number}>}
 */
export const GOALS = Object.freeze([
  { key: 'aggressive_cut', label: 'Aggressive fat loss', adjustment: -0.25 },
  { key: 'cut',            label: 'Fat loss',            adjustment: -0.20 },
  { key: 'mild_cut',       label: 'Slow fat loss',       adjustment: -0.10 },
  { key: 'maintain',       label: 'Maintain',            adjustment: 0 },
  { key: 'mild_gain',      label: 'Lean gain',           adjustment: 0.10 },
  { key: 'gain',           label: 'Gain',                adjustment: 0.15 },
]);

/**
 * Lowest daily intake this library will recommend without attaching a warning.
 * These are the conventional clinical floors for unsupervised dieting.
 */
export const INTAKE_FLOOR_KCAL = Object.freeze({ male: 1500, female: 1200 });

/**
 * Total daily energy expenditure.
 *
 * @param {{sex?:string, weightKg:number, heightCm?:number, age?:number, bodyFatPct?:number, activityLevel:string}} input
 * @returns {{bmr:number, tdee:number, formula:string, activity:{key:string,label:string,multiplier:number}}}
 */
export function tdee(input) {
  const { bmr: base, formula } = bmr(input);
  const activity = resolveActivity(input.activityLevel);
  return { bmr: base, tdee: round(base * activity.multiplier, 0), formula, activity };
}

/**
 * A calorie target for a goal, with the guardrails that matter.
 *
 * Two warnings can come back. Dropping below BMR means eating less than the
 * body burns at complete rest; dropping below the clinical floor is the point
 * at which unsupervised dieting stops being reasonable advice. Both are
 * returned rather than thrown, so the caller decides how to present them — but
 * they should never be dropped silently.
 *
 * @param {{sex?:string, weightKg:number, heightCm?:number, age?:number, bodyFatPct?:number, activityLevel:string, goal?:string}} input
 * @returns {{bmr:number, tdee:number, target:number, goal:{key:string,label:string,adjustment:number}, formula:string, warnings:string[]}}
 */
export function calorieTarget(input) {
  const base = tdee(input);
  const goalKey = oneOf(input.goal ?? 'maintain', 'goal', GOALS.map((g) => g.key));
  const goal = GOALS.find((g) => g.key === goalKey);
  const target = round(base.tdee * (1 + goal.adjustment), 0);

  const warnings = [];
  if (target < base.bmr) {
    warnings.push('This target is below your resting metabolic rate. Consider a smaller deficit or more activity.');
  }
  const sex = String(input.sex ?? '').toLowerCase();
  const floor = INTAKE_FLOOR_KCAL[sex];
  if (floor && target < floor) {
    warnings.push(`This target is below ${floor} kcal, the usual lower limit for dieting without medical supervision.`);
  }
  return { ...base, target, goal, warnings };
}

/**
 * Macronutrient split from a calorie target. Protein is set per kilogram of
 * bodyweight rather than as a percentage, because protein need tracks body
 * mass, not energy intake — a percentage split silently under-feeds protein
 * on a cut, which is exactly when it matters most.
 *
 * @param {{calories:number, weightKg:number, proteinPerKg?:number, fatPerKg?:number}} input
 * @returns {{protein:{g:number,kcal:number}, fat:{g:number,kcal:number}, carbs:{g:number,kcal:number}}}
 */
export function macros({ calories, weightKg, proteinPerKg = 2.0, fatPerKg = 0.8 }) {
  const kcal = num(calories, 'calories', { min: 500, max: 10000 });
  const w = num(weightKg, 'weightKg', { min: 15, max: 500 });
  const proteinG = round(w * num(proteinPerKg, 'proteinPerKg', { min: 0.5, max: 4 }), 0);
  const fatG = round(w * num(fatPerKg, 'fatPerKg', { min: 0.3, max: 3 }), 0);
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbsKcal = Math.max(0, kcal - proteinKcal - fatKcal);
  return {
    protein: { g: proteinG, kcal: proteinKcal },
    fat: { g: fatG, kcal: fatKcal },
    carbs: { g: round(carbsKcal / 4, 0), kcal: round(carbsKcal, 0) },
  };
}

/* ====================================================================
   heartRate.js
   ==================================================================== */

/**
 * Maximum heart rate.
 *
 * Tanaka (2001) is the default: 220-age is the figure everyone knows, but it
 * was never derived from a proper regression and drifts badly at both ends of
 * the age range. Tanaka overestimates less for older athletes.
 *
 * Both are population estimates with a standard deviation around 10-12 bpm.
 * An individual's true max can sit well outside either number, which is why
 * the zones below are worth presenting as ranges, not targets.
 *
 * @param {number} age
 * @param {'tanaka'|'fox'} [formula='tanaka']
 * @returns {number} bpm
 */
export function maxHeartRate(age, formula = 'tanaka') {
  const a = num(age, 'age', LIMITS.age);
  return round(formula === 'fox' ? 220 - a : 208 - 0.7 * a, 0);
}

/**
 * Karvonen target heart rate, based on heart rate reserve.
 *
 * Preferred over a flat percentage of max because it accounts for resting
 * heart rate, so it stays meaningful as someone's conditioning improves.
 *
 * @param {{age?:number, maxHr?:number, restingHr:number, intensity:number}} input
 *        intensity is a fraction: 0.7 for 70%
 * @returns {number} bpm
 */
export function karvonenTargetHr({ age, maxHr, restingHr, intensity }) {
  const max = maxHr !== undefined ? num(maxHr, 'maxHr', { min: 100, max: 230 }) : maxHeartRate(age);
  const rest = num(restingHr, 'restingHr', LIMITS.restingHr);
  const i = num(intensity, 'intensity', { min: 0.3, max: 1 });
  if (rest >= max) {
    throw new Error('restingHr must be lower than maxHr');
  }
  return round((max - rest) * i + rest, 0);
}

/**
 * The five training zones, as fractions of heart rate reserve.
 * @type {ReadonlyArray<{zone:number,key:string,label:string,purpose:string,min:number,max:number}>}
 */
export const HR_ZONES = Object.freeze([
  { zone: 1, key: 'recovery',  label: 'Zone 1 - Recovery',   purpose: 'Warm-up, cool-down, easy movement between hard days.', min: 0.50, max: 0.60 },
  { zone: 2, key: 'aerobic',   label: 'Zone 2 - Aerobic',    purpose: 'Conversational pace. The bulk of endurance work belongs here.', min: 0.60, max: 0.70 },
  { zone: 3, key: 'tempo',     label: 'Zone 3 - Tempo',      purpose: 'Comfortably hard. Improves sustainable pace.', min: 0.70, max: 0.80 },
  { zone: 4, key: 'threshold', label: 'Zone 4 - Threshold',  purpose: 'Hard. Raises the ceiling on what you can hold.', min: 0.80, max: 0.90 },
  { zone: 5, key: 'maximal',   label: 'Zone 5 - Maximal',    purpose: 'Short intervals only. Minutes per session, not more.', min: 0.90, max: 1.00 },
]);

/**
 * All five zones as bpm ranges for a given person.
 *
 * @param {{age?:number, maxHr?:number, restingHr:number, formula?:'tanaka'|'fox'}} input
 * @returns {{maxHr:number, restingHr:number, reserve:number, zones:Array<{zone:number,key:string,label:string,purpose:string,minBpm:number,maxBpm:number}>}}
 */
export function heartRateZones({ age, maxHr, restingHr, formula = 'tanaka' }) {
  const max = maxHr !== undefined ? num(maxHr, 'maxHr', { min: 100, max: 230 }) : maxHeartRate(age, formula);
  const rest = num(restingHr, 'restingHr', LIMITS.restingHr);
  if (rest >= max) {
    throw new Error('restingHr must be lower than maxHr');
  }
  return {
    maxHr: max,
    restingHr: rest,
    reserve: max - rest,
    zones: HR_ZONES.map((z) => ({
      zone: z.zone,
      key: z.key,
      label: z.label,
      purpose: z.purpose,
      minBpm: round((max - rest) * z.min + rest, 0),
      maxBpm: round((max - rest) * z.max + rest, 0),
    })),
  };
}

/* ====================================================================
   rpe.js
   ==================================================================== */

/**
 * Percentage of one-rep max by the number of reps that could be completed to
 * failure. Index 0 is one rep.
 *
 * This single table drives everything below, because RPE and reps-in-reserve
 * are the same information stated differently: a set of 5 at RPE 8 has 2 reps
 * in reserve, which is a 7-rep max effort, which is 81.1% of 1RM.
 * @type {ReadonlyArray<number>}
 */
const PCT_BY_REPS_TO_FAILURE = Object.freeze([
  100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 74.0, 71.8, 69.4,
]);

/** @type {ReadonlyArray<{rpe:number,rir:number,label:string}>} */
export const RPE_SCALE = Object.freeze([
  { rpe: 10,  rir: 0,   label: 'Maximal. No more reps possible.' },
  { rpe: 9.5, rir: 0.5, label: 'Could maybe manage one more.' },
  { rpe: 9,   rir: 1,   label: 'One rep left in the tank.' },
  { rpe: 8.5, rir: 1.5, label: 'One certain, possibly two.' },
  { rpe: 8,   rir: 2,   label: 'Two reps left.' },
  { rpe: 7.5, rir: 2.5, label: 'Two certain, possibly three.' },
  { rpe: 7,   rir: 3,   label: 'Three reps left. Weight moves quickly.' },
  { rpe: 6.5, rir: 3.5, label: 'Three certain, possibly four.' },
  { rpe: 6,   rir: 4,   label: 'Four or more left. Warm-up territory.' },
]);

/**
 * Linear interpolation into the table, so half-point RPEs work.
 * @param {number} repsToFailure
 * @returns {number} percentage of 1RM
 */
function pctAt(repsToFailure) {
  if (repsToFailure <= 1) return PCT_BY_REPS_TO_FAILURE[0];
  const max = PCT_BY_REPS_TO_FAILURE.length;
  if (repsToFailure >= max) return PCT_BY_REPS_TO_FAILURE[max - 1];
  const lower = Math.floor(repsToFailure);
  const frac = repsToFailure - lower;
  const a = PCT_BY_REPS_TO_FAILURE[lower - 1];
  const b = PCT_BY_REPS_TO_FAILURE[lower];
  return a + (b - a) * frac;
}

/**
 * Percentage of 1RM for a given reps-at-RPE prescription.
 * @param {{reps:number, rpe:number}} input
 * @returns {number} percentage, e.g. 81.1
 */
export function percentOf1rm({ reps, rpe }) {
  const r = num(reps, 'reps', LIMITS.reps);
  const e = num(rpe, 'rpe', { min: 6, max: 10 });
  return round(pctAt(r + (10 - e)), 1);
}

/**
 * Estimated 1RM from a set taken to a known RPE. More honest than an Epley
 * estimate off a hard set, because it uses the reps actually left in reserve
 * rather than assuming the set went to failure.
 *
 * @param {{weight:number, reps:number, rpe:number}} input
 * @returns {number} estimated 1RM, in whatever unit weight was given
 */
export function e1rmFromRpe({ weight, reps, rpe }) {
  const w = num(weight, 'weight', { min: 1, max: 1000 });
  return round(w / (percentOf1rm({ reps, rpe }) / 100), 1);
}

/**
 * Epley estimate. Assumes the set was taken to failure.
 * @param {{weight:number, reps:number}} input
 * @returns {number}
 */
export function e1rmEpley({ weight, reps }) {
  const w = num(weight, 'weight', { min: 1, max: 1000 });
  const r = num(reps, 'reps', { min: 1, max: 30 });
  return round(w * (1 + r / 30), 1);
}

/**
 * Brzycki estimate. Reads lower than Epley above about five reps.
 * @param {{weight:number, reps:number}} input
 * @returns {number}
 */
export function e1rmBrzycki({ weight, reps }) {
  const w = num(weight, 'weight', { min: 1, max: 1000 });
  const r = num(reps, 'reps', { min: 1, max: 30 });
  if (r >= 37) throw new Error('reps out of range for Brzycki');
  return round(w * (36 / (37 - r)), 1);
}

/**
 * Working weight for a prescription, given a known or estimated 1RM.
 *
 * @param {{oneRepMax:number, reps:number, rpe:number, roundToKg?:number}} input
 * @returns {number}
 */
export function loadForPrescription({ oneRepMax, reps, rpe, roundToKg = 2.5 }) {
  const max = num(oneRepMax, 'oneRepMax', { min: 1, max: 1000 });
  const pct = percentOf1rm({ reps, rpe }) / 100;
  const step = num(roundToKg, 'roundToKg', { min: 0.5, max: 10 });
  return round(Math.round((max * pct) / step) * step, 2);
}
