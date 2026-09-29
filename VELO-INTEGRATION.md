# Wiring the site's calculators to the shared engine

One worked example. The other calculators follow the same shape.

## Before you start: a bug on the BMR page

The Gender and Activity Level dropdowns on `/bmr-calculator` have the right
**labels** but leftover template **values**:

| Label shown to the user | Value stored |
|---|---|
| Male | `Australia` |
| Female | `Canada` |
| Sedentary (little/no exercise) | `Australia` |
| Light (1-3 days/week) | `Canada` |
| Moderate (3-5 days/week) | `Item 1` |
| Active (6-7 days/week) | `Item 2` |
| Very Active (physical job/2x per day) | `Item 3` |

Any page code switching on `.value` is matching against `"Australia"`. It works
until someone edits a dropdown, then it silently returns the wrong multiplier —
the worst kind of failure, because the calculator still produces a plausible
number.

Two ways out. Fix the values in the Editor to `male`/`female` and
`sedentary`/`light`/`moderate`/`active`/`very_active`, which is the clean fix.
Or read the label instead of the value, which `resolveActivity` supports
deliberately so this can be fixed without an Editor pass:

```js
const activityLabel = $w('#activityDropdown').options
  .find(o => o.value === $w('#activityDropdown').value).label;
```

## Page code

```js
import { calorieTarget, macros, InvalidInputError } from 'public/formulas.js';

$w.onReady(() => {
  $w('#calculateButton').onClick(() => {
    $w('#resultText').text = '';
    $w('#warningText').collapse();

    try {
      const result = calorieTarget({
        sex:           $w('#genderDropdown').value,     // after fixing values
        age:           $w('#ageInput').value,
        heightCm:      $w('#heightInput').value,
        weightKg:      $w('#weightInput').value,
        activityLevel: $w('#activityDropdown').value,
        goal:          'maintain',
      });

      const m = macros({ calories: result.target, weightKg: $w('#weightInput').value });

      $w('#resultText').text =
        `BMR ${result.bmr} kcal · Maintenance ${result.tdee} kcal\n` +
        `Protein ${m.protein.g}g · Fat ${m.fat.g}g · Carbs ${m.carbs.g}g`;

      // Never swallow these.
      if (result.warnings.length) {
        $w('#warningText').text = result.warnings.join(' ');
        $w('#warningText').expand();
      }
    } catch (err) {
      $w('#resultText').text = err instanceof InvalidInputError
        ? err.message
        : 'Something went wrong. Please check your entries.';
    }
  });
});
```

Element IDs above are placeholders — substitute the Velo nicknames from the
page. The live comp IDs on `/bmr-calculator` are `comp-mtqglxxs` (age),
`comp-mtqgoxwx` (height cm), `comp-mtqgq0cp` (weight kg), `comp-mtqgs1vm`
(gender) and `comp-mtqgz1ep` (activity).

## Updating later

1. Change the formula in the repo, with a test covering it.
2. `npm test`
3. `npm run build:velo`
4. Paste `dist/formulas.js` over `public/formulas.js` in the Editor, publish.
5. Confirm with `import { VERSION } from 'public/formulas.js'`.

Step 4 is manual because Classic Editor sites have no Git integration. That is
the main argument for keeping this library small and changing it rarely.
