import { num, LIMITS } from './validate.js';
import { round } from './units.js';

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
