import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  bmi, healthyWeightRangeKg,
  bmrMifflinStJeor, bmrHarrisBenedict, bmrKatchMcArdle, bmr,
  tdee, calorieTarget, macros, resolveActivity,
  maxHeartRate, karvonenTargetHr, heartRateZones,
  percentOf1rm, e1rmFromRpe, e1rmEpley, e1rmBrzycki, loadForPrescription,
  lbToKg, inToCm, feetInchesToCm, round,
  InvalidInputError,
} from '../src/index.js';

/* These are published reference values, not snapshots of our own output.
   If a change to the library breaks one of these, the library is wrong. */

describe('units', () => {
  test('pounds to kilograms', () => assert.equal(round(lbToKg(176.37), 2), 80));
  test('inches to centimetres', () => assert.equal(round(inToCm(70), 1), 177.8));
  test('feet and inches to centimetres', () => assert.equal(round(feetInchesToCm(5, 11), 1), 180.3));
});

describe('BMI', () => {
  test('80 kg at 180 cm is 24.7, normal', () => {
    const r = bmi({ weightKg: 80, heightCm: 180 });
    assert.equal(r.bmi, 24.7);
    assert.equal(r.category, 'normal');
  });
  test('category boundaries land on the right side', () => {
    assert.equal(bmi({ weightKg: 59.94, heightCm: 180 }).category, 'underweight'); // 18.5 is normal
    assert.equal(bmi({ weightKg: 81, heightCm: 180 }).category, 'overweight');     // 25.0
    assert.equal(bmi({ weightKg: 97.2, heightCm: 180 }).category, 'obese_1');      // 30.0
    assert.equal(bmi({ weightKg: 130, heightCm: 180 }).category, 'obese_3');       // 40.1
  });
  test('healthy weight range for 180 cm', () => {
    assert.deepEqual(healthyWeightRangeKg(180), { minKg: 59.9, maxKg: 80.7 });
  });
});

describe('BMR', () => {
  test('Mifflin-St Jeor, male 80 kg / 180 cm / 30 y = 1780', () => {
    assert.equal(bmrMifflinStJeor({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 }), 1780);
  });
  test('Mifflin-St Jeor, female 65 kg / 165 cm / 30 y = 1370.3', () => {
    assert.equal(bmrMifflinStJeor({ sex: 'female', weightKg: 65, heightCm: 165, age: 30 }), 1370.3);
  });
  test('Harris-Benedict reads higher than Mifflin-St Jeor for the same man', () => {
    const hb = bmrHarrisBenedict({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 });
    assert.equal(hb, 1853.6);
    assert.ok(hb > 1780);
  });
  test('Katch-McArdle, 80 kg at 15% body fat = 1838.8', () => {
    assert.equal(bmrKatchMcArdle({ weightKg: 80, bodyFatPct: 15 }), 1838.8);
  });
  test('bmr() picks Katch-McArdle only when body fat is supplied', () => {
    assert.equal(bmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 }).formula, 'mifflin-st-jeor');
    assert.equal(bmr({ weightKg: 80, bodyFatPct: 15 }).formula, 'katch-mcardle');
  });
});

describe('TDEE and targets', () => {
  const person = { sex: 'male', weightKg: 80, heightCm: 180, age: 30 };

  test('sedentary multiplier applied to BMR', () => {
    assert.equal(tdee({ ...person, activityLevel: 'sedentary' }).tdee, 2136); // 1780 * 1.2
  });
  test('activity resolves from the exact dropdown label used on the site', () => {
    assert.equal(resolveActivity('Moderate (3-5 days/week)').multiplier, 1.55);
    assert.equal(resolveActivity('moderate').multiplier, 1.55);
  });
  test('a 20% cut is 20% off maintenance', () => {
    const r = calorieTarget({ ...person, activityLevel: 'moderate', goal: 'cut' });
    assert.equal(r.target, round(r.tdee * 0.8, 0));
    assert.deepEqual(r.warnings, []);
  });
  test('an unsafe target returns warnings rather than a bare number', () => {
    const r = calorieTarget({ sex: 'female', weightKg: 50, heightCm: 158, age: 30, activityLevel: 'sedentary', goal: 'aggressive_cut' });
    assert.ok(r.target < r.bmr);
    assert.equal(r.warnings.length, 2);
  });
  test('macros set protein by bodyweight and fill the rest with carbs', () => {
    const m = macros({ calories: 2136, weightKg: 80 });
    assert.equal(m.protein.g, 160);
    assert.equal(m.fat.g, 64);
    assert.equal(m.protein.kcal + m.fat.kcal + m.carbs.kcal, 2136);
  });
});

describe('heart rate', () => {
  test('Tanaka and Fox differ as expected at 30', () => {
    assert.equal(maxHeartRate(30), 187);
    assert.equal(maxHeartRate(30, 'fox'), 190);
  });
  test('Karvonen at 70% of reserve', () => {
    assert.equal(karvonenTargetHr({ maxHr: 190, restingHr: 60, intensity: 0.7 }), 151);
  });
  test('five zones, contiguous, ending at max', () => {
    const z = heartRateZones({ age: 30, restingHr: 60 });
    assert.equal(z.zones.length, 5);
    assert.equal(z.zones[4].maxBpm, z.maxHr);
    for (let i = 1; i < z.zones.length; i++) {
      assert.equal(z.zones[i].minBpm, z.zones[i - 1].maxBpm);
    }
  });
  test('resting above max is rejected', () => {
    assert.throws(() => heartRateZones({ age: 30, restingHr: 200 }));
  });
});

describe('RPE and 1RM', () => {
  test('one rep at RPE 10 is 100% by definition', () => {
    assert.equal(percentOf1rm({ reps: 1, rpe: 10 }), 100);
  });
  test('RPE and reps-in-reserve describe the same effort', () => {
    // 5 reps at RPE 8 leaves 2 in reserve, so it is a 7-rep max effort.
    assert.equal(percentOf1rm({ reps: 5, rpe: 8 }), percentOf1rm({ reps: 7, rpe: 10 }));
    assert.equal(percentOf1rm({ reps: 5, rpe: 8 }), 81.1);
  });
  test('Epley reads higher than Brzycki above five reps', () => {
    assert.equal(e1rmEpley({ weight: 100, reps: 5 }), 116.7);
    assert.equal(e1rmBrzycki({ weight: 100, reps: 5 }), 112.5);
  });
  test('RPE-based 1RM estimate round-trips against the prescription', () => {
    const est = e1rmFromRpe({ weight: 162.5, reps: 5, rpe: 8 });
    assert.ok(Math.abs(est - 200) < 1);
  });
  test('prescribed load rounds to the plate step', () => {
    assert.equal(loadForPrescription({ oneRepMax: 200, reps: 5, rpe: 8 }), 162.5);
  });
});

describe('input validation', () => {
  test('a blank field is an error, not a NaN', () => {
    assert.throws(() => bmrMifflinStJeor({ sex: 'male', weightKg: '', heightCm: 180, age: 30 }), InvalidInputError);
  });
  test('numeric strings from form inputs are accepted', () => {
    assert.equal(bmrMifflinStJeor({ sex: 'Male', weightKg: '80', heightCm: '180', age: '30' }), 1780);
  });
  test('impossible values are rejected', () => {
    assert.throws(() => bmi({ weightKg: -5, heightCm: 180 }), InvalidInputError);
    assert.throws(() => bmrMifflinStJeor({ sex: 'other', weightKg: 80, heightCm: 180, age: 30 }), InvalidInputError);
  });
});
