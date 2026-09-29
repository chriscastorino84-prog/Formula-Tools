import { num, oneOf } from './validate.js';
import { round } from './units.js';
import { bmr } from './bmr.js';

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
