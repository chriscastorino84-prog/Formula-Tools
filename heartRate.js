import { num, LIMITS } from './validate.js';
import { round } from './units.js';

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
