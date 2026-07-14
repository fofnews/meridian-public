#!/usr/bin/env node
// Diagnostic: log which overlay recipes fire per shot.
// Usage: node scripts/diag-recipes.js --edition=2026-07-13-evening

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pickOverlayRecipes } from './shot-recipes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v = 'true'] = a.slice(2).split('='); return [k, v]; })
);
const edition = args['edition'];
if (!edition) { console.error('--edition required'); process.exit(1); }

const shotlist = JSON.parse(readFileSync(join(ROOT, 'out', 'shotlists', `${edition}.json`), 'utf8'));
const shots = shotlist.shots;

const ALL_TREATMENTS = [
  'label-bloom','ripple-expand','map-annotation','spotlight-mask',
  'context-strip','escalation-warning','impact-radius','magnitude-bubble',
  'hatched-zone','route-reveal','flow-arrow','particle-trail',
  'arc-token','side-by-side-callout','connection-arc',
];

const tally = Object.fromEntries(ALL_TREATMENTS.map(t => [t, 0]));
const shotRows = [];

for (let i = 0; i < shots.length; i++) {
  const shot = shots[i];
  const tStart = shot.t;
  const recipes = pickOverlayRecipes(shot, tStart);
  const types = recipes.map(r => r.type);
  types.forEach(t => { if (tally[t] != null) tally[t]++; });

  const cameraPath = shot.cameraPath ?? [];
  const namedWps = cameraPath.filter(wp => wp.highlight?.name);
  const seen = new Set();
  for (const wp of cameraPath) {
    if (wp.lng != null && wp.lat != null && (wp.zoom ?? 10) > 2)
      seen.add(`${wp.lng.toFixed(2)},${wp.lat.toFixed(2)}`);
  }
  const numLocs = seen.size;
  const names = [...new Set(namedWps.map(wp => wp.highlight.name))];

  shotRows.push({
    i,
    shotIntent: shot.shotIntent ?? '—',
    dominantIntent: shot.dominantIntent ?? '—',
    isEstablish: shot.isEstablish ?? false,
    numLocs,
    names,
    types,
    narration: (shot.narration ?? '').slice(0, 80),
  });
}

// ── Per-shot table ────────────────────────────────────────────────────────────
console.log('\n═══ RECIPES PER SHOT ═══\n');
for (const row of shotRows) {
  const recipeStr = row.types.length ? row.types.join(', ') : '(none)';
  const establish = row.isEstablish ? ' [ESTABLISH]' : '';
  console.log(`Shot ${row.i}${establish}  shotIntent=${row.shotIntent}  dominantIntent=${row.dominantIntent}  locs=${row.numLocs}  names=[${row.names.join(', ')}]`);
  console.log(`  narration: "${row.narration}${row.narration.length >= 80 ? '…' : ''}"`);
  console.log(`  recipes:   ${recipeStr}`);
  console.log();
}

// ── Summary ───────────────────────────────────────────────────────────────────
const emptyShots   = shotRows.filter(r => r.types.length === 0);
const loadedShots  = shotRows.filter(r => r.types.length > 0);
const overloaded   = shotRows.filter(r => r.types.length >= 3);
console.log(`═══ SUMMARY ═══`);
console.log(`Total shots:      ${shots.length}`);
console.log(`With recipes:     ${loadedShots.length} (shots ${loadedShots.map(r => r.i).join(', ')})`);
console.log(`Empty shots:      ${emptyShots.length} (shots ${emptyShots.map(r => r.i).join(', ')})`);
console.log(`Overloaded (≥3):  ${overloaded.length} (shots ${overloaded.map(r => r.i).join(', ')})`);

// ── Recipe distribution ────────────────────────────────────────────────────────
console.log('\n═══ RECIPE DISTRIBUTION ═══\n');
const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
for (const [type, count] of sorted) {
  const bar = '█'.repeat(count);
  console.log(`  ${type.padEnd(24)} ${bar || '·'}  (${count})`);
}

const unused = ALL_TREATMENTS.filter(t => tally[t] === 0);
if (unused.length) {
  console.log(`\nTreatments not fired: ${unused.join(', ')}`);
}
