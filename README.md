# @fitnessapplied/formulas

The calculation engine behind the Fitness Applied tools. One source of truth for
the website and the app.

Pure functions. No dependencies, no network, no state. Metric throughout —
convert at the edges with the helpers in `units.js`.

## Why this exists

The formulas currently live inside Velo page code on fitnessapplied.com. The
moment the app reimplements them, they drift: the site uses a 1.55 activity
multiplier, the app uses 1.5, and the same user gets two different calorie
targets with no way to tell which is right.

This package makes that impossible. A formula change happens once, here, and
both platforms take it.

## Why it is not an API

Every calculation in here is arithmetic over a handful of numbers. It runs in
microseconds. Putting it behind HTTP would add a 50–300ms round trip, a server
to keep up, and a dependency on signal — in a gym. It would also mean sending
someone's weight, height and age over the wire for no reason.

An API becomes the right answer later if the programming logic needs to change
without shipping an app update, or if results start feeding server-side state
like saved plans. A thin HTTP wrapper around this package is a day's work when
that day arrives.

## Install

**App:** `npm install @fitnessapplied/formulas` (or a file/git dependency while
it stays private).

**Wix site:** Wix Editor (Classic) has no Git integration and rejects private
npm packages, so the site takes a generated single file:

```
npm run build:velo      # writes dist/formulas.js
```

Paste the whole of `dist/formulas.js` into the Velo **Backend & Public** section
as `public/formulas.js`. It carries a `VERSION` export so you can check what is
actually deployed:

```js
import { VERSION } from 'public/formulas.js';
console.log(VERSION);   // 1.0.0
```

## Use

```js
import { tdee, calorieTarget, macros, bmi, heartRateZones, percentOf1rm } from '@fitnessapplied/formulas';

tdee({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activityLevel: 'moderate' });
// { bmr: 1780, tdee: 2759, formula: 'mifflin-st-jeor', activity: {...} }

calorieTarget({ ...person, activityLevel: 'moderate', goal: 'cut' });
// { ..., target: 2207, warnings: [] }

percentOf1rm({ reps: 5, rpe: 8 });   // 81.1
```

Activity level accepts either the key (`'moderate'`) or the exact dropdown label
used on the site (`'Moderate (3-5 days/week)'`). That second form exists for a
reason — see below.

## Safety behaviour worth knowing

`calorieTarget` returns a `warnings` array rather than throwing or silently
handing back a dangerous number. It fires when a target falls below resting
metabolic rate, or below the conventional floor for unsupervised dieting
(1500 kcal for men, 1200 for women). **Do not drop these on the floor in the
UI.** They are the difference between a calculator and a liability.

Every function validates its inputs and throws `InvalidInputError` rather than
letting a blank form field become a `NaN` calorie target.

## Tests

```
npm test
```

The tests assert published reference values, not snapshots of our own output —
1780 kcal for Mifflin-St Jeor at 80 kg / 180 cm / 30 y, 81.1% of 1RM for 5 reps
at RPE 8, and so on. If a change breaks one, the change is wrong. That suite is
worth more than the functions; the functions are twenty lines each.

## Layout

```
src/units.js       conversions; everything internal is metric
src/validate.js    input guards and InvalidInputError
src/bmi.js         BMI, WHO categories, healthy weight range
src/bmr.js         Mifflin-St Jeor, Harris-Benedict, Katch-McArdle
src/tdee.js        activity multipliers, goals, calorie targets, macros
src/heartRate.js   max HR (Tanaka/Fox), Karvonen, five training zones
src/rpe.js         RPE/RIR chart, e1RM, prescribed loads
scripts/build-velo.mjs  single-file build for the Wix public folder
```

## Not in scope

The shopping list is stateful — a list someone builds and returns to. It needs
storage and sync, which is a different problem from pure calculation. Keep it
out of here or you will end up running a server for six pure functions.
