import { num, LIMITS } from './validate.js';
import { round } from './units.js';

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
