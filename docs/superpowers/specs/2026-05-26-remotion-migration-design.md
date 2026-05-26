# Remotion Migration Design

**Date:** 2026-05-26  
**Status:** Approved  
**Scope:** Replace the Playwright/CDP headless recording pipeline with Remotion for frame-accurate, deterministic video output.

---

## Background

The existing recording pipeline (`record-clip.js`) uses Playwright with Chrome's `Page.startScreencast` CDP API to capture JPEG frames and pipe them to ffmpeg. This approach has a fundamental limitation: Chrome only delivers frames when the compositor renders new content. Mapbox pauses its render loop when the camera is static (after a fly animation), causing multi-second freezes in the output video.

Remotion solves this by owning the rendering clock. It advances time frame-by-frame deterministically, calling the React component once per frame. The map is told exactly which camera position to render via `map.jumpTo()` rather than a time-based `flyTo()`. The result is a smooth, frame-accurate video regardless of Mapbox's internal render loop behavior.

---

## Goals

- Produce smooth 30fps video with no freezes or choppy segments.
- Preserve all visual elements: Mapbox globe, chyron, ticker, scanlines, FilmGrain.
- Preserve per-shot TTS narration with frame-accurate audio alignment.
- Keep `build-shotlist.js` unchanged. `synthesize-narration.js` loses only the ffmpeg timed-mix step (the per-shot WAV synthesis is unchanged).
- Retire `record-clip.js` and `BroadcastStage.jsx` (website embeds YouTube/TikTok).

---

## Architecture

### File layout

```
meridian-public/
  remotion/
    src/
      Root.tsx            — registers the Broadcast composition with Remotion
      Broadcast.tsx       — main composition: map + overlays + per-shot audio
      camera.ts           — interpolateCamera() pure function (cubic-in-out easing)
      overlays.tsx        — Chyron, Ticker, FilmGrain (ported from BroadcastStage)
    remotion.config.ts    — Remotion bundler config (Vite-compatible)
  scripts/
    build-shotlist.js     (unchanged)
    synthesize-narration.js  (unchanged — still produces per-shot WAVs)
    produce-clip.js       (updated — calls `npx remotion render` in Stage 2)
    finalize-clip.js      (updated — single muxed MP4 input, no separate audio)
    record-clip.js        (deleted)
  src/
    components/
      BroadcastStage.jsx  (deleted — website embeds YouTube/TikTok)
  package.json            (add @remotion/core, @remotion/cli, @remotion/bundler)
```

### Pipeline stages

```
1. build-shotlist.js
   reads reports/<edition>.json
   → out/shotlists/<edition>.json

2. synthesize-narration.js
   reads shotlist, calls ElevenLabs/OpenAI per shot
   → out/audio/<edition>/shot-0.wav … shot-N.wav
   (full.wav timed-mix step is no longer needed and is removed)

3. npx remotion render Broadcast
   reads shotlist + per-shot WAVs
   renders frame-by-frame (map.jumpTo per frame, <Audio> per shot)
   → out/raw/<edition>.mp4  (H.264 video + AAC audio, muxed)

4. finalize-clip.js
   reads out/raw/<edition>.mp4 (single muxed input)
   loudnorm two-pass on [0:a] stream
   per-platform crop + re-encode
   → out/final/<edition>-youtube.mp4
   → out/final/<edition>-tiktok.mp4
   → out/final/<edition>-{platform}-thumb.png
```

---

## Remotion Composition

### Root.tsx

Registers one composition named `Broadcast`. Props are passed via `--props` at render time:

```ts
interface BroadcastProps {
  edition: string;       // e.g. "2026-05-26-evening"
  aspect?: '16:9' | '9:16';  // default "16:9"
  fps?: number;          // default 30
}
```

`durationInFrames` is computed by loading the shotlist JSON inside `Root.tsx` (or passed as a prop after `produce-clip.js` reads the shotlist duration):

```
durationInFrames = Math.ceil((PRE_ROLL_S + shotlist.duration + POST_ROLL_S) * fps)
```

`PRE_ROLL_S = 1`, `POST_ROLL_S = 1` — must match the values in `synthesize-narration.js` and the former `BroadcastStage.jsx`.

### Broadcast.tsx

Structure:

```tsx
export function Broadcast({ edition, aspect = '16:9', fps = 30 }: BroadcastProps) {
  const frame = useCurrentFrame();
  const { fps: configFps } = useVideoConfig();
  const t = frame / configFps;  // current time in seconds

  const shotlist = /* loaded once via staticFile() or passed as prop */;
  const cam = interpolateCamera(shotlist.shots, t);

  // Drive the map camera for this frame
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.jumpTo({
        center: [cam.lng, cam.lat],
        zoom:   cam.zoom,
        pitch:  cam.pitch,
        bearing: cam.bearing,
      });
    }
  }, [frame]);

  return (
    <AbsoluteFill>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      <Overlays shots={shotlist.shots} t={t} preRollS={PRE_ROLL_S} />
      {shotlist.shots.map((shot, i) => (
        <Audio
          key={i}
          src={staticFile(`out/audio/${edition}/shot-${i}.wav`)}
          startFrom={Math.round((PRE_ROLL_S + shot.t) * configFps)}
        />
      ))}
    </AbsoluteFill>
  );
}
```

The `useMeridianMap` hook is used with `broadcast: true` to initialize the Mapbox map (same as before). Ambient rotation is disabled for rendering (rotation is not part of the shot script and would produce inconsistent frames).

### camera.ts — interpolateCamera()

Pure function; no side effects.

```ts
interface CameraState {
  lng: number; lat: number;
  zoom: number; pitch: number; bearing: number;
}

// Duration of the animated transition between shots (in seconds).
const FLY_DURATION_S = 2;

// Cubic-in-out easing.
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerpCamera(a: CameraState, b: CameraState, p: number): CameraState {
  const e = easeInOut(p);
  return {
    lng:     a.lng     + (b.lng     - a.lng)     * e,
    lat:     a.lat     + (b.lat     - a.lat)     * e,
    zoom:    a.zoom    + (b.zoom    - a.zoom)    * e,
    pitch:   a.pitch   + (b.pitch   - a.pitch)   * e,
    bearing: a.bearing + (b.bearing - a.bearing) * e,
  };
}

export function interpolateCamera(shots: Shot[], t: number): CameraState {
  // Before pre-roll or first shot: hold first shot's camera.
  if (t <= shots[0].t + PRE_ROLL_S) return shotCamera(shots[0]);

  for (let i = shots.length - 1; i >= 0; i--) {
    const shotT = shots[i].t + PRE_ROLL_S;
    if (t >= shotT) {
      const next = shots[i + 1];
      if (!next) return shotCamera(shots[i]);  // last shot: hold
      const progress = Math.min(1, (t - shotT) / FLY_DURATION_S);
      return lerpCamera(shotCamera(shots[i]), shotCamera(next), progress);
    }
  }
  return shotCamera(shots[0]);
}

function shotCamera(shot: Shot): CameraState {
  return {
    lng:     shot.camera.lng,
    lat:     shot.camera.lat,
    zoom:    shot.camera.zoom,
    pitch:   shot.camera.pitch,
    bearing: shot.camera.bearing,
  };
}
```

### overlays.tsx

Ports the visual overlays from `BroadcastStage.jsx`, replacing `setTimeout`-based scheduling with frame-based logic:

- **Chyron**: visible when `t >= PRE_ROLL_S + shot.t && t < PRE_ROLL_S + shot.t + shot.hold`. Fades in over 0.3s, fades out over 0.3s using `interpolate()` from `@remotion/core`.
- **Ticker**: CSS marquee animation — unchanged from BroadcastStage (pure CSS, not time-dependent).
- **FilmGrain**: `<FilmGrain />` canvas component — unchanged. Remotion renders each frame fresh so the grain updates naturally.
- **Scanlines**: static CSS overlay — unchanged.
- **PRE_ROLL black fade**: `opacity: interpolate(frame, [0, fps * PRE_ROLL_S], [1, 0])`.
- **POST_ROLL black fade**: `opacity: interpolate(frame, [durationInFrames - fps * POST_ROLL_S, durationInFrames], [0, 1])`.

---

## Script Changes

### produce-clip.js — Stage 2

Replace `record-clip.js` invocation with:

```js
banner('2 / 4', `remotion render  edition=${edition}`);

const ownedServer = await ensureServer();  // Remotion's bundler needs the dev server for static assets
try {
  run('record', 'npx', [
    'remotion', 'render', 'Broadcast',
    `--props=${JSON.stringify({ edition, aspect })}`,
    '--output', rawPath,
    '--concurrency', '1',  // Mapbox GL does not parallelize safely
    '--log', 'verbose',
  ]);
} finally {
  if (ownedServer) stopServer();
}
```

The `recordTimeoutMs` variable and `--timeout` arg are removed — Remotion handles its own timeout.

### finalize-clip.js — audio input removed

`audioIn` and the `--audio` CLI arg are removed. The loudnorm analysis and encode commands change from two inputs (`-i videoIn -i audioIn`) to one (`-i videoIn`), with audio filter referencing `[0:a]` instead of `[1:a]`:

```js
// Before:
// ffmpeg -i videoIn -i audioIn -filter_complex "[1:a]loudnorm..." ...

// After:
// ffmpeg -i videoIn -filter_complex "[0:a]loudnorm..." ...
```

`buildAudioFilter` and `analyzeLoudness` are updated to remove bed-music mixing references to the narration input index (was `[1:a]`, becomes `[0:a]`). Bed-music support is preserved — it shifts from input index 2 to index 1.

### synthesize-narration.js — timed-mix step removed

The ffmpeg `amix` step that produced `full.wav` is removed. The script stops after writing `shot-N.wav` files. `full.wav` is no longer produced or needed.

---

## Remotion Configuration

`remotion.config.ts`:

```ts
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(1);
Config.setChromiumOpenGlRenderer('angle');  // best Mapbox GL compatibility in headless
```

Mapbox GL requires WebGL. Remotion uses Puppeteer/Chrome under the hood; `--enable-gpu` flags and SwiftShader are configured via `Config.setChromiumOpenGlRenderer`.

---

## Dependencies

Add to `package.json`:

```json
"@remotion/cli": "^4.x",
"@remotion/core": "^4.x",
"@remotion/bundler": "^4.x"
```

Remotion requires React 18+. The project is on React 19 — compatible.

---

## What Gets Deleted

| File | Reason |
|---|---|
| `scripts/record-clip.js` | Replaced by `npx remotion render` |
| `src/components/BroadcastStage.jsx` | Website embeds YouTube/TikTok; no browser-side player needed |
| `src/components/FilmGrain.jsx` | Moved into `remotion/src/overlays.tsx` (or kept and imported from there) |

`BroadcastStage.jsx` references in `App.jsx` (the `?mode=broadcast` route) are removed.

---

## Testing Plan

1. Run `build-shotlist.js` for a known edition — verify shotlist JSON.
2. Run `synthesize-narration.js --dry-run` — verify per-shot silence WAVs (no `full.wav`).
3. Run `npx remotion studio` — verify the composition renders in the browser with correct camera motion and overlays.
4. Run `npx remotion render Broadcast` for one edition — verify output MP4 has correct duration, smooth camera, audio aligned to shots.
5. Run `finalize-clip.js` on the Remotion output — verify per-platform MP4s and thumbnails.
6. Run full `produce-clip.js` end-to-end for one edition.
