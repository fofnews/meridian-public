# Session — 2026-07-14 — Overlay dispatch rules: orphans + fixes

## What was worked on

Completed the overlay dispatch layer. All 16 scene-plan treatments are now reachable from `pickOverlayRecipes` in `scripts/shot-recipes.js`. Added rules for the four previously orphaned treatments and fixed six bugs in existing rules.

## Key decisions made

- **flow-arrow vs route-reveal mutual exclusion**: `route-reveal` gates on `numLocs === 2`; `flow-arrow` gates on `numLocs >= 3`. Exactly one fires per reveal-intent shot.
- **arc-token**: `data` intent + TRADE_RE vocabulary. Consecutive uniqueNamedWp pairs become arcs.
- **connection-arc**: `contrast` intent + exactly 2 locations + DIPLOMATIC_RE. Coexists with `side-by-side-callout` (no map footprint conflict).
- **map-annotation**: any shot with ≥2 named waypoints; annotates indices 1–3 with staggered entrance (1.5s + i×0.6s).
- **hatched-zone pattern**: `'exclusion'` when EXCLUSION_RE matches narration (no-fly, naval blockade, etc.); otherwise `'contested'`.
- **uniqueNamedWps**: deduplicated by highlight.name to avoid double-dispatch from sweepBetween camera paths (which emit one waypoint per location per sweep direction).
- **isEstablish flag**: set in `build-shotlist.js` on the first story-0 shot; used to gate `spotlight-mask` instead of `storyIndex === 0`.
- **impact-radius unit guard**: MAGNITUDE_RE now captures the unit as group 2; only spatial/casualty units emit the radius (skips "78 billion", "42 million", etc.).
- **particle-trail scaling**: `particleCount = clamp(round(lenKm/500), 3, 10)`, `speed = clamp(0.15 + lenKm/20000, 0.15, 0.45)`.
- **RouteReveal geodesic**: 32-point slerp in `RouteReveal.jsx`; Zod schema gets `mode: z.enum(['straight','geodesic']).default('geodesic')`.

## Discoveries / surprises

- `BroadcastStage.jsx` was removed in an earlier session and replaced by `BroadcastPanel.jsx` (admin video-generation panel). The TODO.md item referencing it was stale and has been removed.
- MapHero.jsx wires `onSelect` prop but never calls it — story selection on the website happens via card expansion only. Decided to leave as-is.

## Files modified

- `scripts/shot-recipes.js` — TRADE_RE, DIPLOMATIC_RE, EXCLUSION_RE, haversine helpers; 4 orphan rules; 6 bug fixes
- `scripts/build-shotlist.js` — `isEstablish` flag on first story-0 shot
- `remotion/src/scene-plan/schema.js` — `mode` on RouteRevealTreatment (default 'geodesic')
- `remotion/src/scene-plan/treatments/RouteReveal.jsx` — geodesic great-circle mode with 32-point slerp + antimeridian unwrap
- `remotion/src/__tests__/scene-plan-schema.test.js` — route-reveal mode tests
- `scripts/__tests__/shot-recipes.test.js` — 53 tests, all passing
- `remotion/src/OverlayGallery.jsx` — new: 18-scene × 6s gallery composition for visual regression
- `remotion/src/Root.jsx` — OverlayGallery composition registered
- `TODO.md` — stale BroadcastStage.jsx item removed

## Context for next session

- `pickOverlayRecipes` in `scripts/shot-recipes.js` is the single source of truth for overlay dispatch. All 16 treatments now have dispatch rules.
- OverlayGallery scenes are ordered by treatment type; scene N starts at frame N×180 in Remotion Studio.
- `shot.isEstablish` is the spotlight-mask gate — set once in build-shotlist.js.
- Tile cache pre-warming (from 2026-06-12 session) remains the only open performance item.

## Open items / next steps

- Tile cache pre-warming in Remotion render (pre-warm all camera positions before frame capture to eliminate tile-loading stalls)
