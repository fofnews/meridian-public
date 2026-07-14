# TODO

## Render Performance — Tile Cache Pre-Warming

Tile network latency is the primary bottleneck in Remotion renders after the GPU fix (2026-06-12). Short zoomed shots stall waiting for Mapbox tiles that haven't been fetched yet.

**Task:** Modify `useRemotionMap.js` (or add a warmup pass in `produce-clip.js`) to pre-fetch all camera positions in the shotlist before frame capture begins — jump to each position, wait for `idle`, then signal `mapReady`.

**Reference:** `docs/sessions/2026-06-12-render-optimization.md` has full diagnosis and benchmark numbers. Average frame time at zoomed views is ~195ms; pre-warming should bring this closer to globe-view times (~10–25ms).
