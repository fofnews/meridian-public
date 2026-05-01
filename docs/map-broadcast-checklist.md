# Map → Broadcast Backdrop Checklist

Goal: turn `BroadcastHero`'s Mapbox map from an interactive info widget into a video-grade backdrop for news clips generated from Meridian reports, then build the recording pipeline that turns each daily edition into publishable video.

**Status:** 3 / 23 complete · Last updated: 2026-04-30

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

- [ ] **0d. Move broadcast-costume elements to video-only surface**
  - The chyron (upper + lower bars), LIVE badge, scrolling ticker, and CRT scanlines all currently render on the website surface inside `BroadcastHero.jsx`. Move them to the video wrapper only.
  - Concretely on the website:
    - Remove the upper/lower chyron bars (the headline + edition info bars beneath the map)
    - Remove the red `LIVE` badge from the top bar
    - Remove the scrolling gold ticker beneath the map
    - Remove the `.scanlines` overlay div
  - Replace with a minimal status strip on the website: edition label (`Morning · Apr 30`) + freshness indicator (`Updated 2h ago`) + the existing top-bar `THE MERIDIAN` wordmark and clock. Sober, not theatrical.
  - The map itself stays cinematic on the website (globe, glow, marker, arcs) — only the surrounding TV-graphics chrome moves.
  - Create `src/components/BroadcastStage.jsx` (new) that wraps the kernel + chyron + LIVE + ticker + grain overlay. This is what `?mode=broadcast` renders.
  - The website route renders a new lighter wrapper (`InteractiveMap.jsx` or rename `BroadcastHero.jsx` → `MapHero.jsx`) that wraps the kernel + the minimal status strip only.

---

# Phase 1 — Map as broadcast backdrop

All Phase 1 items land in the shared kernel (Phase 0a) unless otherwise noted. Both surfaces inherit changes automatically.

## Priority 1 — Highest visual impact

- [ ] **1. Switch to globe projection + atmospheric fog**
  - Set `projection: 'globe'` on the `Map` constructor in `src/components/BroadcastHero.jsx`
  - Add `map.setFog({ color, 'high-color', 'horizon-blend', 'space-color', 'star-intensity' })` after style load
  - Verify story flyTo still frames correctly on the sphere (may need to lower zoom for wide regions)

- [ ] **2. Author a custom Mapbox style and stop patching `dark-v11` at runtime**
  - Build `meridian.style.json` in Mapbox Studio (or hand-author) covering: land, water, country borders, admin-1, country labels, place labels, graticule, day/night
  - Replace the runtime `applyMapStyle` patching block in `BroadcastHero.jsx` with a single `style:` URL
  - Keep the country-highlight / state-highlight layers as runtime additions (they're data-driven), but drop the try/catch label/road/poi mutations

- [ ] **3. Replace flat country-fill highlight with a glowing edge**
  - Two stacked `line` layers on `country-boundaries`: wide (8–12px, low-opacity, `line-blur: 4`) + narrow (1.5px, full-opacity)
  - Both filtered by `iso_3166_1` like today's `country-highlight`
  - Drop or de-emphasize the existing flat `fill` highlight

## Priority 2 — Cinematic camera + on-theme detail

- [ ] **4. Cinematic camera moves (pitch, bearing, longer easing)**
  - Update `flyToLocation` in `BroadcastHero.jsx` to pass `pitch: 45–60`, optional `bearing` offset
  - Lengthen `duration` from 2000 → 4000–6000 ms
  - Consider a two-step move: ease out to wider view, then fly in to target

- [ ] **5. Radar-pulse marker (3 staggered rings)**
  - Replace single-ring DOM marker in `createMarkerElement` with three rings on staggered animation delays
  - Update CSS keyframes (`dot-pulse`, `dot-pulse-light`) accordingly
  - Confirm pulse loops visibly during the multi-second camera hold

- [ ] **6. Graticule overlay (lat/lon gridlines)**
  - Generate static GeoJSON multi-line at 10° or 15° intervals (commit as `public/graticule.geojson` or inline)
  - Add as a `line` layer at 10–15% opacity, beneath labels

- [ ] **7. Custom typography for place labels**
  - Self-host Playfair Display SDF glyph set, expose via Mapbox style's `glyphs:` URL
  - Update `text-font` on country-label / place-label layers in the custom style

- [ ] **8. Day/night terminator overlay**
  - Compute terminator polygon from current UTC time (cheap math, runs once per minute)
  - Add as a low-opacity dark fill layer on the night side
  - Reinforces morning/evening edition cadence visually

## Priority 3 — Brand differentiator

- [ ] **9. Source-to-story arcs (multi-source visualization)**
  - For the featured story, draw a thin gold great-circle arc from each contributing outlet's HQ to the story location
  - Requires a static `source → {lat, lng}` lookup for the ~20 sources (commit as `src/sources.js`)
  - Render via a `line` layer with computed great-circle geometry, animate `line-dasharray` for the "draw-on" effect
  - This is the unique product expression — prioritize even if other items slip

- [ ] **10. 3-color highlight palette**
  - Currently every accent uses `--accent` (#e8c547)
  - Define `--accent-active` (gold), `--accent-secondary` (cool white / pale blue), `--accent-trail` (muted gray-gold)
  - Wire focused location → active, other story locations → secondary, previous story → trail

## Priority 4 — Video output infrastructure

- [ ] **11. Lock a `?mode=broadcast` rendering route**
  - Read URL param in `App.jsx`; when `broadcast`, hide DateNav, view tabs, footer, theme toggle, scroll-to-top, suggestions
  - Force fixed 16:9 aspect (or 9:16 toggle), `interactive: false`, `preserveDrawingBuffer: true`, higher `pixelRatio`
  - Disable map +/-/expand/minimize controls in this mode
  - Respect title-safe zone: keep marker / focus point in upper 60% of frame, chyron + ticker in bottom 20%

- [ ] **12. Add subtle film grain to video surface**
  - Scanlines have already been removed from both surfaces in 0d (they fail under encoding — moiré + aliasing on YouTube/TikTok re-encode)
  - Add a low-opacity animated film-grain canvas/SVG noise overlay to `BroadcastStage.jsx` only
  - Should survive a YouTube-style re-encode without aliasing — test before declaring done
  - Do not add grain to the website surface (item 0d keeps the website sober)

- [ ] **13. Reliability + licensing for recorded output**
  - Remove the headline-word geocoder fallback (`extractLocationQuery` in `BroadcastHero.jsx`) for broadcast mode — only use `analysis.locations` from the report (a wrong geocode reads as a factual error on video)
  - Confirm Mapbox commercial-use licensing for recorded video, OR add attribution to video credits
  - Document the recording pipeline (Puppeteer/Playwright/OBS?) once chosen

---

# Phase 2 — Recording pipeline

Goal: take a daily report + the broadcast-grade map and produce a final `.mp4` per platform, automatically.

Pipeline shape: **report JSON → shot list JSON → headless browser playback → silent video → narration mux → per-platform encode**.

## Priority 5 — Choreography + render plumbing

- [ ] **14. Shot-list generator (`scripts/build-shotlist.js`)**
  - Input: an edition (`2026-04-30-evening`)
  - Output: `out/shotlists/<edition>.json` matching the schema below
  - Pull camera targets from `analysis.locations` for each top story; pull narration text from `analysis.summary` plus 1–2 key agreements/disagreements
  - Estimate per-shot duration heuristically (≈15 chars/sec for TTS) and stash it as `hold`
  - Cap clip length (e.g. 90s default) by selecting top-N stories
  - Schema:
    ```json
    {
      "edition": "2026-04-30-evening",
      "aspect": "16:9",
      "duration": 90,
      "shots": [
        { "t": 0, "camera": { "lng": -75.16, "lat": 39.95, "zoom": 5, "pitch": 50, "bearing": -10 },
          "chyron": { "label": "BREAKING", "headline": "..." },
          "narration": "...",
          "hold": 8 }
      ]
    }
    ```

- [ ] **15. Timeline-driven render mode (extends #11)**
  - Accept `?shotlist=<url-or-path>` in addition to `?mode=broadcast`
  - On load, fetch the shot list, then drive `flyTo`, chyron updates, marker updates, source-arc draws on a wall-clock timeline starting at first paint
  - Critical: chyron / label changes happen **during** the camera move, not before/after — DOM state must match camera state every frame
  - When the last shot finishes, set `window.__meridianClipDone = true` so the recorder knows to stop
  - Add a 1s pre-roll black frame and 1s post-roll fade so encoders don't clip the first/last beat

- [ ] **16. Headless render harness (`scripts/record-clip.js`)**
  - Playwright launching Chromium at fixed viewport (1920×1080 for 16:9, 1080×1920 for 9:16)
  - Navigate to `http://localhost:3002/?mode=broadcast&shotlist=/out/shotlists/<edition>.json`
  - Use `recordVideo` context option to capture .webm, OR `page.screencast` if newer Playwright
  - Wait for `window.__meridianClipDone === true` (with a generous timeout) before closing context (closing flushes the file)
  - CLI: `node scripts/record-clip.js --edition=2026-04-30-evening --aspect=16:9 --out=out/raw/<edition>.webm`
  - Defer frame-by-frame deterministic rendering — only revisit if real-time capture produces visible jitter

## Priority 6 — Audio + finalize

- [ ] **17. Narration pipeline (`scripts/synthesize-narration.js`)**
  - For each shot in the shot list, synthesize TTS from `narration` text via chosen provider (ElevenLabs preferred for quality; OpenAI TTS as cheaper fallback)
  - Pin a single voice ID for brand consistency; document it in `docs/voice.md`
  - Save `out/audio/<edition>/shot-<n>.wav`
  - Concatenate with silence padding so each shot's audio starts at its `t` offset → `out/audio/<edition>/full.wav`
  - Fail gracefully if narration field is empty (silent gap rather than crash)

- [ ] **18. ffmpeg mux + per-platform encode (`scripts/finalize-clip.js`)**
  - Inputs: silent video, narration WAV, optional bed music
  - Mix narration loud (1.0) + bed music low (0.10–0.15) via `amix`
  - Master encode: `libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k`
  - Loudness-normalize: −14 LUFS for YouTube, −16 LUFS for TikTok (loudnorm filter, two-pass)
  - Per-platform variants: 16:9 master, 9:16 crop (smart-cropped to keep marker/focus in frame — may need shot-list metadata flag), 1:1 if needed
  - Output: `out/final/<edition>-<platform>.mp4` plus thumbnail PNG per variant

- [ ] **19. End-to-end recipe (`npm run produce-clip`)**
  - One command takes you from edition ID to publishable files: build shotlist → record → narrate → mux → encode all variants
  - Exit non-zero on any stage failure with clear stage label
  - Smoke test: produces a watchable 30s clip from a real edition without manual intervention
  - This is the acceptance test for Phase 2 — until this works, the project isn't done

---

## Notes / decisions log

_Add notes here as we work through items — what was tried, what was rejected, follow-ups._
