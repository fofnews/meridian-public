# Native 9:16 (TikTok) Render — Design Spec

**Date:** 2026-06-04
**Status:** Approved

## Problem

The TikTok output is currently produced by cropping a 608×1080 strip from the center of the 1920×1080 YouTube master, then scaling to 1080×1920. This means:

- `QuoteCallout` (positioned at `left: 5%`) is completely outside the crop window and invisible.
- `TopBar` wordmark and date/time are cropped off at both edges.
- Text and UI elements were designed for a 16:9 canvas — the proportions feel wrong on vertical.

## Solution

Render two separate Remotion compositions: `Broadcast` (1920×1080, 16:9) for YouTube, and `Broadcast916` (1080×1920, 9:16) for TikTok. Each is a native render — no ffmpeg crop. The `aspect` prop, already plumbed through the pipeline, drives layout switching in the components.

## Layout: 9:16 Option B — Full-Bleed Map

The map fills the entire 1080×1920 frame. All overlays float on top.

- **Map div**: `position: absolute; inset: 0` (replaces the `flex: 1` map area in 16:9)
- **TopBar**: already `position: absolute; top: 0` — works unchanged
- **Chyron**: already `position: absolute; bottom: 0` — works unchanged
- **Ticker**: wrapped in `position: absolute; bottom: 0; left: 0; right: 0` alongside the Chyron (matches current behavior where Chyron covers Ticker when active)
- **SubtitleBar**, **MapAttribution**, **QuoteCallout**: repositioned via `aspect` prop (see below)

The 16:9 layout (flex column with dedicated ticker/chyron panel below the map) is **unchanged**.

## All-Video Changes (16:9 and 9:16)

These apply to both formats via `remotion/src/overlays.jsx`:

- **Remove LIVE badge** from `TopBar`
- **Remove time** from `TopBar` — show date only (e.g. `JUN 4, 2026`)
- The website (`MapHero.jsx`, `BroadcastPanel.jsx`) has no LIVE badge — this is a clean removal from the Remotion overlays only

## Per-Format Differences

| Element | 16:9 | 9:16 |
|---|---|---|
| `SubtitleBar` font size | 40px | 60px |
| `QuoteCallout` position | `left: 5%` (existing) | `left: 50%; transform: translateX(-50%)` |
| `MapAttribution` position | `bottom: 8` (existing) | `bottom: 100` (clears chyron height) |
| Layout structure | flex column (map + ticker/chyron panel) | full-bleed AbsoluteFill |

## File Changes

### `remotion/src/Root.jsx`
Add a second `Composition`:

```jsx
<Composition
  id="Broadcast916"
  component={Broadcast}
  calculateMetadata={calculateMetadata}
  defaultProps={{ edition: null, fps: 30, aspect: '9:16', port: 3002 }}
  width={1080}
  height={1920}
  fps={30}
  durationInFrames={1}
/>
```

### `remotion/src/overlays.jsx`

**TopBar**: Remove LIVE badge `<div>`. Remove `timeStr` from the rendered output — keep `dateStr`. The `formatBroadcastTime` helper can stay; only the JSX changes.

**SubtitleBar**: Add `aspect` prop (default `'16:9'`). Set `fontSize: aspect === '9:16' ? 60 : 40`.

**QuoteCallout**: Add `aspect` prop (default `'16:9'`). When `aspect === '9:16'` use `left: '50%', transform: 'translateX(-50%)'` instead of `left: '5%'`.

**MapAttribution**: Add `aspect` prop (default `'16:9'`). When `aspect === '9:16'` use `bottom: 100` instead of `bottom: 8`.

### `remotion/src/Broadcast.jsx`

Pass `aspect` to the four overlay components above.

When `aspect === '9:16'`, switch the outer structure from the flex-column layout to a full-bleed layout:

```jsx
// 9:16: map fills frame, all overlays float
<AbsoluteFill style={{ background: '#000' }}>
  <div style={{ position: 'absolute', inset: 0 }}>
    <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
  </div>
  <TopBar ... />
  <MapAttribution aspect={aspect} />
  <RemotionFilmGrain opacity={0.055} />
  <SubtitleBar ... aspect={aspect} />
  {/* overlay sequences (DataCallout, QuoteCallout) */}
  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
    <Ticker ... />
    <Chyron ... />
  </div>
  <FadeOverlay ... />
  {/* audio sequences */}
</AbsoluteFill>
```

The 16:9 branch is the existing JSX, unchanged.

### `scripts/produce-clip.js`

After Stage 3 (16:9 render), if `platforms` includes `tiktok`:

1. Run a second Remotion render targeting composition `Broadcast916` with props `{ edition, aspect: '9:16', port: renderPort }` — output to `out/raw/{edition}-9x16.mp4`.
2. Split the finalize-clip call: if any non-tiktok platforms remain (e.g. `youtube`, `square`), run finalize-clip for those using the 16:9 raw. Then run finalize-clip again for `--platforms=tiktok --video=out/raw/{edition}-9x16.mp4`.

If `platforms` does not include `tiktok`, Stage 3 and 4 are unchanged (single render, single finalize call).

If `platforms` is `tiktok` only, skip the 16:9 render (Stage 3) and finalize-clip call for other platforms entirely.

### `scripts/finalize-clip.js`

Remove the `videoFilter` from the `tiktok` platform definition — it is no longer needed since the source is already 1080×1920:

```js
tiktok: {
  lufs:      -16,
  videoFilter: null,   // native 9:16 render — no crop
  thumbTime:  PRE_ROLL_S + 5,
},
```

The `--video` flag already exists for overriding the input path, so no other changes are needed in this script.

## Out of Scope

- `build-shotlist.js`: the `--aspect` flag is currently stored as metadata only and does not affect shot generation. No change needed — both renders use the same shotlist.
- `BroadcastPanel.jsx`, `BroadcastStage.jsx`, `MapHero.jsx`: website components, not touched.
- `SubtitleBar` word-window width: no change — `maxWidth: '80%'` works for both aspects (80% of 1080 = 864px).
- `DataCallout`: already centered (`left: 50%`) — works for both aspects unchanged.
- `Chyron` headline truncation: `maxLen: 72` chars. At 1080px width this may occasionally wrap to two lines, which is acceptable.
