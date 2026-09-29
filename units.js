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
