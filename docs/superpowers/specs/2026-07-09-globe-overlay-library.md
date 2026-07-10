# Globe Overlay Library

## Purpose

Extends the globe storytelling vocabulary beyond camera movement into **map overlays**: the visual elements that appear on or over the map to add depth, motion, and rhetorical emphasis to each story beat. Every overlay is chosen deterministically from shot content and intent — no LLM.

---

## Design Principles

### Geo-anchored vs screen-space
- **Geo-anchored** overlays follow a lat/lng on the map as the camera moves. They use `mapRef.current.project([lng, lat])` per frame to compute screen coordinates. They return `null` if `mapRef` is not ready.
- **Screen-space** overlays are positioned relative to the viewport (e.g., bottom-left callout). They don't require `mapRef`.

### Sequence-relative timing
Every treatment component uses `useFadeOpacity({ durationS, fps })` from `scene-plan/timing.js`. The component lives inside a Remotion `<Sequence>` so `useCurrentFrame()` starts at 0 when the treatment starts. This gives a built-in 0.3 s fade-in and fade-out.

### Single rendering pipeline
All map overlays flow through `SceneRenderer` via `shotlist.scenePlan`. The legacy `overlaySequences` path in `Broadcast.jsx` now handles only `data-callout` and `quote-callout` (which become `stat-card` and `lower-third` in the scene plan via `synthesize-narration.js`). The four legacy overlay components (`ArcTokens`, `ComparisonOverlay`, `EscalationOverlay`, `ContextLabelOverlay`) have been migrated to scene-plan treatments.

### Reused primitives
- `arcs.js:greatCircleArc` — antimeridian-safe great-circle interpolation
- `marker.js:createPulseMarker` — radar-pulse marker (fires automatically via Broadcast.jsx, not a treatment)
- `broadcast-map.js:applyBroadcastChoropleth`, `addBroadcastHeatmap` — imperative map effects, not treatments
- `FlowArrow.jsx:trimPolyline` — path progress interpolation, reused by `ParticleTrail`

---

## Overlay Vocabulary

### Motion — things moving on the map

| Name | Type | Description |
|---|---|---|
| `flow-arrow` | existing | Bold directional arrow along a polyline path. Style `'arrow'` or `'march'` (marching dashes). |
| `particle-trail` | **new** | Dots streaming along a polyline. Multiple particles with staggered phase. Used for causal flow between locations. |
| `arc-token` | migrated | Dots moving along straight arcs between two lat/lng pairs. Migrated from legacy `ArcTokens`. |

### Trails — route progressive reveal

| Name | Type | Description |
|---|---|---|
| `route-reveal` | **new** | A dashed or solid line drawing from origin to destination over `revealDuration` seconds. Different from `connection-arc` (straight/geodesic, not curved). |
| story-path | built-in | The dashed white line connecting shot locations; managed imperatively by `Broadcast.jsx`. Not a treatment. |

### Zones — bounded regions

| Name | Type | Description |
|---|---|---|
| `impact-radius` | **new** | Concentric rings around a point, sized in km. Zoom-aware pixel conversion via Mercator scale. Pulses slightly. |
| `spotlight-mask` | **new** | Full-screen dark vignette with a radial-gradient cutout at the story location. Cinematic emphasis. |
| `hatched-zone` | **new** | GeoJSON polygon projected to screen and filled with diagonal hatch. Used for contested/exclusion zones. |
| choropleth | built-in | Country fill with saturation proportional to source coverage ratio; driven by `shot.viz.kind === 'choropleth'`. Not a treatment. |

### Points — single-location callouts

| Name | Type | Description |
|---|---|---|
| `magnitude-bubble` | **new** | Circle sized to a numeric value (log-scaled). Appears at the story's geo-anchor. |
| `label-bloom` | existing | Rising text label at a lat/lng. Entrance rise + glow. |
| `ripple-expand` | existing | 3 concentric expanding rings for stakes/significance. |
| radar-pulse | built-in | 3-ring radar marker managed imperatively by `Broadcast.jsx`. Fires for all geo-located shots. |

### Comparative — two-way contrast

| Name | Type | Description |
|---|---|---|
| `side-by-side-callout` | migrated | Two stat cards side by side. Used for contrast beats comparing two locations. Migrated from `ComparisonOverlay`. |

### Cinematic — mood and focus

| Name | Type | Description |
|---|---|---|
| `spotlight-mask` | **new** | See zones above. Doubles as a cinematic tool for high-impact first shots. |
| `escalation-warning` | migrated | Red-bordered pill with upward triangle. Used for escalating situations. Migrated from `EscalationOverlay`. |

### Contextual — narrative framing

| Name | Type | Description |
|---|---|---|
| `context-strip` | migrated | Left-anchored context blurb for reveal beats. Migrated from `ContextLabelOverlay`. |
| `lower-third` | existing | Full chyron strip with label + headline. Screen-space. |
| `stat-card` | existing | Giant number card. Screen-space. |

---

## Beat→Overlay Dispatch Rules

`scripts/shot-recipes.js:pickOverlayRecipes(shot, tStart)` implements these rules. Input fields: `shot.dominantIntent`, `shot.impact`, `shot.storyIndex`, `shot.narration`, `shot.cameraPath`, `shot.viz`.

| Cue | Overlays emitted |
|---|---|
| Any shot with a named waypoint | `label-bloom` |
| No intent + `context-label` overlay present | `ripple-expand` (legacy fallback) |
| `storyIndex === 0` + `impact ≥ 0.5` + named waypoint | `spotlight-mask` |
| 1 loc + `reveal` | `context-strip` |
| 1 loc + `stakes` | `ripple-expand`; also `escalation-warning` if escalation regex matches narration; also `impact-radius` if magnitude regex matches |
| 1 loc + `data` + magnitude regex match | `magnitude-bubble` |
| 1 loc + `contrast` + polygon on highlight | `hatched-zone` (pattern: contested) |
| 1 loc + `hold` | no new overlays (radar-pulse fires automatically) |
| 2+ loc + `reveal` | `route-reveal` |
| 2+ loc + `stakes` + causal regex match | `particle-trail` |
| 2+ loc + `contrast` | `side-by-side-callout` |
| `viz.kind === 'choropleth' | 'heatmap'` | no change — applied imperatively by Broadcast.jsx |

**Regex patterns used in dispatch:**
- Escalation: `/escalat|crisis|attack|struck|bomb|strike|threat|conflict|war|offensive|invasion/i`
- Causal: `/because|result|led to|causing|trigger|due to|response|following|after/i`
- Magnitude: `/(\d[\d,.]*)\s*(?:percent|%|billion|million|thousand|hundred|casualties|dead|wounded|injured|killed)/i`

---

## Composition Rules

**Layer ordering (z-index):**
- 12: `spotlight-mask` (below everything else)
- 13: `hatched-zone`, `arc-token`
- 14: `ripple-expand`, `impact-radius`, `context-strip`, `side-by-side-callout`, `escalation-warning`
- 15: `particle-trail`, `route-reveal`, `magnitude-bubble`, `flow-arrow`
- 17: `label-bloom`, `map-annotation`, `connection-arc`

**Cap per shot:** The rule table limits to approximately 3 map-anchored overlays + 1 screen-space callout per shot. Overlays are mutually exclusive within a category (e.g., both `ripple-expand` and `impact-radius` can fire on the same stakes shot, but `particle-trail` and `route-reveal` are mutually exclusive for multi-location shots since only one dispatches per intent).

**`spotlight-mask` exclusivity:** When emitted, the spotlight vignette visually suppresses country highlight layers by darkening everything outside the focus area. Only fire once (first story, establish shot).

---

## Data Plumbing

Two new fields are available on shot objects after this library ships:

**`shot.dominantIntent`** (string | null): Set in `synthesize-narration.js` from `buildAnchoredCameraPath`'s return value. Represents the most frequent non-`hold` intent across all ElevenLabs-aligned anchors in the shot. `null` for shots without ElevenLabs timestamps (dry-run, OpenAI fallback, intro/outro).

**`shot.impact`** (0–1): Set in `build-shotlist.js` as `min(1, (claims.length + disagreements.length) / 10)`. Story-level signal strength; used only for the `spotlight-mask` cinematic gate.

---

## Files Modified

| File | Change |
|---|---|
| `remotion/src/scene-plan/schema.js` | Added 10 new Zod treatment schemas |
| `remotion/src/scene-plan/registry.js` | Registered 10 new treatment components |
| `remotion/src/scene-plan/treatments/ParticleTrail.jsx` | New |
| `remotion/src/scene-plan/treatments/RouteReveal.jsx` | New |
| `remotion/src/scene-plan/treatments/ImpactRadius.jsx` | New |
| `remotion/src/scene-plan/treatments/SpotlightMask.jsx` | New |
| `remotion/src/scene-plan/treatments/HatchedZone.jsx` | New |
| `remotion/src/scene-plan/treatments/MagnitudeBubble.jsx` | New |
| `remotion/src/scene-plan/treatments/ArcToken.jsx` | Migrated from `overlays.jsx:ArcTokens` |
| `remotion/src/scene-plan/treatments/SideBySideCallout.jsx` | Migrated from `overlays.jsx:ComparisonOverlay` |
| `remotion/src/scene-plan/treatments/EscalationWarning.jsx` | Migrated from `overlays.jsx:EscalationOverlay` |
| `remotion/src/scene-plan/treatments/ContextStrip.jsx` | Migrated from `overlays.jsx:ContextLabelOverlay` |
| `remotion/src/Broadcast.jsx` | Removed `overlaySequences` for migrated types; kept data-callout + quote-callout |
| `remotion/src/overlays.jsx` | Deleted `ArcTokens`, `ComparisonOverlay`, `EscalationOverlay`, `ContextLabelOverlay` |
| `scripts/shot-recipes.js` | Full rule table in `pickOverlayRecipes` |
| `scripts/anchor-finder.js` | `buildAnchoredCameraPath` now returns `dominantIntent` |
| `scripts/synthesize-narration.js` | Captures and sets `shot.dominantIntent` |
| `scripts/build-shotlist.js` | Adds `shot.impact` per story |
| `remotion/src/__tests__/scene-plan-schema.test.js` | 30 new treatment tests |
| `scripts/__tests__/shot-recipes.test.js` | Rules dispatch tests (multi-loc + intent) |

---

## Deferred Treatments (future cycles)

These are named in the vocabulary but not implemented this cycle:

- `crosshair` — precise point indicator
- `pin-cluster` — grouped markers at a location
- `event-cursor` — animated time-position indicator
- `chart-inset` — inline bar/line chart
- `migration-stream` — particle field for population-movement stories
- `pursuit-trail` — dashed tail tracking a moving subject
- `desaturate-outside` — CSS filter to grey out off-focus regions
- `date-badge` — temporal timestamp label
- `versus-badge` — typographic A vs B comparison
- `country-cascade` — sequential country-highlight timings (camera-adjacent, would drive `updateHighlights` directly)
