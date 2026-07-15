# Shot Intent + isEstablish Fix — Design Spec
**Date:** 2026-07-14

## Problem

Two recipe dispatch bugs identified by `scripts/diag-recipes.js` on the 2026-07-13-evening edition:

1. **`spotlight-mask` never fires.** `isEstablish` is set on the shot with `storyIndex === 0` (report array index), but the broadcast selects stories by impact — story 0 in the report is rarely the lead broadcast story. In the 7-13 edition, no shot had `storyIndex === 0`.

2. **14/15 overlay treatments never fire.** All intent-gated treatments are blocked by `dominantIntent` being null. `dominantIntent` is set by `synthesize-narration.js` (post-TTS) via `anchor-finder.js`, which classifies the *sentence containing the location name*. Those sentences are almost always first-mention framing sentences ("We begin in South Carolina, where..."), so `classifyIntent` returns `reveal` for nearly every location. All `stakes`/`data`/`contrast` treatments go unreachable.

## Fix 1 — isEstablish (build-shotlist.js)

**Current:** `shots.find(s => s.storyIndex === 0)` — marks story 0 in the report array.

**Fix:** `shots.find(s => s.storyIndex != null)` — marks the first story shot in broadcast order (first shot with any storyIndex).

This is a one-line change at line 521 of `scripts/build-shotlist.js`.

## Fix 2 — Shot-Level Intent (intent-classifier.js + build-shotlist.js + shot-recipes.js)

### New field: `shot.shotIntent`

A new field computed at shotlist-build time from the **full narration text** of each story shot. Unlike `dominantIntent` (anchor-sentence scoped, post-TTS), `shotIntent` reflects the dominant signal across all sentences in the shot's narration.

Set during `build-shotlist.js`, before TTS. Recipes work correctly on the raw shotlist without requiring `synthesize-narration.js` to run.

### New export: `classifyShotIntent(narration)` in intent-classifier.js

```
classifyShotIntent(narration: string): 'data' | 'stakes' | 'contrast' | 'reveal' | null
```

Algorithm:
1. Split narration into sentences using the existing `splitIntoSentences`.
2. Classify each sentence with `classifyIntent({ sentenceContainingAnchor: s, isFirstOccurrenceInShot: false })`. Passing `false` prevents the reveal-fallthrough, so results are `data | stakes | contrast | hold` only.
3. Collect all non-`hold` results.
4. If any non-hold results exist, return the most frequent by count. If counts are equal, tiebreak: `data > stakes > contrast`.
5. If no non-hold results, return `null` (caller will use `reveal` if the shot has named waypoints — handled in `build-shotlist.js`).

### Tighter DATA detection for shot-level classification

The existing `DATA_RE` matches standalone `LARGE_WRITTEN` numbers (e.g. "seventy-one", "nineteen"), producing false positives for ages and years. For shot-level intent, a sentence-level `data` result is only counted when the sentence also matches `UNIT_RE` (a unit word like `percent, billion, million, killed`, etc.).

This is implemented inside `classifyShotIntent` by post-filtering: a sentence classified as `data` is kept only if it also contains a unit-adjacent word. This avoids modifying `DATA_RE` globally (which would break the existing per-anchor classification).

### build-shotlist.js: set shot.shotIntent

After the camera path is built for each story shot, compute:

```js
const si = classifyShotIntent(shot.narration);
shot.shotIntent = si ?? (namedWps.length > 0 ? 'reveal' : null);
```

Intro/outro shots (storyIndex == null) get no `shotIntent`.

### shot-recipes.js: prefer shotIntent

Change the intent resolution line from:
```js
const intent = shot.dominantIntent ?? null;
```
to:
```js
const intent = shot.shotIntent ?? shot.dominantIntent ?? null;
```

`shotIntent` wins when present (full-narration classification). `dominantIntent` is a fallback for backward compat with shotlists that predate this change. Both can be null for intro/outro shots.

## Files Changed

| File | Change |
|------|--------|
| `scripts/intent-classifier.js` | Add `classifyShotIntent(narration)` export; add unit post-filter |
| `scripts/build-shotlist.js` | Fix `isEstablish` (1 line); import + call `classifyShotIntent`, set `shot.shotIntent` |
| `scripts/shot-recipes.js` | Change intent resolution to `shot.shotIntent ?? shot.dominantIntent ?? null` |
| `scripts/diag-recipes.js` | Remove backfill logic — `shotIntent` now comes from the shotlist directly |

## Expected Outcome (7-13-evening)

After the fix, re-running `build-shotlist.js` + `diag-recipes.js` on 7-13-evening should show:
- Shot 1 (Lindsey Graham): likely `data` (Senate appointment date, age) or `stakes` (political consequences)
- Shot 2 (Hormuz): `data` ("twenty percent charge") or `stakes` ("naval blockade")
- Shot 3 (ICE shooting): `stakes` ("killed", risk language)
- Shot 4 (Merger suit): `data` ("one hundred ten billion dollars")
- Shot 5 (IRS ruling): `data` ("one point seven seven six billion dollars")
- Shot 6 (Sam Neill): `reveal` or null (no data/stakes/contrast signals)
- `spotlight-mask` fires on shot 1 (isEstablish + impact=1 + named waypoints)

## Not Changed

- `dominantIntent` logic in `anchor-finder.js` / `synthesize-narration.js` — unchanged. It continues to drive camera timing (which anchors to visit and when). It is no longer the primary gate for recipe selection.
- `diag-recipes.js` backfill is removed once `shotIntent` is in the shotlist, but the script remains for future diagnostic use.

## Testing

1. Run `node scripts/build-shotlist.js --edition=2026-07-13-evening` — verify `shotIntent` and `isEstablish` fields in the output JSON.
2. Run `node scripts/diag-recipes.js --edition=2026-07-13-evening` — verify the recipe distribution is no longer all `label-bloom`/`flow-arrow`.
3. Run existing test suite: `npm test` — `scripts/__tests__/shot-recipes.test.js` should still pass (no interface changes to `pickOverlayRecipes`).
4. Spot-check `shot.shotIntent` values against narration content to confirm classification accuracy.
