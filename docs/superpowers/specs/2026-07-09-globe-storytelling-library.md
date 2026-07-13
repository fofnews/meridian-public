# Globe Storytelling Library

**Date:** 2026-07-09  
**Status:** Implemented  
**Code:** `remotion/src/camera-recipes/`, `scripts/shot-recipes.js`

---

## Purpose

The broadcast pipeline used a single camera primitive for every story shot: a lateral sweep between locations (`sweepBetween`) with a globe spin for intro/outro. Every beat looked the same regardless of what the narration was *saying*. A "reveals a hidden threat" beat got the same camera grammar as a "here is some context" beat.

This library assigns each story beat a *named camera recipe* (a pre-choreographed Mapbox waypoint sequence) and *overlay recipes* (complementary scene-plan treatments) chosen deterministically from shot shape cues. The result: the camera reads the room.

---

## Vocabulary

### Story-beat intents (from `scripts/intent-classifier.js`)

These are sentence-level labels produced by `anchor-finder.js` when processing narration anchors. The shot-level recipe is determined before anchor processing (at shotlist-build time), using only shape cues below. Anchor-level intents then further refine waypoints within the shot.

| Intent | Trigger | Reading |
|--------|---------|---------|
| `reveal` | First mention of a location in the shot | "Here's where this is happening" |
| `stakes` | Stakes/risk language in the sentence | "This could escalate / threaten" |
| `data` | Number or quantity in the sentence | "Here's the count/measure" |
| `contrast` | Contrast starter (but, however, whereas) | "On the other hand…" |
| `hold` | None of the above | Maintains position — no new waypoint |

### Shot-shape cues (at shotlist-build time)

| Cue | Definition |
|-----|------------|
| `first` | The intro globe shot (storyIndex = null, heatmap viz) |
| `last` | The outro globe shot |
| `noLocation` | No valid `lat`/`lng` in `analysis.locations` |
| `singleLocation` | Exactly one valid non-special location |
| `multiLocation` | ≥2 valid non-special locations |
| `flowChain` | Sequenced locations with causal cues (future: detected by anchor-finder) |
| special location | `iso === 'XX'` or lat/lng ≈ origin — treated as `noLocation` |

---

## Camera Recipes

Each recipe is a pure function:  
`build(loc | locs, { duration, ...overrides }) → waypoint[]`

A waypoint is `{ tOffset, lng, lat, zoom, pitch, bearing, highlight? }`.  
`tOffset` is seconds from the start of the shot. The first waypoint always has `tOffset: 0`, the last always has `tOffset: duration`.

The camera engine in `remotion/src/camera.js` interpolates between waypoints with a cubic ease-in-out, and applies a 2-second cross-shot fly at shot boundaries.

### Constants (from `remotion/src/camera-recipes/constants.js`)

```
PITCH          = 50°     FOCUSED_PITCH_BROADCAST — headline angle
BEARING        = -10°    Default bearing (slight off-north)
AMBIENT_ZOOM   = 1.5     Globe-level zoom
AMBIENT_LAT    = 20°     Globe-level center latitude
AMBIENT_LNG    = 0°      Globe-level center longitude
SPIN_DEG_PER_SEC = 1.5°/s  Bearing drift rate
MAX_HOVER_DRIFT  = 30°   Cap on hover bearing drift
```

---

### `globeSpin` — Globe-level bearing drift
**File:** `remotion/src/camera-recipes/globeSpin.js`  
**Use when:** First shot, last shot, no valid location.  
**Visual:** The globe spins slowly on its axis, with a heatmap or no story highlight.

```
wp[0]  tOffset=0        lng=0, lat=20, zoom=1.5, pitch=0, bearing=bearing0
wp[1]  tOffset=duration                                   bearing=bearing0 - duration×1.5
```

**Parameters:** `bearing0` (default 0) — starting bearing. Outro shots pass the last bearing from the previous shot for continuity.

---

### `establish` — Wide globe → dive to location
**File:** `remotion/src/camera-recipes/establish.js`  
**Use when:** Single-location shots. The default for story beats.  
**Visual:** The globe starts pulled back (zoom 1.5), showing the target location as a dot on the globe, then glides in to story zoom with pitch rising to 50°.  
**Pairs with overlays:** `label-bloom` (location name rises at landing), `radar-pulse` (marker on arrival).

```
wp[0]  tOffset=0        lng=target, lat=target, zoom=1.5, pitch=0, bearing=0
wp[1]  tOffset=duration                         zoom=storyZoom, pitch=50, bearing=-10
```

---

### `pushIn` — Hold + zoom in tighter
**File:** `remotion/src/camera-recipes/pushIn.js`  
**Use when:** Single-location `stakes` beats — escalation, threats, casualties.  
**Visual:** Opens slightly wide of the story zoom, then pushes in closer with pitch increasing to 65°. Creates urgency / pressure.  
**Pairs with overlays:** `ripple-expand` (expanding rings at the location).

```
wp[0]  tOffset=0        zoom=storyZoom-1.5, pitch=50, bearing=-10
wp[1]  tOffset=duration zoom=storyZoom+1.5, pitch=65, bearing=-10
```

---

### `hover` — Static hold with slow bearing drift
**File:** `remotion/src/camera-recipes/hover.js`  
**Use when:** Single-location `data` or `hold` beats — stats, context, background.  
**Visual:** Camera sits at story zoom, bearing drifts slowly (up to 30°). Subtle motion that says "we're still live" without suggesting movement.  
**Pairs with overlays:** `stat-card` (when intent=data), nothing extra for hold.

```
wp[0]  tOffset=0        zoom=storyZoom, pitch=50, bearing=-10
wp[1]  tOffset=duration                            bearing=-10 - drift (max 30°)
```

---

### `sweepBetween` — Multi-location tour
**File:** `remotion/src/camera-recipes/sweepBetween.js`  
**Use when:** ≥2 valid locations.  
**Visual:** Visits each location with a hold then 2.5 s fly to the next.  
**Pairs with overlays:** `location-bug` (location list, auto-highlighted per waypoint), `flow-arrow` for directed flows.

```
wp[0]   tOffset=0         lng=loc0, zoom=zoom0, pitch=50  — arrival
wp[1]   tOffset=holdPerLoc                                — hold start (trigger fly)
wp[2]   tOffset=+2.5s     lng=loc1, zoom=zoom1           — arrival at loc1
...
wp[N]   tOffset=duration  lng=locN-1                      — terminal hold
```

`holdPerLoc = max(2, (duration - totalFlyTime) / N)`

---

### `whipPan` — Fast cut between two locations
**File:** `remotion/src/camera-recipes/whipPan.js`  
**Use when:** Multi-location `contrast` beats, or single-location contrast (bearing swing).  
**Visual:** Holds at location A, then whips to location B in 0.4 s. The fast transition reads as a rhetorical "versus."

**Single-location variant** (contrast on same place): bearing swings ±30° then returns.

```
// 2-location:
wp[0]  tOffset=0             loc0, pitch=50
wp[1]  tOffset=duration×0.2  loc0 (hold)
wp[2]  tOffset=+0.4s         loc1 (quick cut)
wp[3]  tOffset=duration       loc1 (terminal)

// 1-location bearing swing:
wp[0]  tOffset=0              bearing=-10
wp[1]  tOffset=duration×0.4   bearing=+20
wp[2]  tOffset=duration        bearing=-10
```

---

### `orbit` — Slow bearing sweep at fixed location
**File:** `remotion/src/camera-recipes/orbit.js`  
**Use when:** Manual override / future rules. Deliberate, contemplative feel.  
**Visual:** Camera rotates around the story location, sweeping `bearingSpan` degrees (default 60°).  
**Parameter:** `bearingSpan` (default 60°).

```
wp[0]  tOffset=0           bearing=B
wp[1]  tOffset=duration/2  bearing=B - span/2
wp[2]  tOffset=duration    bearing=B - span
```

---

### `pullback` — Close → globe (scope reveal)
**File:** `remotion/src/camera-recipes/pullback.js`  
**Use when:** Manual override. Transitioning from detail to regional context.  
**Visual:** Starts at story zoom (close), pulls back to globe level (zoom 1.5, pitch 0).

```
wp[0]  tOffset=0        zoom=storyZoom, pitch=50, bearing=-10
wp[1]  tOffset=duration zoom=1.5,       pitch=0,  bearing=0
```

---

### `vertigo` — Dolly zoom (zoom + pitch together)
**File:** `remotion/src/camera-recipes/vertigo.js`  
**Use when:** Manual override. Cinematic disorientation for major escalation.  
**Visual:** Zooms out while pitching up (or in while pitching down), creating a scale-distortion feel.  
**Parameter:** `direction: 'in' | 'out'` (default 'in' = zoom out + pitch up = feeling small).

```
// direction='in' (scope-expand):
wp[0]  tOffset=0            zoom=storyZoom, pitch=50
wp[1]  tOffset=duration/2   zoom=midpoint
wp[2]  tOffset=duration     zoom=storyZoom-2, pitch=70
```

---

### `chain` — Utility: concatenate two waypoint arrays
**File:** `remotion/src/camera-recipes/chain.js`  
`chain(a, b, offsetB)` — appends `b` with all `tOffset` values shifted by `offsetB`.  
Use to compose e.g. `establish` + `hover` for a two-phase shot.

---

## Overlay Recipes

Overlay recipes are **scene-plan treatments** that accompany camera recipes. Some are compositions of existing implemented primitives; two are new components.

### Existing primitives used as overlay recipes

| Overlay | Implementation | When used |
|---------|---------------|-----------|
| `radarPulse` | `src/map/marker.js` `createPulseMarker` | Any single-location shot (already always active) |
| `arcReveal` | `src/map/layers.js` `updateArcs` | Multi-location shots (source→story arcs) |
| `statCard` | `stat-card` scene-plan treatment | `data` intent anchors |
| `lowerThird` | `lower-third` scene-plan treatment | `context-label` and `quote-callout` anchors |
| `locationBug` | `location-bug` scene-plan treatment | Any shot with named waypoints |
| `flowArrow` | `flow-arrow` scene-plan treatment, `arrow` style | Flow-chain multi-loc shots |
| `marchArrow` | `flow-arrow` scene-plan treatment, `march` style | Stakes multi-loc shots |
| `choroplethFill` | `remotion/src/broadcast-map.js` `applyBroadcastChoropleth` | Shots with ≥4 sources (viz.kind='choropleth') |
| `densityHeat` | `remotion/src/broadcast-map.js` `addBroadcastHeatmap` | Globe spin shots (viz.kind='heatmap') |

### New treatments

#### `ripple-expand` — Expanding rings from geo-anchor
**File:** `remotion/src/scene-plan/treatments/RippleExpand.jsx`  
**Schema fields:** `lat`, `lng` — geo-coordinates of the pulse origin.  
**Visual:** 3 concentric rings staggered by 0.33s, expanding to 80px radius, fading out as they expand. Reads as "seismic pulse" or "impact site."  
**Use when:** `stakes` intent, single location.

#### `label-bloom` — Rising geo-anchored location label
**File:** `remotion/src/scene-plan/treatments/LabelBloom.jsx`  
**Schema fields:** `lat`, `lng`, `text` — geo-coordinates + label text.  
**Visual:** Text label positioned above the story location, rising 20px over 1 second with a gold glow (`textShadow: 0 0 20px ACCENT`). Provides cinematic location reveal.  
**Use when:** Single-location `establish` shots (reveal intent), at shot start.

---

## Beat → Recipe Rules

This is the canonical table. `scripts/shot-recipes.js` implements it exactly.

| Shot cue | Camera recipe | Overlay recipes emitted by ScenePlan |
|----------|---------------|--------------------------------------|
| First shot (intro) | `globeSpin(bearing0=0)` | `densityHeat` via viz.kind |
| Last shot (outro) | `globeSpin(bearing0=prevBearing)` | `densityHeat` via viz.kind |
| No valid location | `globeSpin` | `lowerThird` only |
| 1 loc (any intent at shot level) | `establish` | `radarPulse` (always), `labelBloom` (at tStart), `arcReveal` |
| N loc + context-label overlay | `sweepBetween` | `locationBug`, `arcReveal`, `rippleExpand` at first loc |
| N loc (no context-label) | `sweepBetween` | `locationBug`, `arcReveal` |

**Anchor-level refinement** (after anchor-finder runs in synthesize-narration.js):

| Anchor intent | Camera micro-move | Overlay added |
|---------------|-------------------|---------------|
| `reveal` | Fresh fly-in waypoint at location | — |
| `stakes` | Zoom-in waypoint (zoom +0.5 from prev) | — |
| `contrast` | Pull-back to midpoint waypoint | — |
| `data` | No camera move | `stat-card` |
| `hold` | No camera move | — |
| Any | — | `quote-callout` → `lower-third` (if quoted text) |

### Reserved recipes (not in default rules — manual/future use)

- `orbit` — use for deliberate "contemplate this region" moments
- `pullback` — use for "reveal the broader context" transitions
- `vertigo` — use for major escalation moments (rare)
- `whipPan` — available for contrast, but anchor-finder contrast waypoints already handle this at anchor level

**Override:** Any shot can set `shot.recipeOverride = 'orbit'` (future feature) to bypass the default rule.

---

## Composition Rules

Camera + overlay recipes work simultaneously without conflict because:

1. **Camera recipes** live in `shot.cameraPath` (waypoints, driven per-frame by `interpolateCameraOnPath`).  
2. **Overlay treatments** live in `shotlist.scenePlan.scenes[].treatments[]` (Remotion `<Sequence>` blocks, composited over the map frame).  
3. **Map effects** (`arcReveal`, `choroplethFill`, `densityHeat`) live in `Broadcast.jsx`'s per-shot imperative calls to `broadcast-map.js`.

These three layers stack independently. The only constraint: geo-anchored overlays (`ripple-expand`, `label-bloom`, `map-annotation`, `connection-arc`, `flow-arrow`) require `mapRef.current.project()` to be available, which it is after the map's first `idle` event.

---

## Architecture

```
scripts/
  build-shotlist.js          — calls buildCameraPath / buildGlobeSpinPath from shot-recipes.js
  shot-recipes.js            — rules dispatcher → calls camera-recipe modules; emits overlay hints
  location-utils.js          — locationZoom, waypointHighlight (shared by above two)

remotion/src/camera-recipes/
  constants.js               — PITCH, BEARING, AMBIENT_ZOOM, etc.
  establish.js               — wide→close
  pushIn.js                  — close→closer
  pullback.js                — close→wide
  orbit.js                   — bearing sweep
  vertigo.js                 — dolly-zoom
  sweepBetween.js            — multi-location tour
  whipPan.js                 — fast cut
  hover.js                   — static + bearing drift
  globeSpin.js               — globe-level spin
  chain.js                   — concat utility
  index.js                   — barrel export

remotion/src/scene-plan/
  schema.js                  — ripple-expand + label-bloom added to Treatment union
  registry.js                — RippleExpand + LabelBloom registered
  treatments/
    RippleExpand.jsx          — expanding rings from lat/lng
    LabelBloom.jsx            — rising geo-anchored text label
```

---

## Adding a New Recipe

1. **Create** `remotion/src/camera-recipes/myRecipe.js` with `export function build(loc, { duration, ...opts }) → waypoint[]`
2. **Export** from `index.js` as `export * as myRecipe from './myRecipe.js'`
3. **Add a rule** in `scripts/shot-recipes.js` → `buildCameraPath` dispatch
4. **Test** in `remotion/src/__tests__/camera-recipes.test.js` — assert monotonic tOffsets, last tOffset === duration, valid axis ranges
5. **Document** a new row in the Beat → Recipe Rules table above

For overlay treatments:
1. **Create** `remotion/src/scene-plan/treatments/MyTreatment.jsx`
2. **Add** the Zod schema to `schema.js` (new discriminated union member)
3. **Register** in `registry.js`
4. **Emit** the treatment type from `scripts/shot-recipes.js:pickOverlayRecipes` or from `synthesize-narration.js:buildScenePlan`
5. **Test** schema validation in `remotion/src/__tests__/scene-plan-schema.test.js`
