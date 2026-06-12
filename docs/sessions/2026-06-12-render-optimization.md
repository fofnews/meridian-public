# Session — 2026-06-12 — Remotion render optimization (programmatic API + --disable-direct-composition)

## What was worked on

Diagnosed the ~30-minute Remotion render time and implemented a software fix. Switched `produce-clip.js` Stage 3 from the Remotion CLI to the programmatic API to inject `--disable-direct-composition` into headless Chrome's launch args.

## Root cause diagnosis

The AMD Radeon HD 6950 (driver Catalyst 15.7.1 / 2015) crashes Chrome's GPU process on startup via `AMD VideoProcessorGetOutputExtension failed (0x80004005)` in `direct_composition_support.cc`. Chromium falls back to SwiftShader (software WebGL) for all GL work. Result: ~250ms per frame for a Mapbox GL globe render → ~30 min for a 4-minute video (7,860 frames).

Why the flag couldn't be injected before: Remotion's CLI `--chromium-options` only accepts an allowlisted set of flags (`--gl`, `--disable-web-security`, etc.). `--disable-direct-composition` is silently dropped.

## Key decisions

- **Programmatic API switch**: `bundle()` from `@remotion/bundler` + `HeadlessBrowser.create()` + `selectComposition()` + `renderMedia()` from `@remotion/renderer`.
- **Package exports bypass**: `HeadlessBrowser` and `getLocalBrowserExecutable` are internal modules not exposed by `@remotion/renderer`'s `exports` map. Loaded via `_require(join(ROOT, 'node_modules/@remotion/renderer/dist/browser/Browser.js'))` using `createRequire(import.meta.url)`.
- **Single browser instance** shared across both 16:9 and 9:16 renders; bundle compiled once and reused.
- **Webpack override** replicated from `remotion.config.js` to inject `VITE_MAPBOX_TOKEN` via `DefinePlugin` — required or Mapbox map fails silently.

## Test results

Verified with `2026-05-31-evening --max-duration=30 --platforms=youtube` (713 frames, 23.8s clip):

| Frame time | Count | What |
|---|---|---|
| <50ms | 58 (8%) | Globe view — hardware GL confirmed working |
| 50–200ms | 367 (51%) | Zoomed shots — tile loading dominates |
| >200ms | 288 (40%) | Zoomed shots — heavy tile areas |
| Average | 195ms | vs ~250ms before fix |
| Projected 4-min render | ~25 min | vs ~30 min before |

The GPU fix is real: globe frames went from ~250ms to 10–25ms (hardware GL). The remaining bottleneck is Mapbox tile network latency at zoomed views, not GPU. An RTX 4060 would not help this bottleneck.

## Files modified

- `scripts/produce-clip.js` — Stage 3 rewritten: CLI → programmatic API with custom Chrome launch

## Context for next session

- The programmatic render path is production-ready. Verified end-to-end (output MP4 + thumbnail produced correctly by Stage 4 finalize).
- The `HeadlessBrowser`/`getLocalBrowserExecutable` internal imports will break if `@remotion/renderer` is upgraded and the internal file paths change. Worth checking after any Remotion version bump.
- Tile loading is the new bottleneck. To cut render time further: pre-warm the tile cache by running a silent pass through all camera positions before starting frame capture.

## Open items / next steps

- Tile cache pre-warming: modify `useRemotionMap.js` to run a warmup loop (all `jumpTo()` positions, wait for `idle` each time) before signalling `mapReady`. This would pre-fill the local tile cache so subsequent frame captures don't wait on network.
- If warmup isn't sufficient, consider a two-pass render: record map sequence with real Chrome GPU + screen capture, then composite overlays as a second Remotion pass using `<Video>` for the map layer.
