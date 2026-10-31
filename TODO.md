# TODO

## Redesign behavior requirements

Check these when the new layout is built:

- A story group opens as one item. `expandedStory` holds the group's id. The active thread and active tab are separate state, reset to thread 1 and Facts each time a group or story opens. Switching threads or tabs never triggers `scrollAnchor` and never closes the item.
- Group ids (`group-0`) and story ids (`story-group-0`) are different namespaces; never compare across them.
- The map follows the open item's lead (multi-source) story. The "Single-outlet reports" thread keeps the lead story's location.
- Settings panel: a fixed slide-over above everything, including the fullscreen map (the map uses z-index 30 pinned and 50 fullscreen, so the panel needs 60 or more). Lock page scroll while it's open. Escape closes it (the fullscreen map also listens for Escape; the panel takes precedence when open). The gear must appear both in the map's status strip and in the Show Map bar, or settings can't be reached with the map hidden.
- Read checkmarks, settings and thread state must not cause map moves (covered by Task 1 memoization; re-test after the migration).

## Phone layout (decide later)

The pinned map takes 45% of the screen height, leaving roughly half the screen for an open story with tabs on narrow devices. Options: shrink the map while a story is open, or let the map scroll away on narrow screens. Defer to phone-layout redesign phase.

## Render Performance — Tile Cache Pre-Warming

Tile network latency is the primary bottleneck in Remotion renders after the GPU fix (2026-06-12). Short zoomed shots stall waiting for Mapbox tiles that haven't been fetched yet.

**Task:** Modify `useRemotionMap.js` (or add a warmup pass in `produce-clip.js`) to pre-fetch all camera positions in the shotlist before frame capture begins — jump to each position, wait for `idle`, then signal `mapReady`.

**Reference:** `docs/sessions/2026-06-12-render-optimization.md` has full diagnosis and benchmark numbers. Average frame time at zoomed views is ~195ms; pre-warming should bring this closer to globe-view times (~10–25ms).
