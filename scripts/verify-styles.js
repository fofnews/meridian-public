// Run after build-meridian-styles.js to assert key properties in both outputs.
// Usage: node scripts/verify-styles.js
import fs from 'fs';
import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dark = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/meridian-dark.style.json'), 'utf8'));
const light = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/meridian-light.style.json'), 'utf8'));

const darkLand = dark.layers.find(l => l.id === 'land');
assert(darkLand?.paint?.['background-color'] === '#222534', 'dark land color');

const darkLabel = dark.layers.find(l => l.id === 'country-label');
assert(darkLabel?.paint?.['text-color'] === '#ffffff', 'dark label color');

assert(dark.layers.find(l => l.id === 'country-borders'), 'dark country-borders layer missing');
assert(dark.sources['country-boundaries'], 'dark country-boundaries source missing');
assert(!dark.layers.find(l => l.id.startsWith('road')), 'dark has road layers (unexpected)');

const lightWater = light.layers.find(l => l.id === 'water');
assert(lightWater?.paint?.['fill-color'] === '#DCE5EC', 'light water color');

const lightLabel = light.layers.find(l => l.id === 'country-label');
assert(lightLabel?.paint?.['text-color'] === '#0A1828', 'light label color');
assert(!light.layers.find(l => l.id.startsWith('road')), 'light has road layers (unexpected)');

function checkBordersPosition(style, name) {
  const bordersIdx = style.layers.findIndex(l => l.id === 'country-borders');
  const firstSymbolIdx = style.layers.findIndex(l => l.type === 'symbol');
  assert(bordersIdx >= 0, `${name}: country-borders missing`);
  assert(firstSymbolIdx < 0 || bordersIdx < firstSymbolIdx, `${name}: country-borders must be before first symbol layer`);
}
checkBordersPosition(dark, 'dark');
checkBordersPosition(light, 'light');

// Self-hosted glyphs + Playfair Display typography
assert(dark.glyphs === '/fonts/{fontstack}/{range}.pbf', 'dark glyphs URL');
assert(light.glyphs === '/fonts/{fontstack}/{range}.pbf', 'light glyphs URL');
const darkCountryFont = dark.layers.find(l => l.id === 'country-label')?.layout?.['text-font'];
assert(Array.isArray(darkCountryFont) && darkCountryFont[0] === 'Playfair Display Bold', 'dark country-label font');
const lightCountryFont = light.layers.find(l => l.id === 'country-label')?.layout?.['text-font'];
assert(Array.isArray(lightCountryFont) && lightCountryFont[0] === 'Playfair Display Bold', 'light country-label font');

console.log('All assertions passed.');
