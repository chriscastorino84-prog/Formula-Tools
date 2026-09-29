import { num, oneOf, LIMITS } from './validate.js';
import { round } from './units.js';

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
