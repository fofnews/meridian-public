# Map → Broadcast Backdrop Checklist

Goal: turn `BroadcastHero`'s Mapbox map from an interactive info widget into a video-grade backdrop for news clips generated from Meridian reports.

**Status:** 0 / 13 complete · Last updated: 2026-04-30

To resume work in a new session: ask Claude to read `docs/map-broadcast-checklist.md`.

---

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

- [ ] **12. Drop CRT scanlines for video, replace with subtle grain**
  - Remove or gate the `.scanlines` overlay behind `mode !== 'broadcast'`
  - Add a low-opacity animated film-grain canvas/SVG noise as replacement
  - Test through a YouTube-style re-encode to confirm no moiré/aliasing

- [ ] **13. Reliability + licensing for recorded output**
  - Remove the headline-word geocoder fallback (`extractLocationQuery` in `BroadcastHero.jsx`) for broadcast mode — only use `analysis.locations` from the report (a wrong geocode reads as a factual error on video)
  - Confirm Mapbox commercial-use licensing for recorded video, OR add attribution to video credits
  - Document the recording pipeline (Puppeteer/Playwright/OBS?) once chosen

---

## Notes / decisions log

_Add notes here as we work through items — what was tried, what was rejected, follow-ups._
