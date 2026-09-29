/**
 * Produces one file for the Wix Velo public folder.
 *
 * Wix Editor (Classic) sites have no Git integration and no private npm
 * packages, so the only way to get shared code onto the site is to paste it
 * into Backend & Public. Pasting seven files is seven chances to paste a stale
 * one, so this concatenates the library into a single module with the internal
 * imports resolved away.
 *
 * Run: npm run build:velo
 * Then: copy dist/formulas.js into the Velo public folder as formulas.js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['units.js', 'validate.js', 'bmi.js', 'bmr.js', 'tdee.js', 'heartRate.js', 'rpe.js'];

const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const body = ORDER.map((file) => {
  const src = readFileSync(join(root, 'src', file), 'utf8');
  const stripped = src
    .split('\n')
    .filter((line) => !/^\s*import\s.+from\s+'\.\/.+';\s*$/.test(line))
    .join('\n')
    .trim();
  return `/* ${'='.repeat(68)}\n   ${file}\n   ${'='.repeat(68)} */\n\n${stripped}`;
}).join('\n\n');

const out = `/**
 * Fitness Applied — calculation engine v${version}
 *
 * GENERATED FILE. Do not edit here.
 * Source of truth: the @fitnessapplied/formulas repository.
 * Rebuild with \`npm run build:velo\` and paste the whole file back in.
 *
 * Built ${new Date().toISOString().slice(0, 10)}
 *
 * Usage in Velo page code:
 *   import { tdee, bmi } from 'public/formulas.js';
 */

export const VERSION = '${version}';

${body}
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'formulas.js'), out, 'utf8');
console.log(`dist/formulas.js  ${out.length} bytes  v${version}  (${ORDER.length} modules)`);
