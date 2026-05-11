# Session — 2026-05-09

Branch: `main` — first live test of the broadcast stage; five bugs found and fixed.

## What was worked on

Opened `?mode=broadcast` in the browser for the first time and debugged the render path from blank screen to a working broadcast stage.

### Bug 1 — Broadcast mode showed fallback screen ("THE MERIDIAN" only)

`App.jsx` always defaults to the most recent date. Today `2026-05-08` is articles-only (no report), so `report = null` and the broadcast check returned `broadcastFallback`.

**Fix (`App.jsx`):** Added `?date=` and `?edition=` URL params. When both are present in broadcast mode, `loadReport` targets that specific edition instead of the most recent date.

Broadcast URL format:
```
/?mode=broadcast&date=YYYY-MM-DD&edition=morning|evening&shotlist=/out/shotlists/<edition>.json
```

### Bug 2 — Black screen after fixing date params

The shotlist fetch was CORS-blocked. `BroadcastStage` fetches `shotlistUrl` directly; the URL `http://localhost:3002/out/...` is cross-origin from the Vite dev server at `:5174`. `shotlist` stayed null, so the pre-roll overlay (opacity 1) never faded.

**Fix (`vite.config.js`):** Added `/out` to the Vite proxy alongside `/api`. The shotlist URL must be a relative path (e.g. `/out/shotlists/2026-05-07-morning.json`) so it routes through the proxy to Express.

### Bug 3 — `line-trim-offset[1]` > 1 error (arcs animation)

The rAF `tick(now)` callback receives a `DOMHighResTimeStamp` representing when the frame *began*. When `updateArcs` is called mid-frame, `performance.now()` (used as `start`) can be fractionally *later* than the first rAF `now`. This makes `t` slightly negative, `(1 - t)**3` slightly above 1, and Mapbox rejects it.

**Fix (`layers.js`):** Clamped `trimEnd` with `Math.max(0, Math.min(1, 1 - eased))`.

### Bug 4 — Arcs layers don't exist error on first shot

`createMap` resolves and sets `mapRef.current` before the map's `load` event fires. `applyMapStyle` (which adds `arcs-glow` and `arcs-edge`) runs inside the `load` handler. When the shotlist fires its first shot at `PRE_ROLL_MS = 1s`, the layers may not exist yet.

**Fix (`useMeridianMap.js`):**
- `updateArcs`: guard with `map.getLayer('arcs-glow')` — if layers don't exist, save args to `lastArcsRef` and return without animating.
- Init effect: after `createMap` resolves, add a `map.once('load', drainPendingArcs)` callback. It runs after `kernel.js`'s `load` handler (which adds the layers), then re-applies any arcs that arrived during loading.

### Non-issue — Mapbox tile 404s

`mapbox.country-boundaries-v1` returns 404 for tiles with no data (open ocean, certain zoom levels). This is Mapbox's expected behavior for empty vector tiles and does not affect rendering.

## Key decisions made

- `?date` and `?edition` params are broadcast-only — the website always loads the most recent date. This keeps the website behavior unchanged.
- Shotlist URL must be relative (`/out/...`) not absolute (`http://localhost:3002/...`) when using the Vite dev server, so it routes through the proxy.
- The `once('load')` drainer in the init effect fires after `kernel.js`'s `load` handler because event listeners fire in registration order — kernel registers first (at map construction time), so it always runs before the drainer.

## Discoveries / surprises

- The rAF timestamp / `performance.now()` skew is real and reproducible — the clamp is genuinely necessary, not defensive.
- CORS applies between ports on the same host. `localhost:5174 → localhost:3002` is cross-origin.
- In broadcast mode the page goes through the same full report-loading flow as the website. There's no shortcut — the report data is needed for `multiSource` (the stories passed to BroadcastStage).

## Files modified

- `src/App.jsx` — `?date` and `?edition` URL params for broadcast mode; `broadcastDate`/`broadcastEdition` added to `useMemo` return and `useEffect` dep array
- `vite.config.js` — `/out` added to Vite proxy
- `src/map/layers.js` — `trimEnd` clamped to `[0, 1]`
- `src/map/useMeridianMap.js` — `updateArcs` guards on `getLayer`; `drainPendingArcs` `once('load')` callback in init effect

## Context for next session

- Broadcast URL requires explicit `?date` and `?edition` — it will not auto-select the right edition. The shotlist filename matches the edition (e.g. `2026-05-07-morning.json` → `date=2026-05-07&edition=morning`).
- `/out/shotlists/` is served by Express and proxied through Vite. Both must be running (`npm run dev`) for the broadcast preview to work locally.
- The `drainPendingArcs` pattern in `useMeridianMap.js` mirrors the existing `pendingFlyRef` pattern for fly-to requests that arrive before the map is ready.

## Open items / next steps

- Minor open items from 2026-05-07 review still pending (see that session doc).
- Consider whether `?date`/`?edition` should be validated against `/api/dates` in broadcast mode (currently silently fails if the edition doesn't exist).

---

# Session — 2026-05-09 (map labels)

## What was worked on

Debugged missing and inconsistent map labels across territory, city, and water body layers. Two root causes found and fixed in `scripts/build-meridian-styles.js`.

## Root causes and fixes

### Bug 1 — Multi-font stacks 404 silently

`applyTypography()` assigned font stacks like `['Playfair Display Bold', 'Noto Sans Regular']`. Mapbox GL JS joins the array with commas to construct the glyph URL: `/fonts/Playfair Display Bold,Noto Sans Regular/0-255.pbf`. No such directory exists — `build-glyphs.js` generates per-font directories only. Every multi-font layer (country, continent, state, major cities) produced 404s and rendered no labels. Only single-font `['Noto Sans Regular']` layers worked.

**Fix:** Changed all font stacks to single-font arrays. Labels use `name_en` (Latin); the primary fonts cover all required glyphs.

### Bug 2 — Static `text-size: 20` caused globe-zoom collision

`country-label` had `text-size: 20` (static) instead of a zoom-interpolated expression. At globe zoom (~1.0), every country tried to render at 20px; Mapbox collision detection hid most. All other label layers retained their original zoom-interpolated expressions.

**Fix:** `['interpolate', ['linear'], ['zoom'], 1, 9, 4, 14, 7, 18, 10, 20]`. Extracted to `COUNTRY_LABEL_TEXT_SIZE` constant so dark and light themes share it.

### Bug 3 — Merge conflict left `buildLight` with static value

After fixing, a merge conflict reverted `buildLight` to `'text-size': 20` while `buildDark` got the constant. The built JSONs were correct (committed before the conflict) but the source script was wrong. Caught immediately by the new `verify-styles.js` assertion when `build-styles` was re-run.

## Key decisions

- **Single-font stacks only** in `applyTypography()` — permanently constrained by the per-font glyph directory layout from `build-glyphs.js`. Adding any fallback font to a `text-font` array will silently break that layer.
- `verify-styles.js` now asserts `country-label text-size` is an interpolated expression.

## Discoveries

- Mapbox GL JS glyph requests use the full comma-joined fontstack as a path segment. Supporting multi-font fallback requires a compositing glyph server — serving individual PBF files is not sufficient.
- The pipeline's `gitCommitAndPush` pushes to `origin/main` via temp-index without updating local HEAD. The local clone drifts behind origin after each pipeline run; `git pull` is needed before local commits. This is intentional — avoids interfering with local development work.

## Files modified

- `scripts/build-meridian-styles.js` — single-font stacks, `COUNTRY_LABEL_TEXT_SIZE` constant, `buildLight` regression fixed
- `scripts/verify-styles.js` — `text-size` interpolation assertions for both themes
- `public/meridian-dark.style.json` / `public/meridian-light.style.json` — rebuilt artifacts
