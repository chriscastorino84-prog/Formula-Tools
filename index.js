/**
 * Fitness Applied — calculation engine.
 *
 * One source of truth for every number the website and the app show a user.
 * Pure functions, no dependencies, no network, no state. Metric throughout;
 * convert at the edges with the helpers in units.js.
 *
 * If a formula changes here, it changes in both places. That is the entire
 * point of this package.
 */

export const VERSION = '1.0.0';

export * from './units.js';
export * from './validate.js';
export * from './bmi.js';
export * from './bmr.js';
export * from './tdee.js';
export * from './heartRate.js';
export * from './rpe.js';
