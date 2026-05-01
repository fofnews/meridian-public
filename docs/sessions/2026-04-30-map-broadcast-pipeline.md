# 2026-04-30 — Map broadcast pipeline kickoff (Phase 0 complete)

**Branch:** `claude/map-broadcast-checklist` · **Outcome:** Strategy locked in, 23-item checklist created, Phase 0 (architecture) shipped end-to-end and verified — 4 / 23 complete.

## Goal

Two things, in order:
1. Honest critique of the Meridian website concept and where to push it.
2. Plan + begin building toward turning the existing map into a video-grade backdrop for auto-generated news clips, without abandoning the map on the website (it's the differentiating feature in the news-aggregator space).

## Decisions made

- **Two surfaces, one map identity.** The website map and the video map share style, projection, fog, marker, glow, graticule, terminator, source-arcs. They diverge in camera pacing, controls, aspect ratio, and surrounding chrome. Avoid two parallel implementations.
- **Globe projection on every viewport.** No mobile fallback. The "spinning earth" baseline only reads as broadcast on the sphere; mercator at zoom 1 looks like Google Maps. Contingency (viewport-based fallback) is documented inline at the projection setting and can be added without touching the rest of the kernel if perf becomes a problem.
- **Broadcast costume (chyron + LIVE + ticker + scanlines) is video-only.** It was making the website cosplay as cable news while the actual product is a deliberate twice-daily structured analysis. The website gets a sober status strip instead. The map itself stays cinematic on both surfaces.
- **Kernel + hook architecture.** All map setup lives in `src/map/`; both `MapHero` (website) and `BroadcastStage` (video) consume the same `useMeridianMap` hook. Visual changes propagate to both surfaces automatically.
- **Atmospheric fog deferred to item #1.** The projection decision (0c) is separate from the visual polish (#1, where the knobs are: horizon-blend, star-intensity, space color).
- **Recording pipeline added as Phase 2.** Six items covering shotlist generator, headless Playwright recorder, TTS narration, ffmpeg mux + per-platform encode, and an `npm run produce-clip` end-to-end recipe.

## What changed

### Code — `src/map/` (new directory)

- `kernel.js` — `loadMapbox` + `createMap` (lazy Mapbox import, projection: globe, applies style on load, attaches marker).
- `layers.js` — `applyMapStyle` (style patches + country/state highlight layers). Item #2 will replace the runtime patches with a committed `meridian.style.json`; data-driven highlight layers stay here.
- `marker.js` — `createPulseMarker` + `updatePulseMarkerTheme`. Marker is hidden by default; revealed on focus, hidden on idle return.
- `camera.js` — `getStoryZoom`, `getMapPadding`, `flyToLocation` (focus-aware, accepts pitch/duration), `returnToAmbient` (clears highlight + state polygon + hides marker), `startAmbientRotation` (rAF loop, increments center longitude, paused on `document.hidden` and via `setActive(false)`). Constants: `AMBIENT_LONGITUDE_DEG_PER_SEC=0.5`, `AMBIENT_IDLE_TIMEOUT_MS=30_000`, `AMBIENT_RETURN_DURATION_MS=3_000`, `FOCUSED_PITCH_WEBSITE=30`, `FOCUSED_FLY_DURATION_MS=2_000`.
- `geocoding.js` — `extractLocationQuery` + `fetchBoundaryPolygon` + `geocodeStory` (headline-based fallback used when `analysis.locations` is empty).
- `useMeridianMap.js` — orchestration hook: refs, init effect, theme switch, ResizeObserver for padding, focus-aware fly with idle timer. Returns `{ mapContainer, mapRef, flyToLocation, enterAmbient }`.

### Code — `src/components/`

- **Added:** `MapHero.jsx` — website hero. Map + interactive controls (story selector, location buttons, zoom, expand, minimize). Sober status strip below the map: wordmark · edition · date · edition switcher · clock.
- **Added:** `BroadcastStage.jsx` — video hero. Full broadcast costume (chyron, LIVE badge, ticker, scanlines) on top of the same kernel. Not yet routed; #11 will hook it to `?mode=broadcast`.
- **Removed:** `BroadcastHero.jsx` — split into the two above.
- **Modified:** `App.jsx` — imports `MapHero`, passes `selectedDate` for the status strip.
- **Modified:** `ErrorBoundary.jsx` — doc-comment example updated.

### Docs

- **Added:** `docs/map-broadcast-checklist.md` — 23-item plan across three phases. Status line at top, GFM checkboxes, notes/decisions log at bottom.
- **Modified:** `CLAUDE.md` — directory listing reflects the new `src/map/` and the `MapHero` / `BroadcastStage` split.

## Checklist progress

- `docs/map-broadcast-checklist.md`: **0 → 4 / 23 complete**
- Completed this session:
  - **0a** Extract shared map kernel
  - **0b** Define website ambient mode (slow rotation, idle return, focus pitch)
  - **0c** Globe projection on all viewports (and longitude-based ambient rotation)
  - **0d** Move broadcast costume to video-only surface
- Plus a follow-on bug fix: hide pulse marker outside of focused state (was pulsing at last location during ambient).

## Verification

- `npm run build` passes after every commit. Mapbox stays in its own lazy chunk (~1.66 MB / 452 KB gzipped); main chunk hovers around 264 KB.
- User verified in browser after Phase 0 end-to-end: globe spins, focus fly works, idle return works, no leftover gold tint after return.
- **Not verified:** mid-range Android perf for globe (deferred — see 0c contingency); video-mode rendering of `BroadcastStage` (not yet routed).

## Open questions / next up

- **Item #1 — Atmospheric fog (`map.setFog`).** Tune `color`, `high-color`, `horizon-blend`, `space-color`, `star-intensity` for the dark and light themes. This is the polish that makes the globe finally read as broadcast rather than "globe sitting on a colored sheet."
- Concept-level questions raised in the initial review and intentionally deferred (require product decisions, not engineering):
  - Source diversity (the "20+ sources" pitch is weak when most are US wire/tabloid).
  - Methodology page (no current "why should I trust this?" surface).
  - Per-story / per-edition permalinks (SPA rewrites everything to `index.html`; nothing is shareable).
  - Trace claims back to specific articles (extending the source citation that already exists on disagreements to agreements + unique angles).
  - Mapbox commercial-use license for recorded video.

## Notes

- Phase 0 was added to the original checklist after the initial 13-item visual + 6-item recording-pipeline plan; without it, items 1–10 would have been duplicated between the two heroes.
- `useMeridianMap` hook is the seam where future surfaces (e.g. a thumbnail-only embed, or a vertical-9:16 stage variant) would plug in without touching kernel logic.
- The headline-word geocoder (`extractLocationQuery`) is still used as a fallback; #13 will remove it from broadcast rendering only — wrong geocodes look like factual errors on video, but are tolerable on the website.
