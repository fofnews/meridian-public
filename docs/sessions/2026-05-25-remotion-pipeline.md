# 2026-05-25: Remotion Pipeline End-to-End Debugging

## What was done
Debugged and fixed the full Remotion broadcast render pipeline (`produce-clip.js`) on Windows.
All 12 tasks from the implementation plan are complete. The pipeline now works end-to-end:
`edition → shotlist → narration WAVs → remotion render (raw MP4) → finalize-clip (youtube MP4 + thumbnail)`

## Fixes applied (in order)

### Windows-specific
1. `remotion.cmd` instead of `remotion` — bash shebang scripts aren't executable via Node on Windows
2. `shell: true` for `execFileSync` — required to run `.cmd` files
3. Props via temp JSON file — Windows CMD strips double quotes from inline `--props={"..."}` JSON

### CORS
4. `Access-Control-Allow-Origin: *` on `/out/shotlists` and `/out/audio` — Remotion's Chrome (port 3003) fetches these from Express (port 3002)

### Mapbox token
5. `process.env.VITE_MAPBOX_TOKEN` fallback in `kernel.js` — `import.meta.env` is Vite-only, not available in webpack bundle
6. Webpack DefinePlugin in `remotion.config.js` to inject token into bundle
7. `require('webpack')` not `createRequire(import.meta.url)` — remotion.config.js runs as CJS
8. Token passed as a Remotion prop (`mapboxToken`) from `produce-clip.js` → Chrome, as belt-and-suspenders. Set in `createMap` just before `new mapboxgl.Map()`
9. `Config.setChromiumOpenGlRenderer('angle')` — Mapbox GL requires WebGL, angle is most reliable on Windows headless Chrome

### Map style loading
10. `style.load` instead of `load` for ready signal — `load` waits for Mapbox tile CDN which times out in headless Chrome; `style.load` fires when the style JSON is parsed, sufficient for `jumpTo` operations
11. Style URL uses Express server (`http://localhost:3002/`) not Remotion webpack server (`localhost:3003`) — Remotion does NOT serve `publicDir` files from its webpack dev server despite `Config.setPublicDir('./public')`
12. Express now serves `public/` with CORS so Chrome at port 3003 can fetch style files

## Key findings
- Remotion's `Config.setPublicDir('./public')` does NOT make the webpack dev server serve those files during headless render (despite the Studio UI working fine). Always use an external server for style/font files in render mode.
- `mapbox://sprites/...` and `composite` tile sources (Mapbox CDN) return 403 with a development token from localhost — these 403s are logged but don't block `style.load`, so they're harmless for render.
- Render performance: ~20ms/frame after first frame (first frame ~1.3s including map init). 2670 frames (89s @ 30fps) renders in ~10 minutes.
