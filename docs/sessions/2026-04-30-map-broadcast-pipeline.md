# Session — 2026-04-30

Branch: `claude/map-broadcast-checklist` — Phase 0 (architecture) complete, 4 / 23 checklist items done.

## What was worked on
- Honest concept review of the Meridian website (cable-news cosplay vs structured cross-source analysis; source diversity; map as the legitimately good idea).
- Plan for turning the map into a video-grade backdrop for auto-generated news clips, without abandoning the website's map.
- Created `docs/map-broadcast-checklist.md` — 23-item plan across three phases (0: architecture, 1: visual map work, 2: recording pipeline).
- Implemented Phase 0 end-to-end: kernel extraction, ambient mode, globe projection everywhere, costume separation between website and video.
- Established `docs/sessions/` convention with template + CLAUDE.md guidance so session notes get written at end of every working session.

## Key decisions made
- **Two surfaces, one map identity.** Website map and video map share style / projection / fog / marker / glow / graticule / terminator / source-arcs. They diverge in camera pacing, controls, aspect ratio, and surrounding chrome. Avoid two parallel implementations.
- **Globe projection on every viewport.** No mobile fallback. Mercator at zoom 1 looks like Google Maps; the spinning-earth baseline only reads as broadcast on the sphere. Contingency for mobile perf documented inline at the projection setting.
- **Broadcast costume (chyron + LIVE + ticker + scanlines) is video-only.** It was making the website cosplay as cable news. Website now gets a sober status strip (wordmark · edition · date · clock). The map itself stays cinematic on both.
- **Kernel + hook architecture.** All map setup in `src/map/`. Both surfaces consume `useMeridianMap`. Visual changes propagate automatically.
- **Atmospheric fog deferred to item #1.** The projection decision (0c) is separate from the visual polish (#1, where the knobs live: horizon-blend, star-intensity, space color).
- **Recording pipeline is its own phase.** Items 14–19: shotlist generator → headless Playwright recorder → TTS narration → ffmpeg mux → `npm run produce-clip` end-to-end.
- **Build the headless render harness early.** Live browser preview lies; encoded video reveals judder. Recommended to land the harness by the time visual item ~5 is in flight.

## Discoveries / surprises
- The chyron / LIVE / ticker / scanlines were the part of the design that conflicted with the product's substance, not the map. Stripping them from the website was the simplest single fix that made the site feel coherent.
- Bearing rotation on a globe spins the sphere around the screen-perpendicular axis (looks tilted/wrong); the canonical broadcast "spinning earth" requires incrementing center longitude instead. Discovered while wiring 0b's ambient rotation, fixed when 0c enabled globe.
- Pulse marker had been pulsing at `[0, 20]` (Atlantic, off Africa) on page load — pre-existing bug from before this session. Surfaced in 0b's idle return: marker stayed visible at the previously focused location while the globe spun around it. Fixed by hiding the marker outside of focused state.
- Mapbox's stock dark-v11 / light-v11 styles need ~150 lines of runtime patching to look like Meridian's brand. Item #2 will replace this with a committed `meridian.style.json`.
- Headline-word geocoder (`extractLocationQuery`) is unreliable — it'll geocode "Putin meets Xi" to a person, "Wall Street rallies" to a street. Tolerable on the website (one wrong fly is mild). Flagged for removal from broadcast rendering in #13 (factual-error problem on video).

## Files modified

Added (`src/map/`):
- `kernel.js` — `loadMapbox` + `createMap` (lazy import, `projection: 'globe'`, applies style on load, attaches marker)
- `layers.js` — `applyMapStyle` (style patches + country/state highlight layers)
- `marker.js` — `createPulseMarker` + `updatePulseMarkerTheme` (hidden by default; revealed on focus)
- `camera.js` — `flyToLocation`, `returnToAmbient`, `startAmbientRotation`, ambient/focus constants
- `geocoding.js` — headline-based location fallback
- `useMeridianMap.js` — orchestration hook (refs, init, theme switch, focus + idle timer)

Added (`src/components/`):
- `MapHero.jsx` — website hero (sober status strip below the map)
- `BroadcastStage.jsx` — video hero (full chyron + LIVE + ticker + scanlines); not yet routed (waits on #11)

Removed:
- `src/components/BroadcastHero.jsx` — split into `MapHero` + `BroadcastStage`

Modified:
- `src/App.jsx` — imports `MapHero`, passes `selectedDate` for status strip
- `src/components/ErrorBoundary.jsx` — doc-comment example
- `CLAUDE.md` — directory listing reflects new layout; new "Session notes" section
- `docs/map-broadcast-checklist.md` — Phase 0 + Phase 2 added; status line tracks completion

Added (`docs/`):
- `docs/map-broadcast-checklist.md` — 23-item plan
- `docs/sessions/_template.md` — vault template
- `docs/sessions/2026-04-30-map-broadcast-pipeline.md` — this file

## Context for next session
- Branch is `claude/map-broadcast-checklist`. Daily content syncs (articles + reports) push to this branch automatically; rebase before pushing if push gets a 403 / non-fast-forward.
- The checklist file is the durable plan: `docs/map-broadcast-checklist.md`. Resume by reading it; status line at top tracks progress.
- Architecture in one line: visual identity lives in `src/map/` (kernel + style + marker + layers); behavior diverges in the two components (`MapHero` for website, `BroadcastStage` for video) via the `useMeridianMap` hook.
- `BroadcastStage` is implemented and complete but not yet routed — App.jsx only renders `MapHero`. Item #11 will wire `?mode=broadcast` to render `BroadcastStage` and hide the surrounding app shell. Until then the costume code tree-shakes out of the bundle.
- Next item is **#1 — Atmospheric fog** (`map.setFog`). Tune `color`, `high-color`, `horizon-blend`, `space-color`, `star-intensity` for both themes. This is the polish that finishes 0c's globe — without it the sphere sits on a flat colored background instead of in space.
- Concept-level questions deferred (require product decisions, not engineering): source diversity, methodology page, per-story permalinks, claim → article traceability, Mapbox commercial-use license for recorded video.

## Open items / next steps
- **Item #1 — Atmospheric fog.** Likely 30–60 min of tuning. Decide dark / light theme palettes and `star-intensity` taste.
- **Item #2 — Custom Mapbox style.** Bigger lift — author `meridian.style.json` in Mapbox Studio (or hand-author), point `kernel.js` at it, drop the runtime patching block in `layers.js`. Worth doing early since every later visual change touches the style.
- **Item #16 — Headless render harness (Playwright).** Recommended priority bump per the decision above; build it before items 4–10 so visual changes get reviewed as encoded video, not live browser.
- Optional follow-up to 0d: add a "freshness" indicator to the website status strip (`Updated 2h ago`) — needs a top-level generation timestamp on the report JSON, currently only per-article `collectedAt`.
- Globe perf on mid-range Android — not yet measured. If problematic, add the viewport-fallback contingency documented in `kernel.js` near the projection setting.
