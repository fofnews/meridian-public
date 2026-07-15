# Shot Intent + isEstablish Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two recipe dispatch gaps: `spotlight-mask` never fires because `isEstablish` is keyed to report-array index 0; and 14/15 overlay treatments never fire because `dominantIntent` (set post-TTS) always resolves to `reveal` due to first-mention sentence bias.

**Architecture:** Add `classifyShotIntent(narration)` to `intent-classifier.js` — scans full narration for data/stakes/contrast signals with a unit post-filter to avoid false positives from written ages/years. `build-shotlist.js` calls it per story shot and stores the result as `shot.shotIntent`. `pickOverlayRecipes` resolves intent as `shot.shotIntent ?? shot.dominantIntent ?? null` so shotIntent (full-narration) takes precedence over dominantIntent (anchor-sentence, post-TTS). `isEstablish` is fixed to mark the first shot with any storyIndex, not storyIndex===0.

**Tech Stack:** Node.js ESM, Vitest

---

## File Map

| File | Change |
|------|--------|
| `scripts/intent-classifier.js` | Add `classifyShotIntent(narration)` export + `UNIT_RE` constant |
| `scripts/__tests__/intent-classifier.test.js` | Add tests for `classifyShotIntent` |
| `scripts/build-shotlist.js` | Fix `isEstablish` (1 line); import + call `classifyShotIntent`; set `shot.shotIntent` |
| `scripts/shot-recipes.js` | Change intent resolution to `shot.shotIntent ?? shot.dominantIntent ?? null` |
| `scripts/__tests__/shot-recipes.test.js` | Add test verifying `shotIntent` takes precedence over `dominantIntent` |
| `scripts/diag-recipes.js` | Remove backfill logic; read `shotIntent` from shotlist directly |

---

## Task 1: Add `classifyShotIntent` to intent-classifier.js

**Files:**
- Modify: `scripts/intent-classifier.js`
- Modify: `scripts/__tests__/intent-classifier.test.js`

- [ ] **Step 1: Write failing tests**

Add to `scripts/__tests__/intent-classifier.test.js` (after the existing `splitIntoSentences` describe block):

```js
import { describe, it, expect } from 'vitest';
import { classifyIntent, splitIntoSentences, classifyShotIntent } from '../intent-classifier.js';
```

Replace the existing import line (it currently only imports `classifyIntent, splitIntoSentences`) with the above.

Then add at the bottom of the file:

```js
describe('classifyShotIntent', () => {
  it('returns null for narration with no signals', () => {
    expect(classifyShotIntent('Senator Graham died at the age of seventy-one.')).toBeNull();
  });

  it('returns null for a year reference (written number, no unit)', () => {
    expect(classifyShotIntent('Graham became her guardian in nineteen seventy-seven.')).toBeNull();
  });

  it('returns data for written number + unit (percent)', () => {
    expect(classifyShotIntent('A twenty percent charge has been imposed on all cargo.')).toBe('data');
  });

  it('returns data for digit + billion dollars', () => {
    expect(classifyShotIntent('The settlement is worth 1.776 billion dollars.')).toBe('data');
  });

  it('returns data for written hundred + billion dollars', () => {
    expect(classifyShotIntent('The deal is valued at one hundred ten billion dollars.')).toBe('data');
  });

  it('returns stakes for escalation keyword', () => {
    expect(classifyShotIntent('Officials warn the conflict may escalate across the region.')).toBe('stakes');
  });

  it('returns contrast for contrast-starter sentence', () => {
    expect(classifyShotIntent('However, the opposing party disputes that claim.')).toBe('contrast');
  });

  it('data beats stakes on count', () => {
    const narration =
      'Tensions are rising in the region. ' +
      'A twenty percent tariff was imposed. ' +
      'Three million dollars in aid was pledged.';
    expect(classifyShotIntent(narration)).toBe('data');
  });

  it('data tiebreak beats stakes when counts equal', () => {
    const narration =
      'The situation could escalate. ' +
      'Forty billion dollars were committed.';
    expect(classifyShotIntent(narration)).toBe('data');
  });

  it('returns null for empty string', () => {
    expect(classifyShotIntent('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --reporter=verbose 2>&1 | grep -A3 "classifyShotIntent"
```

Expected: multiple failures including "classifyShotIntent is not a function".

- [ ] **Step 3: Add `UNIT_RE` and `classifyShotIntent` to intent-classifier.js**

Add after the closing brace of `splitIntoSentences` (before the `classifyIntent` export), so around line 64:

```js
const UNIT_RE = /\b(percent|%|billion|million|thousand|trillion|dollars?|deaths?|casualties|killed|injured|wounded)\b/i;

export function classifyShotIntent(narration) {
  const sentences = splitIntoSentences(narration);
  const counts = { data: 0, stakes: 0, contrast: 0 };

  for (const s of sentences) {
    const raw = classifyIntent({ sentenceContainingAnchor: s, isFirstOccurrenceInShot: false });
    if (raw === 'data') {
      // Only count as data if the sentence also contains a unit word.
      // Prevents standalone written numbers (ages, years) from triggering
      // data intent — e.g. "at the age of seventy-one" or "in nineteen eighty".
      if (UNIT_RE.test(s)) counts.data++;
    } else if (raw === 'stakes' || raw === 'contrast') {
      counts[raw]++;
    }
  }

  // Most frequent by count; tiebreak order: data > stakes > contrast.
  let best = null;
  let bestCount = 0;
  for (const intent of ['data', 'stakes', 'contrast']) {
    if (counts[intent] > bestCount) {
      best = intent;
      bestCount = counts[intent];
    }
  }
  return best; // null = no signal detected; caller decides the fallback
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --reporter=verbose 2>&1 | grep -A2 "classifyShotIntent"
```

Expected: all `classifyShotIntent` tests pass.

- [ ] **Step 5: Run full test suite**

```
npm test
```

Expected: all tests pass (no regressions in `classifyIntent` or `splitIntoSentences`).

- [ ] **Step 6: Commit**

```
git add scripts/intent-classifier.js scripts/__tests__/intent-classifier.test.js
git commit -m "feat(intent): add classifyShotIntent — full-narration shot-level intent classifier"
```

---

## Task 2: Fix `isEstablish` in build-shotlist.js

**Files:**
- Modify: `scripts/build-shotlist.js` (line 521)

- [ ] **Step 1: Apply the one-line fix**

In `scripts/build-shotlist.js`, find line 521 (the `isEstablish` block):

```js
// current
const firstStory0Shot = shots.find(s => s.storyIndex === 0);
if (firstStory0Shot) firstStory0Shot.isEstablish = true;
```

Replace with:

```js
// fixed — first shot in broadcast order, regardless of report-array index
const firstStoryShot = shots.find(s => s.storyIndex != null);
if (firstStoryShot) firstStoryShot.isEstablish = true;
```

- [ ] **Step 2: Rebuild the 7-13-evening shotlist and verify**

```
node scripts/build-shotlist.js --edition=2026-07-13-evening
node -e "const sl=JSON.parse(require('fs').readFileSync('out/shotlists/2026-07-13-evening.json','utf8')); sl.shots.forEach((s,i)=>{ if(s.isEstablish) console.log('isEstablish on shot',i,'storyIndex=',s.storyIndex); });"
```

Expected: prints `isEstablish on shot 1 storyIndex= 12` (the Lindsey Graham story — first broadcast story).

- [ ] **Step 3: Commit**

```
git add scripts/build-shotlist.js
git commit -m "fix(shotlist): isEstablish marks first broadcast story, not report-array index 0"
```

---

## Task 3: Set `shot.shotIntent` in build-shotlist.js

**Files:**
- Modify: `scripts/build-shotlist.js`

- [ ] **Step 1: Add import**

At the top of `scripts/build-shotlist.js`, add `classifyShotIntent` to the imports. The current import on line 20 is:

```js
import { buildCameraPath as buildRecipeCameraPath, buildGlobeSpinPath } from './shot-recipes.js';
```

Add a new import line after it:

```js
import { classifyShotIntent } from './intent-classifier.js';
```

- [ ] **Step 2: Set shotIntent on each story shot in broadcast-file mode**

In `build-shotlist.js`, the broadcast-file story loop builds shots at lines 432–461. After each `shots.push({...})` call, the shot is the last element in `shots`. Add `shotIntent` assignment immediately after the push, before `elapsed += hold`:

Locate the story beat loop block (it ends with `elapsed += hold` around line 461). Replace it so the story shot push looks like:

```js
  // Story beats
  for (let i = 0; i < beats.length; i++) {
    const narration = (beats[i].narration ?? '').trim();
    if (!narration) continue;

    const hold = estimateHold(narration);
    if (elapsed + hold > maxDuration) break;

    const storyIdx = storyIndices[i] ?? null;
    const story    = storyIdx != null ? (report.stories ?? [])[storyIdx] : null;
    const analysis = story?.analysis ?? {};
    const validLocs = (analysis.locations ?? []).filter(l => l?.lat != null && l?.lng != null);
    const isoCode = validLocs.find(l => l.iso && l.iso !== 'XX')?.iso ?? null;
    const cameraPath = buildCameraPath(analysis.locations, hold, polygonMap);
    const namedWps = cameraPath.filter(wp => wp.highlight?.name);
    const si = classifyShotIntent(narration);

    shots.push({
      t: elapsed,
      storyIndex: storyIdx,
      isoCode,
      cameraPath,
      chyron: {
        label:    CHYRON_LABELS[i % CHYRON_LABELS.length].toUpperCase(),
        headline: story?.headline ?? beats[i].beat ?? '',
      },
      narration,
      hold,
      viz: buildStoryViz(story, isoCode),
      impact: storyImpact(story),
      shotIntent: si ?? (namedWps.length > 0 ? 'reveal' : null),
    });

    elapsed += hold;
  }
```

Note: `buildCameraPath` was previously inlined in the push — extract it to a `const` so `namedWps` can be counted before the push.

- [ ] **Step 3: Set shotIntent on each story shot in fallback (report-only) mode**

The fallback loop is at lines 481–512. Apply the same pattern there:

```js
  for (let i = 0; i < topStories.length; i++) {
    const story    = topStories[i];
    const analysis = story.analysis ?? {};

    const narration = buildNarration(analysis);
    const hold      = estimateHold(narration);

    if (elapsed + hold > maxDuration) break;

    const validLocs = (analysis.locations ?? []).filter(l => l?.lat != null && l?.lng != null);
    const isoCode = validLocs.find(l => l.iso && l.iso !== 'XX')?.iso ?? null;
    const actualIdx = (report.stories ?? []).indexOf(story);
    const cameraPath = buildCameraPath(analysis.locations, hold, polygonMap);
    const namedWps = cameraPath.filter(wp => wp.highlight?.name);
    const si = classifyShotIntent(narration);

    shots.push({
      t: elapsed,
      storyIndex: actualIdx,
      isoCode,
      cameraPath,
      chyron: {
        label:    CHYRON_LABELS[i % CHYRON_LABELS.length].toUpperCase(),
        headline: story.headline,
      },
      narration,
      hold,
      viz: buildStoryViz(story, isoCode),
      impact: storyImpact(story),
      shotIntent: si ?? (namedWps.length > 0 ? 'reveal' : null),
    });

    elapsed += hold;
  }
```

- [ ] **Step 4: Rebuild shotlist and verify shotIntent values**

```
node scripts/build-shotlist.js --edition=2026-07-13-evening
node -e "
const sl = JSON.parse(require('fs').readFileSync('out/shotlists/2026-07-13-evening.json','utf8'));
sl.shots.forEach((s,i) => console.log('shot', i, 'shotIntent=', s.shotIntent ?? '(null)'));
"
```

Expected (approximate — depends on narration content):
- Shot 0: null (intro, no storyIndex)
- Shot 1 (Lindsey Graham): null or data (year references filtered; stakes language possible)
- Shot 2 (Hormuz): data ("twenty percent")
- Shot 3 (ICE shooting): stakes ("killed")
- Shot 4 (Merger): data ("one hundred ten billion dollars")
- Shot 5 (IRS ruling): data ("one point seven seven six billion dollars")
- Shot 6 (Sam Neill): reveal (named waypoint New Zealand, no data/stakes/contrast)
- Shot 7: null (outro)

- [ ] **Step 5: Commit**

```
git add scripts/build-shotlist.js
git commit -m "feat(shotlist): set shot.shotIntent from full narration text at build time"
```

---

## Task 4: Update `pickOverlayRecipes` to prefer `shotIntent`

**Files:**
- Modify: `scripts/shot-recipes.js` (line ~95)
- Modify: `scripts/__tests__/shot-recipes.test.js`

- [ ] **Step 1: Write a failing test for `shotIntent` precedence**

Add to the `pickOverlayRecipes — intent-driven rules` describe block in `scripts/__tests__/shot-recipes.test.js`:

```js
  it('shotIntent takes precedence over dominantIntent', () => {
    // shotIntent=stakes, dominantIntent=reveal → should emit ripple-expand (stakes), not context-strip (reveal)
    const shot = makeShot('reveal', '');
    shot.shotIntent = 'stakes';
    const extra = pickOverlayRecipes(shot, 0);
    expect(extra.find(t => t.type === 'ripple-expand')).toBeDefined();
    expect(extra.find(t => t.type === 'context-strip')).toBeUndefined();
  });

  it('falls back to dominantIntent when shotIntent is absent', () => {
    // no shotIntent, dominantIntent=reveal → context-strip fires
    const shot = makeShot('reveal', '');
    // shot has no shotIntent property
    const extra = pickOverlayRecipes(shot, 0);
    expect(extra.find(t => t.type === 'context-strip')).toBeDefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --reporter=verbose 2>&1 | grep -E "(shotIntent takes precedence|falls back to dominantIntent)"
```

Expected: both tests fail ("Expected defined / Expected undefined").

- [ ] **Step 3: Update intent resolution in shot-recipes.js**

In `scripts/shot-recipes.js`, find line ~95:

```js
  const intent       = shot.dominantIntent ?? null;
```

Replace with:

```js
  const intent       = shot.shotIntent ?? shot.dominantIntent ?? null;
```

- [ ] **Step 4: Run full test suite**

```
npm test
```

Expected: all tests pass. The existing `makeShot` helper uses `dominantIntent` but no `shotIntent` — the fallback `?? shot.dominantIntent` preserves all existing behaviour.

- [ ] **Step 5: Commit**

```
git add scripts/shot-recipes.js scripts/__tests__/shot-recipes.test.js
git commit -m "feat(recipes): prefer shot.shotIntent over dominantIntent for overlay dispatch"
```

---

## Task 5: Update diag-recipes.js and run full diagnostic

**Files:**
- Modify: `scripts/diag-recipes.js`

- [ ] **Step 1: Remove backfill logic, read shotIntent from shotlist**

Replace the entire contents of `scripts/diag-recipes.js` with:

```js
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
```

- [ ] **Step 2: Rebuild shotlist and run full diagnostic**

```
node scripts/build-shotlist.js --edition=2026-07-13-evening && node scripts/diag-recipes.js --edition=2026-07-13-evening
```

Verify:
- Shot 1 shows `[ESTABLISH]` and `spotlight-mask` fires (if impact >= 0.5 and named waypoints present)
- At least one shot shows `shotIntent=data` or `shotIntent=stakes`
- Recipe distribution shows treatments beyond just `label-bloom`/`flow-arrow`

- [ ] **Step 3: Run full test suite one more time**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```
git add scripts/diag-recipes.js
git commit -m "chore(diag): remove intent backfill from diag-recipes, read shotIntent from shotlist"
```
