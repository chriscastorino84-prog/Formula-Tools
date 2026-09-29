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
