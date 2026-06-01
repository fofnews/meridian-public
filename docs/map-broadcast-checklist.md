# Map → Broadcast Backdrop Checklist

Goal: turn `BroadcastHero`'s Mapbox map from an interactive info widget into a video-grade backdrop for news clips generated from Meridian reports, then build the recording pipeline that turns each daily edition into publishable video.

**Status:** 23 / 23 complete · Last updated: 2026-06-01

To resume work in a new session: ask Claude to read `docs/map-broadcast-checklist.md`.

Three phases:
- **Phase 0 (items 0a–0d):** architecture — one map identity, two surfaces (website + video). Land before any visual work in Phase 1, otherwise items 1–10 will need to be reworked.
- **Phase 1 (items 1–13):** make the map look broadcast-grade. All visual changes land in the shared kernel and propagate to both surfaces automatically.
- **Phase 2 (items 14–19):** turn that backdrop into recorded, narrated, publishable video clips.

Recommended order: finish Phase 0 first. Build the headless render harness (#16) early — by the time item ~5 lands — so each visual change can be reviewed as actual encoded video, not just live browser. Live preview lies; encoded output reveals judder.

---

# Phase 0 — Architecture: one identity, two surfaces

The map appears in two places with the same visual identity but different behavior: the **website** (interactive, ambient, responsive) and the **video** (scripted, cinematic, fixed aspect). Avoid two parallel implementations — extract a shared kernel, then build thin wrappers per surface.

What's shared (lives in the kernel): style file, projection, fog, color palette, label typography, marker, country highlight, graticule, terminator, source-to-story arcs.

What diverges (lives in wrappers): camera pitch + bearing, fly duration, interactive controls, aspect ratio, ambient state, chyron / ticker / LIVE badge / scanlines (video only — see 0d).

- [x] **0a. Extract shared map kernel**
  - Created `src/map/{kernel,layers,marker,camera}.js`. `BroadcastHero.jsx` shrunk from 868 → 605 lines and now consumes `createMap`, `applyMapStyle`, `updatePulseMarkerTheme`, and `flyToLocation` from the kernel. Pure refactor — no visual changes. Build passes; Mapbox stays lazy-loaded in its own chunk.
  - Deferred until needed: `sources.js` (lands with #9), `layers.js` separation of style-patches vs data-driven layers (lands with #2).

- [x] **0b. Define website "ambient mode"**
  - Policy + helpers in `src/map/camera.js`: `AMBIENT_BEARING_DEG_PER_SEC = 0.5`, `AMBIENT_IDLE_TIMEOUT_MS = 30_000`, `AMBIENT_RETURN_DURATION_MS = 3_000`, `FOCUSED_PITCH_WEBSITE = 30`. New helpers: `startAmbientRotation(map)` (rAF loop, paused on `document.hidden`) and `returnToAmbient(map)` (flies back to globe, clears highlights). `flyToLocation` now accepts `{ pitch, duration }`.
  - `BroadcastHero.jsx` wires it: rotation starts when the map loads, pauses on focus, idle timer (30s) calls `enterAmbient` after last focus. Story flyTo passes `pitch: 30`.
  - Deferred (depends on later items): "all story markers visible as dim" lands with multi-marker support (around #10); "draw source arcs on focus" lands with #9; the wide globe view itself becomes more striking once #1 ships globe projection.

- [x] **0c. Globe-vs-flat strategy for mobile**
  - Decision: globe on all viewports. No mobile fallback. The "spinning earth" baseline only reads as broadcast on the sphere; mercator at zoom 1 looks like Google Maps. If perf becomes an issue, the contingency (viewport-based fallback) is documented inline in `src/map/kernel.js` near the `projection: 'globe'` setting and can be added without touching the rest of the kernel.
  - Implementation: `projection: 'globe'` set on the map constructor in `kernel.js`.
  - Knock-on fix to 0b: `startAmbientRotation` now increments center longitude (constant `AMBIENT_LONGITUDE_DEG_PER_SEC`, was `AMBIENT_BEARING_DEG_PER_SEC`). Bearing rotation on a globe spins the sphere around the screen-perpendicular axis, which reads as wrong; longitude rotation gives the classic west-to-east "earth on its axis" intro that the broadcast aesthetic expects.
  - Not done (deferred to user): empirical FPS measurement on a real mid-range Android. If problematic, revisit the contingency in `kernel.js`.

- [x] **0d. Move broadcast-costume elements to video-only surface**
  - Renamed `BroadcastHero.jsx` → `MapHero.jsx` (website) and stripped the costume: removed the chyron upper/lower bars, the red LIVE badge from the top bar, the scrolling gold ticker, and the CRT scanlines overlay. Top bar (LIVE + clock) gone too — the wordmark and clock now live in a sober status strip below the map.
  - New status strip: `THE MERIDIAN · Morning · April 30, 2026 · [edition buttons] · 14:32`. Sober, not theatrical. Edition switching preserved.
  - Created `src/components/BroadcastStage.jsx` — full broadcast costume (chyron, LIVE, ticker, scanlines) for video output. Imports from the same kernel + hook so visual identity stays in sync. Not yet routed; #11 will hook it up to `?mode=broadcast`.
  - Extracted shared logic into `src/map/useMeridianMap.js` (orchestration hook: refs, init, theme switch, focus + idle) and `src/map/geocoding.js` (headline-based location fallback). MapHero and BroadcastStage both consume both — no duplicated map setup.
  - `App.jsx` import updated; `ErrorBoundary.jsx` doc-comment + `CLAUDE.md` directory listing updated to reference the new files. Build passes; main bundle dropped from 265.6 KB → 263.8 KB (BroadcastStage isn't imported by anything yet, so it tree-shakes).
  - Deferred: "freshness indicator" (Updated Xh ago) — the report JSON doesn't carry a generation timestamp, only per-article `collectedAt`. Skipped until we add a top-level timestamp upstream or compute from articles. The status strip is correct and useful without it.

---

# Phase 1 — Map as broadcast backdrop

All Phase 1 items land in the shared kernel (Phase 0a) unless otherwise noted. Both surfaces inherit changes automatically.

## Priority 1 — Highest visual impact

- [x] **1. Switch to globe projection + atmospheric fog**
  - Globe projection set in item 0c. Atmospheric fog (`setFog`) added in `src/map/kernel.js` after style load: horizon-blend, space-color, star-intensity, high-color tuned for broadcast dark palette.

- [x] **2. Author a custom Mapbox style and stop patching `dark-v11` at runtime**
  - Two JSON style files committed to `public/` (`meridian-dark.style.json`, `meridian-light.style.json`), generated by `scripts/build-meridian-styles.js` from the Mapbox Styles API. Road/POI/transit layers stripped; `country-boundaries` source and `country-borders` layer baked in. `applyMapStyle` now contains only fog + data-driven layer additions. Style URLs referenced in `kernel.js` and `useMeridianMap.js`.

- [x] **3. Replace flat country-fill highlight with a glowing edge**
  - Two stacked `line` layers in `src/map/layers.js`: wide (10px, low-opacity, `line-blur: 4`) + narrow (1.5px, full-opacity), both filtered by `iso_3166_1`. Flat fill de-emphasized to near-transparent.

## Priority 2 — Cinematic camera + on-theme detail

- [x] **4. Cinematic camera moves (pitch, bearing, longer easing)**
  - `flyToLocation` in `src/map/camera.js` uses pitch 50°, bearing derived from shot metadata, duration 5000ms for broadcast. Shot-list camera objects carry explicit `pitch` and `bearing` fields.

- [x] **5. Radar-pulse marker (3 staggered rings)**
  - `src/map/marker.js` creates three rings with staggered `animation-delay` (0s, 0.4s, 0.8s). Marker hidden outside focused state (bug fixed in same commit). Pulse loops continuously through the multi-second camera hold.

- [x] **6. Graticule overlay (lat/lon gridlines)**
  - `src/map/graticule.js` generates GeoJSON at 15° intervals inline (no external file). Added as a `line` layer at 12% opacity beneath labels in `src/map/layers.js`.

- [x] **7. Custom typography for place labels**
  - `scripts/build-glyphs.js` (new): downloads Playfair Display Regular/Bold + Noto Sans Regular/Bold TTF from Google Fonts, generates all 256 Unicode PBF ranges via `fontnik`, writes to `public/fonts/`. 4.4 MB total; run-once-and-commit, same pattern as `build-meridian-styles.js`. Added `npm run build-glyphs`.
  - `build-meridian-styles.js`: sets `style.glyphs = '/fonts/{fontstack}/{range}.pbf'` (self-hosted), adds `applyTypography()` which assigns `text-font` per layer: country-label + continent-label → `Playfair Display Bold`; settlement-major-label → `Playfair Display Regular`; state-label → `Noto Sans Bold`; all others → `Noto Sans Regular`. Fallback is always `Noto Sans Regular`.
  - Both style JSONs re-generated; `verify-styles.js` extended to assert the new `glyphs` URL and that `country-label` uses `Playfair Display Bold`.

- [x] **8. Day/night terminator overlay**
  - `src/map/terminator.js` computes the terminator polygon from UTC time. Added as a low-opacity dark fill layer, updated every 60s. Reinforces morning/evening edition cadence visually.

## Priority 3 — Brand differentiator

- [x] **9. Source-to-story arcs (multi-source visualization)**
  - `src/map/arcs.js` draws great-circle arcs from each outlet's HQ to the story location. Static source→coords lookup in `src/map/sources.js` (~20 outlets). Animated `line-dasharray` draw-on effect. Both surfaces consume it via `useMeridianMap`.

- [x] **10. 3-color highlight palette**
  - CSS custom properties `--accent-active` (gold), `--accent-secondary` (pale blue-white), `--accent-trail` (muted gray-gold) defined in `src/index.css`. Focused location → active, other story locations → secondary, previous → trail; wired in `src/map/layers.js`.

## Priority 4 — Video output infrastructure

- [x] **11. Lock a `?mode=broadcast` rendering route**
  - `App.jsx` reads `?mode=broadcast` and `?shotlist=<url>` params; broadcast path renders only `<BroadcastStage broadcastMode shotlistUrl={...} />` — no DateNav, tabs, footer, theme toggle, or suggestions.
  - `useMeridianMap` accepts `broadcast` flag: `interactive: false`, `preserveDrawingBuffer: true`, `pixelRatio × 1.5`. `kernel.js` passes these to the Mapbox constructor.
  - Title-safe camera padding via `getMapPaddingBroadcast()` in `camera.js`: 28% bottom + 22% right bias keeps focal point in upper-left 60% of frame above the chyron bars.

- [x] **12. Add subtle film grain to video surface**
  - Created `src/components/FilmGrain.jsx`: canvas at 1/4 resolution (4×4 px clusters), 24fps rAF, `mix-blend-mode: overlay`, `opacity: 0.055`. Survives H.264 re-encode without moiré.
  - Mounted inside `BroadcastStage.jsx` only; website surface (`MapHero`) has no grain.

- [x] **13. Reliability + licensing for recorded output**
  - Geocoder bypass: `geocodeStory()` skipped when `broadcastMode=true` — only `analysis.locations` from the report drives the camera.
  - Mapbox attribution overlaid as text in the map container when in broadcast mode (required for recorded output).
  - Recording pipeline documented in `scripts/record-clip.js` (Playwright Chromium headless).

---

# Phase 2 — Recording pipeline

Goal: take a daily report + the broadcast-grade map and produce a final `.mp4` per platform, automatically.

Pipeline shape: **report JSON → shot list JSON → headless browser playback → silent video → narration mux → per-platform encode**.

## Priority 5 — Choreography + render plumbing

- [x] **14. Shot-list generator (`scripts/build-shotlist.js`)**
  - Reads `reports/<edition>.json`, filters stories with ≥2 sources, builds shots from `analysis.locations` (camera) + `analysis.summary` (narration) + consensus label (chyron).
  - Hold estimation: `Math.min(22, Math.max(5, Math.ceil(narration.length / 15)))` seconds.
  - CLI: `--edition` (required), `--max-duration` (default 90s), `--aspect` (default 16:9).
  - Output: `out/shotlists/<edition>.json`. No-location fallback: `{ lng: 0, lat: 20, zoom: 1.5 }`.

- [x] **15. Timeline-driven render mode (extends #11)**
  - `BroadcastStage` fetches shotlist JSON on mount when `shotlistUrl` is set, then drives all shots via `setTimeout` keyed to a shared epoch (`PRE_ROLL_MS + shot.t * 1000`) — no drift between shots.
  - `setActiveShot()` and `flyToLocation()` called in the same callback so chyron and camera are always in sync.
  - Pre-roll: black overlay fades out (0.9s) at epoch 0. Post-roll: overlay fades in (0.6s) at `duration` end, then `window.__meridianClipDone = true` after +1s.

- [x] **16. Headless render harness (`scripts/record-clip.js`)**
  - Playwright Chromium, `recordVideo` context option, viewport matches `--aspect` (1920×1080 or 1080×1920).
  - Polls `window.__meridianClipDone === true` every 500ms (generous timeout default: 180s), closes page to flush .webm, then moves from tmp path to `out/raw/<edition>.webm`.
  - CLI: `--edition`, `--aspect`, `--port` (default 3002), `--timeout`, `--out`.

## Priority 6 — Audio + finalize

- [x] **17. Narration pipeline (`scripts/synthesize-narration.js`)**
  - Provider detection: ElevenLabs (preferred) → OpenAI TTS → `--dry-run` silence. Voice pinned: ElevenLabs George (`JBFqnCBsd6RMkjVDRZzb`), OpenAI `onyx`. See `docs/voice.md`.
  - Per-shot WAVs at 44.1kHz stereo PCM 16-bit. Empty narration → silent gap (`silenceWav`).
  - Timed mix via `adelay+amix`: each shot delayed to `PRE_ROLL_MS + shot.t * 1000` ms → `out/audio/<edition>/full.wav`.
  - Note: requires system `ffmpeg` (Playwright's bundled build is audio-stripped — VP8/WebM only).

- [x] **18. ffmpeg mux + per-platform encode (`scripts/finalize-clip.js`)**
  - Two-pass loudnorm: analysis pass captures EBU R128 JSON from stderr, encode pass uses `linear=true` with measured stats.
  - Optional bed music mixed at 0.12 volume underneath narration.
  - Platforms: `youtube` (16:9, −14 LUFS), `tiktok` (9:16 center-crop `608:1080→1080:1920`, −16 LUFS), `square` (1:1 `1080:1080`, −14 LUFS).
  - Encode: `libx264 -crf 18 -preset slow -pix_fmt yuv420p`, AAC 192k, `+faststart`. Thumbnail PNG at PRE_ROLL+5s.

- [x] **19. End-to-end recipe (`npm run produce-clip`)**
  - `scripts/produce-clip.js`: build-shotlist → record-clip → synthesize-narration → finalize-clip.
  - Auto-starts Express on `:3002` if not running (TCP probe + 15s wait), shuts it down after recording.
  - Falls back to `--dry-run` narration with a warning when no TTS key is set.
  - Each stage exits non-zero with a labelled error on failure. Prints file summary at end.
  - Smoke test: `node scripts/produce-clip.js --edition=<edition> --max-duration=30`.

---

## Notes / decisions log

### 2026-05-09 — First live broadcast test (bugs fixed)

Five issues surfaced during first `?mode=broadcast` browser test:

1. **Broadcast showed fallback screen** — `App.jsx` defaulted to the most recent date (`2026-05-08`, articles-only, no report). Fixed by adding `?date=` and `?edition=` URL params so broadcast mode can target a specific edition. Full URL format: `/?mode=broadcast&date=YYYY-MM-DD&edition=morning|evening&shotlist=/out/shotlists/<edition>.json`.

2. **Black screen (pre-roll overlay stuck)** — shotlist fetch was CORS-blocked (`localhost:5174 → localhost:3002` is cross-origin). Fixed by adding `/out` to the Vite proxy in `vite.config.js`. Shotlist URL must be relative (`/out/...`).

3. **`line-trim-offset[1] > 1` Mapbox error** — rAF timestamp represents frame-start time; `performance.now()` called mid-frame can be fractionally later, making `t` slightly negative and `(1-t)**3` slightly above 1. Fixed with `Math.max(0, Math.min(1, ...))` clamp in `layers.js`.

4. **Arcs layers not found on first shot** — `createMap` resolves before `map.on('load')` fires (which is where `applyMapStyle` adds the arc layers). First shot at `PRE_ROLL_MS = 1s` could arrive before layers exist. Fixed in `useMeridianMap.js`: `updateArcs` guards on `map.getLayer('arcs-glow')`; init effect adds `map.once('load', drainPendingArcs)` to re-apply deferred arcs after layers are added.

5. **Mapbox tile 404s** — normal; Mapbox returns 404 for empty vector tiles (ocean, no-data zoom levels). Not an error.

### 2026-05-28 — Broadcast video quality pass

Full quality overhaul after first end-to-end render with ElevenLabs + Mapbox. Pipeline now produces broadcast-grade output from `node scripts/produce-clip.js --edition=<edition>`.

**Audio:** `<Sequence durationInFrames>` added to cap each shot's audio at its boundary — eliminates narration bleed. `synthesize-narration.js` probes each WAV with `ffprobe` and rewrites `shot.hold` + cameraPath tOffsets with real measured durations so `durationInFrames` is audio-accurate.

**Narration source:** `build-shotlist.js` reads `broadcasts/<edition>.json` from the pipeline (sibling `my-news-analyzer-pipeline/broadcasts/`) and uses `beats[i].narration` directly. Falls back to `buildNarration()` when no broadcast file is present. First/last paragraphs of `broadcast.script` are extracted as intro/outro globe shots.

**Camera:** Multi-location shots use a "hold → 2.5 s fly → hold" waypoint model (`FLY_BETWEEN_S`). Cross-shot transition reduced to 0.8 s (`FLY_DURATION_S`). Story shots have fixed bearing (no ambient drift); globe intro/outro shots spin at 1.5°/s. Zoom is location-aware: large countries → 4, small countries/US states → 6, cities → 9.

**Map:** Night overlay opacity halved in broadcast mode (0.38 → 0.18). `story-path` dashed line layer added (broadcast-only) connecting each shot's locations. Settlement label LOD raised: `settlement-major-label` minzoom 6, `settlement-minor-label` minzoom 9 — country zoom shows only state names, state zoom adds city names, city zoom adds towns.

**Bug fixed:** `produce-clip.js` was passing `--max-duration=90` (its own default) to `build-shotlist.js`, overriding the new 360 s default. Fixed on line 49.

### 2026-05-09 — Map label debugging (post-checklist)

Two bugs in `scripts/build-meridian-styles.js` caused labels to be missing or inconsistent across the globe view:

1. **Multi-font stacks 404 silently** — `applyTypography()` used font stacks like `['Playfair Display Bold', 'Noto Sans Regular']`. Mapbox GL JS joins the array with commas as the glyph URL path segment (`/fonts/Playfair Display Bold,Noto Sans Regular/0-255.pbf`). `build-glyphs.js` generates per-font directories, not per-combination — so every multi-font layer 404'd and rendered no labels. Only `['Noto Sans Regular']` layers (water, minor cities, airports) worked. **Fix:** all font stacks changed to single-font arrays. Constraint is permanent given the per-font glyph directory layout.

2. **Static `text-size: 20` on `country-label`** — all other label layers use zoom-interpolated text sizes; `country-label` had a flat `20` at every zoom. At globe zoom (~1.0), 20px labels for 190+ countries overwhelmed Mapbox collision detection, hiding most. **Fix:** `['interpolate', ['linear'], ['zoom'], 1, 9, 4, 14, 7, 18, 10, 20]`, extracted to `COUNTRY_LABEL_TEXT_SIZE` constant. `verify-styles.js` now asserts this is interpolated so it can't silently revert.

### 2026-06-01 — Semantic-anchor shot selection (Phases A + B)

Root problem: even-spacing camera moves (`hold / N` partitions) caused the map to arrive at a location before or after it was spoken, breaking visual–audio sync. Fix: pin each mid-story camera move to the character timestamp of the first character of the location name as spoken.

**New modules:**
- `scripts/anchor-finder.js` — fuzzy-matches `report.story.analysis.locations[]` against ElevenLabs `normalized_text` using longest-match-first alias resolution (static aliases + 30-country adjective map, word-boundary lookarounds, masked ranges). Exports `findAnchors`, `filterAnchors`, `buildAnchoredCameraPath`, `ANCHOR_DEFAULTS`.
- `scripts/intent-classifier.js` — per-anchor sentence classifier: `data | contrast | stakes | reveal | hold`. First-match-wins; data uses regex for digit/written-number patterns, contrast has a quote guard (>50% quoted chars → skip), stakes checks modal/risk vocabulary.

**Pipeline change:** build-shotlist still emits uniform `cameraPath` waypoints. synthesize-narration now switches to the ElevenLabs `with-timestamps` endpoint, writes per-shot `shot-N.timestamps.json` sidecars, then runs a re-anchor pass that overwrites `shot.cameraPath` and `shot.overlays` in the shotlist JSON. `shot.cameraSource` records `'anchored'` vs `'uniform'`.

**Intent → camera/overlay mapping:**
| Intent | Camera | Overlay |
|---|---|---|
| `reveal` | fly to new location | — |
| `contrast` | pull back to midpoint (zoom −2); skip if \|Δlng\| > 120° | — |
| `stakes` | push in +0.5 zoom on prior position | — |
| `data` | no move | `data-callout` text box for 2.2 s |
| `hold` | no move | — |

**New Remotion component:** `DataCallout` in `overlays.jsx` — center-bottom-third, large Playfair Display numeral, gold pill, 9-frame fade in/out. `dataCalloutOpacity` extracted as an exported pure function so it can be unit-tested directly.

**Broadcast.jsx:** renders `shot.overlays[]` as frame-anchored `<Sequence>` + `<DataCallout>` blocks.

**Constants:** `LEAD_TIME_S: 0.4`, `MIN_DWELL_S: 1.8`, `MERGE_SAME_LOCATION_S: 4`. All overridable via `--lead-time`, `--min-dwell` CLI flags. `--no-anchored` disables re-anchoring; `--debug-anchors` prints per-shot match diagnostics.

**Fallback:** shots with no ElevenLabs timestamps (OpenAI fallback, dry-run, TTS error) keep their uniform cameraPath unchanged.

**Precision fix:** tOffset / hold / elapsed now stored at 3dp (was 1dp), preventing ~50ms timing drift per shot.
