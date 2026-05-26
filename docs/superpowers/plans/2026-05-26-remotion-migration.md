# Remotion Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Playwright/CDP headless recording pipeline with a Remotion composition that renders the Mapbox broadcast frame-by-frame, producing smooth 30fps video with frame-accurate audio.

**Architecture:** A `remotion/` folder contains the composition (`Broadcast.jsx`), a pure camera interpolation function (`camera.js`), overlay components (`overlays.jsx`), and a slimmed map hook (`useRemotionMap.js`). `produce-clip.js` calls `npx remotion render` instead of `record-clip.js`; `finalize-clip.js` receives a single muxed MP4. `synthesize-narration.js` drops its ffmpeg timed-mix step; `record-clip.js` and `BroadcastStage.jsx` are deleted.

**Tech Stack:** Remotion 4.x (`@remotion/core`, `@remotion/cli`), Mapbox GL 3.x (existing kernel), Vitest (camera unit tests), Express dev server (`:3002`) serves shotlist + audio as static files.

---

## File Map

| Action | Path |
|---|---|
| Create | `remotion/src/Root.jsx` |
| Create | `remotion/src/Broadcast.jsx` |
| Create | `remotion/src/camera.js` |
| Create | `remotion/src/overlays.jsx` |
| Create | `remotion/src/useRemotionMap.js` |
| Create | `remotion/src/broadcast.css` |
| Create | `remotion/src/__tests__/camera.test.js` |
| Create | `remotion.config.js` |
| Modify | `scripts/synthesize-narration.js` |
| Modify | `scripts/finalize-clip.js` |
| Modify | `scripts/produce-clip.js` |
| Modify | `src/App.jsx` |
| Modify | `package.json` |
| Delete | `scripts/record-clip.js` |
| Delete | `src/components/BroadcastStage.jsx` |
| Delete | `src/components/FilmGrain.jsx` |

---

## Task 1: Install Remotion and scaffold the folder

**Files:**
- Modify: `package.json`
- Create: `remotion.config.js`
- Create: `remotion/src/Root.jsx` (placeholder)

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev @remotion/core @remotion/cli vitest
```

Expected output: packages added, no peer-dep errors. Remotion 4.x requires React 18+; this project is on React 19 which is compatible.

- [ ] **Step 2: Add vitest and remotion scripts to package.json**

Open `package.json`. In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"remotion:studio": "npx remotion studio",
"remotion:render": "npx remotion render"
```

- [ ] **Step 3: Create remotion.config.js**

```js
// remotion.config.js
import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./remotion/src/Root.jsx');
Config.setPublicDir('./public');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(1);
```

`setPublicDir('./public')` makes Mapbox styles and fonts accessible at `/meridian-dark.style.json` etc. (matching how the kernel loads them). Audio is served separately from Express on `:3002`.

- [ ] **Step 4: Create remotion/src/Root.jsx with a placeholder composition**

```jsx
// remotion/src/Root.jsx
import { Composition } from '@remotion/core';
import { AbsoluteFill } from '@remotion/core';

function Placeholder() {
  return <AbsoluteFill style={{ background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>Remotion scaffold</AbsoluteFill>;
}

export const RemotionRoot = () => (
  <Composition
    id="Broadcast"
    component={Placeholder}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={90}
    defaultProps={{}}
  />
);
```

- [ ] **Step 5: Verify Remotion Studio opens**

```bash
npm run remotion:studio
```

Expected: browser opens at `http://localhost:3000`, shows "Remotion scaffold" composition listed. No errors in terminal.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json remotion.config.js remotion/src/Root.jsx
git commit -m "feat: scaffold Remotion project with placeholder composition"
```

---

## Task 2: camera.js — interpolateCamera() with unit tests

**Files:**
- Create: `remotion/src/camera.js`
- Create: `remotion/src/__tests__/camera.test.js`

- [ ] **Step 1: Write the failing tests**

Create `remotion/src/__tests__/camera.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { interpolateCamera } from '../camera.js';

const PRE_ROLL_S = 1;

// Two shots: first at t=0, second at t=10
const shots = [
  { t: 0,  camera: { lng: 0,   lat: 0,  zoom: 5, pitch: 50, bearing: -10 }, hold: 10 },
  { t: 10, camera: { lng: 100, lat: 50, zoom: 4, pitch: 50, bearing: -10 }, hold: 10 },
];

describe('interpolateCamera', () => {
  it('holds first shot camera before pre-roll ends', () => {
    const cam = interpolateCamera(shots, 0.5, PRE_ROLL_S);
    expect(cam.lng).toBe(0);
    expect(cam.lat).toBe(0);
    expect(cam.zoom).toBe(5);
  });

  it('holds first shot camera at exactly PRE_ROLL_S', () => {
    const cam = interpolateCamera(shots, PRE_ROLL_S, PRE_ROLL_S);
    expect(cam.lng).toBe(0);
  });

  it('starts interpolating toward shot 2 after shot 1 start time', () => {
    // 0.5s into the 2s fly from shot 1 to shot 2
    const cam = interpolateCamera(shots, PRE_ROLL_S + 0.5, PRE_ROLL_S);
    expect(cam.lng).toBeGreaterThan(0);
    expect(cam.lng).toBeLessThan(100);
  });

  it('reaches shot 2 camera after FLY_DURATION_S', () => {
    // FLY_DURATION_S = 2; shot 2 starts at t=10, so at PRE_ROLL_S + 10 + 2 we should be at shot 2
    const cam = interpolateCamera(shots, PRE_ROLL_S + 10 + 2, PRE_ROLL_S);
    expect(cam.lng).toBeCloseTo(100, 1);
    expect(cam.lat).toBeCloseTo(50, 1);
  });

  it('holds last shot camera after its start time + fly duration', () => {
    const cam = interpolateCamera(shots, PRE_ROLL_S + 10 + 5, PRE_ROLL_S);
    expect(cam.lng).toBeCloseTo(100, 1);
  });

  it('easing is monotonically increasing (no overshoot)', () => {
    const values = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0].map(dt =>
      interpolateCamera(shots, PRE_ROLL_S + dt, PRE_ROLL_S).lng
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: 6 failures — `interpolateCamera is not a function`.

- [ ] **Step 3: Implement camera.js**

Create `remotion/src/camera.js`:

```js
// Pure camera interpolation — no side effects.
// Given a shotlist and the current playback time t (seconds),
// returns the Mapbox camera state { lng, lat, zoom, pitch, bearing }
// using cubic-in-out easing for the fly between shots.

const FLY_DURATION_S = 2;

function easeInOut(t) {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerpCamera(a, b, progress) {
  const e = easeInOut(Math.max(0, Math.min(1, progress)));
  return {
    lng:     a.lng     + (b.lng     - a.lng)     * e,
    lat:     a.lat     + (b.lat     - a.lat)     * e,
    zoom:    a.zoom    + (b.zoom    - a.zoom)    * e,
    pitch:   a.pitch   + (b.pitch   - a.pitch)   * e,
    bearing: a.bearing + (b.bearing - a.bearing) * e,
  };
}

function shotCamera(shot) {
  return { ...shot.camera };
}

/**
 * Returns the interpolated Mapbox camera state at time t.
 * @param {Array} shots  - shotlist.shots array
 * @param {number} t     - current time in seconds (includes pre-roll)
 * @param {number} preRollS - pre-roll duration in seconds (default 1)
 */
export function interpolateCamera(shots, t, preRollS = 1) {
  if (!shots || shots.length === 0) return { lng: 0, lat: 20, zoom: 1.5, pitch: 0, bearing: 0 };

  // Before the first shot: hold its camera.
  if (t <= shots[0].t + preRollS) return shotCamera(shots[0]);

  for (let i = shots.length - 1; i >= 0; i--) {
    const shotStart = shots[i].t + preRollS;
    if (t >= shotStart) {
      const next = shots[i + 1];
      if (!next) return shotCamera(shots[i]);  // last shot: hold
      const progress = (t - shotStart) / FLY_DURATION_S;
      return lerpCamera(shotCamera(shots[i]), shotCamera(next), progress);
    }
  }
  return shotCamera(shots[0]);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: 6 passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add remotion/src/camera.js remotion/src/__tests__/camera.test.js
git commit -m "feat: interpolateCamera() pure function with unit tests"
```

---

## Task 3: broadcast.css — dark theme variables and fonts

**Files:**
- Create: `remotion/src/broadcast.css`

The Remotion composition always renders in dark mode. This CSS file defines the dark-theme variables as constants so the composition doesn't need to import the Vite-processed `index.css`.

- [ ] **Step 1: Create remotion/src/broadcast.css**

```css
/* Google Fonts — loaded at render time by Remotion's Chrome instance */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,400&display=swap');

/* Mapbox GL base CSS */
@import 'mapbox-gl/dist/mapbox-gl.css';

/* Dark theme CSS custom properties — matches [data-theme="dark"] in src/index.css */
:root {
  --bg-primary:   #060810;
  --bg-secondary: #0a0d14;
  --bg-chyron:    #121624;

  --text-primary:   #f0ebe0;
  --text-secondary: #c8c0b0;

  --accent:      #e8c547;
  --accent-text: #0a0d14;

  --text-primary-rgb: 240, 235, 224;
  --bg-secondary-rgb: 10, 13, 20;
  --bg-chyron-rgb:    18, 22, 36;

  --hero-border:        rgba(232,197,71,0.30);
  --hero-border-active: rgba(232,197,71,0.70);
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #000; }
```

- [ ] **Step 2: Commit**

```bash
git add remotion/src/broadcast.css
git commit -m "feat: broadcast CSS — dark theme variables and font imports"
```

---

## Task 4: overlays.jsx — Chyron, Ticker, RemotionFilmGrain

**Files:**
- Create: `remotion/src/overlays.jsx`

Ports the visual overlays from `BroadcastStage.jsx`. Replaces `setTimeout`-based scheduling with `useCurrentFrame()` logic. FilmGrain uses a seeded LCG so grain is deterministic per frame (reproducible renders).

- [ ] **Step 1: Create remotion/src/overlays.jsx**

```jsx
// remotion/src/overlays.jsx
import { useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from '@remotion/core';

// ── Color constants (dark theme) ──────────────────────────────────────────────
const ACCENT         = '#e8c547';
const ACCENT_TEXT    = '#0a0d14';
const TEXT_60        = 'rgba(240,235,224,0.60)';
const TEXT_55        = 'rgba(240,235,224,0.55)';
const CHYRON_UPPER   = 'rgba(10,13,20,0.92)';
const CHYRON_LOWER   = 'rgba(18,22,36,0.96)';
const BORDER_ACTIVE  = 'rgba(232,197,71,0.70)';

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncateHeadline(headline, maxLen = 72) {
  if (!headline) return '';
  return headline.length <= maxLen ? headline : headline.slice(0, maxLen - 1) + '…';
}

// Linear congruential generator — deterministic pseudo-random from a seed.
function seededRandom(seed) {
  let s = seed | 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── RemotionFilmGrain ─────────────────────────────────────────────────────────

export function RemotionFilmGrain({ opacity = 0.055 }) {
  const frame = useCurrentFrame();
  const canvasRef = useRef(null);
  const sizedRef  = useRef(false);

  // Size the canvas once on mount (full resolution / 4 for coarse grain).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sizedRef.current) return;
    canvas.width  = Math.max(1, Math.ceil(canvas.offsetWidth  / 4));
    canvas.height = Math.max(1, Math.ceil(canvas.offsetHeight / 4));
    sizedRef.current = true;
  }, []);

  // Draw new grain on every Remotion frame — deterministic via seeded RNG.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return;
    const ctx = canvas.getContext('2d');
    const rand = seededRandom(frame * 2654435761 + 1);
    const img  = ctx.createImageData(canvas.width, canvas.height);
    const d    = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (rand() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [frame]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        opacity,
        mixBlendMode: 'overlay',
        imageRendering: 'pixelated',
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Chyron ────────────────────────────────────────────────────────────────────

// Returns the shot active at time t (seconds, already includes pre-roll offset).
function activeShotAt(shots, t, preRollS) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const start = preRollS + shots[i].t;
    const end   = start + shots[i].hold;
    if (t >= start && t < end) return shots[i];
  }
  return null;
}

export function Chyron({ shots, t, preRollS, durationInFrames }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shot = activeShotAt(shots, t, preRollS);

  if (!shot) return null;

  const shotStart = preRollS + shot.t;
  const shotEnd   = shotStart + shot.hold;

  // Fade in over 0.3s, fade out over 0.3s
  const fadeFrames = Math.round(0.3 * fps);
  const startFrame = Math.round(shotStart * fps);
  const endFrame   = Math.round(shotEnd   * fps);

  const opacity = interpolate(
    frame,
    [startFrame, startFrame + fadeFrames, endFrame - fadeFrames, endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity, zIndex: 10 }}>
      {/* Upper bar: label chip + headline */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        background: CHYRON_UPPER,
        borderTop: `2px solid ${BORDER_ACTIVE}`,
        padding: '8px 3%',
      }}>
        <div style={{
          background: ACCENT, color: ACCENT_TEXT,
          fontFamily: 'Source Serif 4, serif',
          fontWeight: 600, fontSize: 10,
          letterSpacing: 2, textTransform: 'uppercase',
          whiteSpace: 'nowrap', padding: '3px 10px',
          flexShrink: 0,
        }}>
          {shot.chyron.label}
        </div>
        <div style={{
          fontFamily: 'Playfair Display, serif',
          fontWeight: 700, fontSize: 20,
          color: 'var(--text-primary)', letterSpacing: 0.3,
        }}>
          {truncateHeadline(shot.chyron.headline)}
        </div>
      </div>
      {/* Lower bar: meta */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: CHYRON_LOWER,
        padding: '5px 3%',
      }}>
        <div style={{ color: TEXT_60, fontSize: 12, letterSpacing: 0.8 }}>
          Meridian Analysis
        </div>
        <div style={{ color: 'var(--accent)', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {shot.chyron.edition ?? ''}
        </div>
      </div>
    </div>
  );
}

// ── Ticker ────────────────────────────────────────────────────────────────────

export function Ticker({ shots }) {
  const tickerText = shots.map(s => truncateHeadline(s.chyron.headline, 80)).join('  ·  THE MERIDIAN  ·  ');
  const text = `THE MERIDIAN  ·  ${tickerText}  ·  THE MERIDIAN  ·  ${tickerText}`;

  return (
    <div style={{
      position: 'absolute', bottom: 78, left: 0, right: 0, zIndex: 10,
      background: ACCENT, padding: '5px 0', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .remotion-ticker {
          display: inline-block;
          white-space: nowrap;
          animation: ticker-scroll 120s linear infinite;
          color: ${ACCENT_TEXT};
          font-family: 'Source Serif 4', serif;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }
      `}</style>
      <div className="remotion-ticker">{text}</div>
    </div>
  );
}

// ── TopBar (wordmark + LIVE badge + clock) ────────────────────────────────────

export function TopBar({ edition, t }) {
  // Derive a broadcast time from edition string + elapsed seconds.
  const [dateStr, timeStr] = formatBroadcastTime(edition, t);
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '2% 3%', zIndex: 10,
    }}>
      <div style={{
        fontFamily: 'Playfair Display, serif', fontWeight: 900,
        color: 'var(--text-primary)', fontSize: 26,
        letterSpacing: 3, textTransform: 'uppercase',
      }}>
        The Meridian
      </div>
      <div style={{
        background: '#c0392b', color: '#fff',
        fontFamily: 'Source Serif 4, serif',
        fontWeight: 600, fontSize: 11,
        letterSpacing: 2, textTransform: 'uppercase',
        padding: '3px 10px',
      }}>
        Live
      </div>
      <div style={{ color: TEXT_55, fontSize: 11, letterSpacing: 1, fontFamily: 'Source Serif 4, serif' }}>
        {dateStr}  ·  {timeStr} ET
      </div>
    </div>
  );
}

function formatBroadcastTime(edition, t) {
  // edition format: "YYYY-MM-DD-{morning|evening}"
  const parts = (edition ?? '').split('-');
  const datepart = parts.slice(0, 3).join('-');
  const slot = parts[3] ?? 'evening';
  const baseHour = slot === 'morning' ? 7 : 17;
  const d = new Date(`${datepart}T${String(baseHour).padStart(2, '0')}:00:00`);
  d.setSeconds(d.getSeconds() + Math.floor(t));
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return [dateStr, timeStr];
}

// ── Attribution ───────────────────────────────────────────────────────────────

export function MapAttribution() {
  return (
    <div style={{
      position: 'absolute', bottom: 168, left: 10, zIndex: 10,
      color: 'rgba(240,235,224,0.30)', fontSize: 8,
      letterSpacing: 0.4, pointerEvents: 'none',
      fontFamily: 'Source Serif 4, serif',
    }}>
      © Mapbox · © OpenStreetMap
    </div>
  );
}

// ── FadeOverlay (pre-roll / post-roll black) ──────────────────────────────────

export function FadeOverlay({ durationInFrames, preRollS, postRollS }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const preFrames  = Math.round(preRollS  * fps);
  const postStart  = durationInFrames - Math.round(postRollS * fps);

  const opacity = interpolate(
    frame,
    [0, preFrames, postStart, durationInFrames],
    [1,          0,         0,               1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: '#000', opacity, pointerEvents: 'none',
    }} />
  );
}
```

- [ ] **Step 2: Verify no import errors**

Open `npm run remotion:studio`. The placeholder composition should still work (overlays aren't wired yet). No console errors from import resolution.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/overlays.jsx
git commit -m "feat: broadcast overlay components (Chyron, Ticker, FilmGrain, TopBar)"
```

---

## Task 5: useRemotionMap.js — slimmed map hook

**Files:**
- Create: `remotion/src/useRemotionMap.js`

This is a stripped-down version of `useMeridianMap` for headless rendering. No ambient rotation, no interaction listeners, no ResizeObserver, no theme switching. Uses `delayRender`/`continueRender` to tell Remotion when the map is ready and when each frame is rendered.

- [ ] **Step 1: Create remotion/src/useRemotionMap.js**

```js
// remotion/src/useRemotionMap.js
import { useEffect, useRef, useState } from 'react';
import { delayRender, continueRender } from '@remotion/core';
import { createMap } from '../../src/map/kernel.js';

/**
 * Initialised Mapbox map for headless Remotion rendering.
 * Returns { mapContainer, mapRef, mapReady }.
 *
 * On mount: creates the map and calls continueRender once it loads.
 * Callers drive the camera via mapRef.current.jumpTo() each frame,
 * wrapped in a delayRender/continueRender pair around map.once('idle').
 */
export function useRemotionMap() {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Pause Remotion rendering until the map loads.
    const initHandle = delayRender('map init');
    let cancelled = false;

    createMap(mapContainer.current, { isDark: true, broadcast: true }).then(({ map }) => {
      if (cancelled) { map.remove(); return; }
      mapRef.current = map;
      setMapReady(true);
      continueRender(initHandle);
    }).catch(err => {
      console.error('[useRemotionMap] Mapbox failed to load:', err);
      continueRender(initHandle);  // unblock even on error
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return { mapContainer, mapRef, mapReady };
}
```

- [ ] **Step 2: Commit**

```bash
git add remotion/src/useRemotionMap.js
git commit -m "feat: useRemotionMap — slimmed Mapbox hook for headless rendering"
```

---

## Task 6: Broadcast.jsx + Root.jsx with calculateMetadata

**Files:**
- Create: `remotion/src/Broadcast.jsx`
- Modify: `remotion/src/Root.jsx`

This is the main composition. `calculateMetadata` fetches the shotlist via the Express dev server (works in both browser and Node.js contexts) to compute `durationInFrames`. The component drives the map camera via `interpolateCamera` + `map.jumpTo()` on each frame, using `delayRender`/`continueRender` to wait for Mapbox to finish rendering.

- [ ] **Step 1: Create remotion/src/Broadcast.jsx**

```jsx
// remotion/src/Broadcast.jsx
import './broadcast.css';
import { useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Audio, delayRender, continueRender, staticFile } from '@remotion/core';
import { useRemotionMap } from './useRemotionMap.js';
import { interpolateCamera } from './camera.js';
import { RemotionFilmGrain, Chyron, Ticker, TopBar, MapAttribution, FadeOverlay } from './overlays.jsx';

const PRE_ROLL_S  = 1;
const POST_ROLL_S = 1;

export async function calculateMetadata({ props }) {
  const { edition, fps = 30, port = 3002 } = props;
  const res = await fetch(`http://localhost:${port}/out/shotlists/${edition}.json`);
  if (!res.ok) throw new Error(`Shotlist fetch failed: ${res.status} for edition "${edition}"`);
  const shotlist = await res.json();
  const durationInFrames = Math.ceil((PRE_ROLL_S + shotlist.duration + POST_ROLL_S) * fps);
  return {
    durationInFrames,
    fps,
    props: { ...props, shotlist },
  };
}

export function Broadcast({ edition, aspect = '16:9', port = 3002, shotlist, fps: propFps = 30 }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const { mapContainer, mapRef, mapReady } = useRemotionMap();

  // Per-frame camera update: jumpTo computed position, delay Remotion
  // until Mapbox reports idle (all tiles rendered for this position).
  const frameHandleRef = useRef(null);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !shotlist) return;

    const handle = delayRender(`cam-frame-${frame}`);
    frameHandleRef.current = handle;

    const cam = interpolateCamera(shotlist.shots, t, PRE_ROLL_S);
    mapRef.current.jumpTo({
      center:  [cam.lng, cam.lat],
      zoom:     cam.zoom,
      pitch:    cam.pitch,
      bearing:  cam.bearing,
    });

    const onIdle = () => continueRender(handle);
    mapRef.current.once('idle', onIdle);

    return () => {
      mapRef.current?.off('idle', onIdle);
    };
  }, [frame, mapReady]);

  if (!shotlist) return <AbsoluteFill style={{ background: '#000' }} />;

  const [vw, vh] = aspect === '9:16' ? [1080, 1920] : [1920, 1080];

  // Calculate the ticker height + chyron height so the map fills the rest.
  // Ticker: ~28px, chyron upper: ~38px, chyron lower: ~28px → total ~94px.
  // These are approximate; the actual heights are set by the flex layout.
  const overlayHeight = 166;
  const mapHeight = `calc(100% - ${overlayHeight}px)`;

  return (
    <AbsoluteFill style={{ background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* Map area */}
      <div style={{ position: 'relative', width: '100%', height: mapHeight, overflow: 'hidden' }}>
        <div
          ref={mapContainer}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <TopBar edition={edition} t={t} />
        <MapAttribution />
        <RemotionFilmGrain opacity={0.055} />
      </div>

      {/* Ticker + chyron below map */}
      <div style={{ flexShrink: 0 }}>
        <Ticker shots={shotlist.shots} />
        <Chyron
          shots={shotlist.shots}
          t={t}
          preRollS={PRE_ROLL_S}
          durationInFrames={durationInFrames}
        />
      </div>

      {/* Pre-roll / post-roll black fade — sits on top of everything */}
      <FadeOverlay
        durationInFrames={durationInFrames}
        preRollS={PRE_ROLL_S}
        postRollS={POST_ROLL_S}
      />

      {/* Per-shot narration audio */}
      {shotlist.shots.map((shot, i) => (
        <Audio
          key={i}
          src={`http://localhost:${port}/out/audio/${edition}/shot-${i}.wav`}
          startFrom={Math.round((PRE_ROLL_S + shot.t) * fps)}
        />
      ))}

    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Update remotion/src/Root.jsx to use real composition**

Replace the placeholder `Root.jsx` with:

```jsx
// remotion/src/Root.jsx
import { Composition } from '@remotion/core';
import { Broadcast, calculateMetadata } from './Broadcast.jsx';

export const RemotionRoot = () => (
  <Composition
    id="Broadcast"
    component={Broadcast}
    calculateMetadata={calculateMetadata}
    defaultProps={{ edition: '', fps: 30, aspect: '16:9', port: 3002 }}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={1}
  />
);
```

- [ ] **Step 3: Commit**

```bash
git add remotion/src/Broadcast.jsx remotion/src/Root.jsx
git commit -m "feat: Broadcast composition and calculateMetadata"
```

---

## Task 7: Verify in Remotion Studio

- [ ] **Step 1: Ensure the Express server is running on :3002**

In one terminal:
```bash
npm run dev:server
```

Expected: `Express server running on http://localhost:3002`

- [ ] **Step 2: Open Remotion Studio with a real edition**

```bash
npx remotion studio --props='{"edition":"2026-05-25-evening","port":3002}'
```

Expected: browser opens at `http://localhost:3000`, the `Broadcast` composition is listed, duration computed from shotlist.

- [ ] **Step 3: Scrub through the composition**

In Studio, drag the playhead slowly from frame 0 to the end. Verify:
- Frame 0: black screen (pre-roll)
- Frame 30 (t=1s): map visible, first shot chyron appears
- Between shots: camera interpolates smoothly (no freeze)
- Final frames: fade to black (post-roll)
- Audio: scrub to mid-video — narration waveform visible in Studio

If the map is black or missing: check the browser console for Mapbox errors (likely a style URL or token issue).

- [ ] **Step 4: Commit any fixes discovered during verification**

If no fixes needed: no commit required here. If bugs found, fix and commit before proceeding.

---

## Task 8: synthesize-narration.js — remove timed-mix step

**Files:**
- Modify: `scripts/synthesize-narration.js`

Remove the ffmpeg `amix` step that produces `full.wav`. The script stops after writing per-shot WAV files — those are now consumed directly by the Remotion `<Audio>` components.

- [ ] **Step 1: Remove the timed-mix block from synthesize-narration.js**

In `scripts/synthesize-narration.js`, delete everything from line 189 to the end of the file (the `// ── Timed mix → full.wav` section):

```
// DELETE from here to end of file:
// ── Timed mix → full.wav ──────────────────────────────────────────────────────
// Each shot's audio is delayed to PRE_ROLL_MS + shot.t * 1000 so it aligns
// with the video frame where that shot's camera move begins.
...
console.log(`\nSaved: ${fullWavPath}`);
console.log(`Total shots: ${n}  |  Video duration: ...`);
```

Replace with:

```js
console.log(`\nSaved ${wavPaths.length} per-shot WAVs to ${outDir}`);
console.log(`Total shots: ${shotlist.shots.length}  |  Clip duration: ${shotlist.duration}s`);
```

- [ ] **Step 2: Test the change**

```bash
node scripts/synthesize-narration.js --edition=2026-05-25-evening --dry-run
```

Expected:
- Per-shot WAV files written: `out/audio/2026-05-25-evening/shot-0.wav` etc.
- No `full.wav` produced
- No ffmpeg amix errors
- Final line: `Saved N per-shot WAVs to out/audio/2026-05-25-evening`

- [ ] **Step 3: Commit**

```bash
git add scripts/synthesize-narration.js
git commit -m "refactor: synthesize-narration drops timed-mix step (Remotion handles audio)"
```

---

## Task 9: finalize-clip.js — remove separate audio input

**Files:**
- Modify: `scripts/finalize-clip.js`

Remotion outputs a muxed MP4 (video + audio together). `finalize-clip.js` no longer takes a separate `audioIn`. The loudnorm analysis and encode reference `[0:a]` (the audio stream of the single video input) instead of `[1:a]`.

- [ ] **Step 1: Remove audioIn and --audio CLI arg**

In `scripts/finalize-clip.js`:

1. Delete the `audioIn` variable (line 70):
   ```js
   // DELETE this line:
   const audioIn = args['audio'] ?? join(ROOT, 'out', 'audio', edition, 'full.wav');
   ```

2. Delete the Audio pre-flight check (lines 76-79 in the for loop over `[['Video', videoIn], ['Audio', audioIn]]`). Replace with:
   ```js
   if (!existsSync(videoIn)) {
     console.error(`Video not found: ${videoIn}`);
     process.exit(1);
   }
   ```

3. Update the summary log at line 214 to remove the `Audio:` line:
   ```js
   console.log(`Edition:   ${edition}`);
   console.log(`Video:     ${videoIn}`);
   console.log(`Bed:       ${bedMusic ?? '(none)'}`);
   console.log(`Platforms: ${platforms.join(', ')}`);
   ```

- [ ] **Step 2: Update analyzeLoudness() — remove separate audioIn input**

In the `analyzeLoudness` function, change:

```js
// BEFORE:
const analysisInputs = bedMusic ? ['-i', audioIn, '-i', bedMusic] : ['-i', audioIn];
```

to:

```js
// AFTER (audioIn removed — read from video's audio stream):
const analysisInputs = bedMusic ? ['-i', videoIn, '-i', bedMusic] : ['-i', videoIn];
```

Also update the `analyseFilter` to reference `[0:a]` instead of `[0:a]` (it already uses `[0:a]` — but the bed music mixing filter references `[1:a]` for the bed, which shifts from index 2→1 now that audioIn is gone):

```js
// BEFORE:
const analyseFilter = bedMusic
  ? `[0:a]aformat=sample_fmts=fltp[n];[1:a]volume=0.12,...`  // bed was at index 2 as [1:a]
  : `[0:a]loudnorm=I=${lufs}:TP=-1:LRA=11:print_format=json[out]`;

// AFTER (no change needed for no-bed case; bed shifts from index 2→1):
const analyseFilter = bedMusic
  ? `[0:a]aformat=sample_fmts=fltp[n];[1:a]volume=0.12,aformat=sample_fmts=fltp[b];` +
    `[n][b]amix=inputs=2:duration=longest:normalize=0[mix];` +
    `[mix]loudnorm=I=${lufs}:TP=-1:LRA=11:print_format=json[out]`
  : `[0:a]loudnorm=I=${lufs}:TP=-1:LRA=11:print_format=json[out]`;
```

- [ ] **Step 3: Update buildAudioFilter() — input indices shift**

In `buildAudioFilter`, the audio is now at `[0:a]` (no separate audio input). With no bed music, the filter changes from `[1:a]loudnorm...` to `[0:a]loudnorm...`. With bed music, bed shifts from input index 2→1:

```js
function buildAudioFilter(lufs, measuredStats) {
  const isSilent = !isFinite(parseFloat(measuredStats.input_i));
  const loudnormLinear = isSilent
    ? `loudnorm=I=${lufs}:TP=-1:LRA=11`
    : `loudnorm=I=${lufs}:TP=-1:LRA=11:linear=true` +
      `:measured_I=${measuredStats.input_i}` +
      `:measured_LRA=${measuredStats.input_lra}` +
      `:measured_TP=${measuredStats.input_tp}` +
      `:measured_thresh=${measuredStats.input_thresh}` +
      `:offset=${measuredStats.target_offset}`;

  if (!bedMusic) {
    return {
      extraInputs: [],
      audioFilter: `[0:a]${loudnormLinear}[aout]`,  // was [1:a]
      audioMap:    '[aout]',
    };
  }

  // bed music is now input index 1 (was 2; audioIn was 1, now removed)
  return {
    extraInputs: ['-i', bedMusic],
    audioFilter:
      `[0:a]aformat=sample_fmts=fltp[narr];` +
      `[1:a]volume=0.12,aformat=sample_fmts=fltp[bed];` +
      `[narr][bed]amix=inputs=2:duration=longest:normalize=0[mix];` +
      `[mix]${loudnormLinear}[aout]`,
    audioMap: '[aout]',
  };
}
```

- [ ] **Step 4: Update encode() — remove -i audioIn from ffmpeg command**

In the `encode` function, the ffmpeg encode command currently passes `-i videoIn -i audioIn`. Remove `'-i', audioIn`:

```js
execFileSync('ffmpeg', [
  '-y',
  '-i', videoIn,       // only one video input now (contains both video + audio)
  ...extraInputs,      // optional bed music (now at index 1 if present)
  '-filter_complex', filterComplex,
  '-map', '[vout]',
  '-map', audioMap,
  '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart',
  outMp4,
], { stdio: 'inherit' });
```

- [ ] **Step 5: Verify finalize-clip.js runs against a Remotion-produced MP4**

Use the Remotion Studio or a test render to produce `out/raw/2026-05-25-evening.mp4` first, then:

```bash
node scripts/finalize-clip.js --edition=2026-05-25-evening --platforms=youtube
```

Expected: `out/final/2026-05-25-evening-youtube.mp4` produced, loudnorm applied, thumbnail extracted. No "Audio not found" error.

- [ ] **Step 6: Commit**

```bash
git add scripts/finalize-clip.js
git commit -m "refactor: finalize-clip takes single muxed MP4 (Remotion output, no separate audio)"
```

---

## Task 10: produce-clip.js — Stage 2 = remotion render

**Files:**
- Modify: `scripts/produce-clip.js`

Replace the Stage 2 `record-clip` invocation with `npx remotion render`. The Express server is still started/stopped in this stage so Remotion's `calculateMetadata` and audio fetches can reach `:3002`.

- [ ] **Step 1: Remove recordTimeoutMs and add remotion render to produce-clip.js**

In `produce-clip.js`, find the Stage 2 block (around line 163). Replace it entirely:

```js
// ── Stage 2: remotion render ──────────────────────────────────────────────────

banner('2 / 4', `remotion render  edition=${edition}  port=${port}`);

const ownedServer = await ensureServer();

try {
  run('record', 'node', [
    '--experimental-vm-modules',
    join(ROOT, 'node_modules', '.bin', 'remotion'),
    'render',
    'Broadcast',
    `--props=${JSON.stringify({ edition, aspect, port: Number(port) })}`,
    '--output', rawPath,
    '--concurrency', '1',
    '--log', 'verbose',
  ]);
} finally {
  if (ownedServer) stopServer();
}
```

Note: `npx remotion` vs direct node invocation — use the `.bin/remotion` path directly with `node` to avoid npx overhead and ensure the locally installed version is used.

- [ ] **Step 2: Remove recordTimeoutMs variable**

Delete these two lines that are no longer needed (they were used to pass `--timeout` to `record-clip.js`):

```js
// DELETE these lines:
const shotlistDuration = JSON.parse(readFileSync(shotlistPath, 'utf8')).duration ?? 90;
const recordTimeoutMs  = Math.ceil(shotlistDuration * 1000) + 90_000;
```

And remove `readFileSync` from the import at the top of the file since it's no longer used:

```js
// BEFORE:
import { existsSync, mkdirSync, readFileSync } from 'fs';
// AFTER:
import { existsSync, mkdirSync } from 'fs';
```

- [ ] **Step 3: Remove the audio-path scoping block**

Currently `produce-clip.js` has an `audioPath` variable set in Stage 3 and referenced in the summary. Since `finalize-clip.js` no longer takes a separate audio path, remove `audioPath` from the summary block:

```js
// BEFORE summary:
console.log(`  Audio    : ${audioPath}`);

// AFTER: remove that line entirely
```

Also remove from the Stage 3 block any code that sets `audioPath` for passing to `finalize-clip.js`. Check the `finalArgs` array — it previously had `...(audio ? [`--audio=${audioPath}`] : [])`. Remove that entry:

```js
const finalArgs = [
  join(SCRIPTS, 'finalize-clip.js'),
  `--edition=${edition}`,
  `--platforms=${platforms}`,
  ...(bed ? [`--bed=${bed}`] : []),
  // --audio arg removed: finalize-clip reads audio from the muxed MP4
];
```

- [ ] **Step 4: Verify produce-clip.js runs end-to-end**

```bash
node scripts/produce-clip.js --edition=2026-05-25-evening --platforms=youtube
```

Expected sequence:
1. `STAGE: 1 / 4  build-shotlist` — creates `out/shotlists/2026-05-25-evening.json`
2. `STAGE: 2 / 4  remotion render` — renders `out/raw/2026-05-25-evening.mp4` (slow — renders every frame)
3. `STAGE: 3 / 4  synthesize-narration` — creates per-shot WAVs
4. `STAGE: 4 / 4  finalize-clip` — creates `out/final/2026-05-25-evening-youtube.mp4`
5. Summary shows all outputs with ✓

- [ ] **Step 5: Commit**

```bash
git add scripts/produce-clip.js
git commit -m "feat: produce-clip Stage 2 uses remotion render instead of record-clip"
```

---

## Task 11: End-to-end test

- [ ] **Step 1: Run full pipeline on a real edition**

```bash
node scripts/produce-clip.js --edition=2026-05-25-evening --platforms=youtube
```

Expected duration: 3–10 minutes depending on clip length and hardware (Remotion renders frame-by-frame at ~1–5fps).

- [ ] **Step 2: Spot-check the output**

Open `out/final/2026-05-25-evening-youtube.mp4`. Verify:
- Video plays at correct real-time speed (30fps, 1-second = 1 real second of footage)
- Camera moves smoothly between shots (no freezes)
- Chyron label + headline appear and fade at correct times
- Narration audio plays at the correct shot timings
- Pre-roll fade-in and post-roll fade-to-black present
- FilmGrain visible as subtle texture overlay

- [ ] **Step 3: If video is smooth but audio is misaligned**

Check that `PRE_ROLL_S` in `Broadcast.jsx` matches the value in `synthesize-narration.js` (`PRE_ROLL_MS / 1000`). Both must be `1`.

- [ ] **Step 4: If Mapbox map is missing or black**

Check console output from `remotion render --log verbose`. Mapbox requires `MAPBOX_ACCESS_TOKEN` env var. Verify it is set in `.env` or the shell environment. The kernel loads the token from `import.meta.env.VITE_MAPBOX_TOKEN` — in Remotion's webpack context this may differ. If so, update `useRemotionMap.js` to pass the token explicitly:

```js
// In createMap call:
createMap(mapContainer.current, { isDark: true, broadcast: true, accessToken: process.env.VITE_MAPBOX_TOKEN })
```

And update `kernel.js` to accept an `accessToken` option, using it instead of `import.meta.env.VITE_MAPBOX_TOKEN` when provided.

---

## Task 12: Cleanup

**Files:**
- Delete: `scripts/record-clip.js`
- Modify: `src/App.jsx` (remove broadcast route)
- Delete: `src/components/BroadcastStage.jsx`
- Delete: `src/components/FilmGrain.jsx`

- [ ] **Step 1: Remove the broadcast route from App.jsx**

In `src/App.jsx`:

1. Delete the import:
   ```js
   // DELETE:
   import BroadcastStage from './components/BroadcastStage';
   ```

2. Delete the `isBroadcast`, `shotlistUrl`, `broadcastDate`, `broadcastEdition` useMemo (lines 15–22).

3. Delete the `useEffect` that loads the report for broadcast mode (lines 85–96 approximately — the block `if (broadcastDate && broadcastEdition)`).

4. Delete the broadcast render block (lines 153–174 approximately — the `if (isBroadcast)` early return with `<BroadcastStage ...>`).

- [ ] **Step 2: Verify the website still builds**

```bash
npm run build
```

Expected: build completes with no errors. No references to `BroadcastStage` or `FilmGrain` remain.

- [ ] **Step 3: Delete the retired files**

```bash
rm scripts/record-clip.js
rm src/components/BroadcastStage.jsx
rm src/components/FilmGrain.jsx
```

- [ ] **Step 4: Verify no dangling imports**

```bash
npm run build
```

Expected: clean build with no unresolved import errors.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A
git commit -m "cleanup: remove record-clip, BroadcastStage, FilmGrain (replaced by Remotion pipeline)"
```

---

## Self-Review Notes

**Spec coverage:**
- ✓ `interpolateCamera` pure function with cubic-in-out easing (Task 2)
- ✓ `map.jumpTo` per frame with `delayRender`/`continueRender` (Tasks 5, 6)
- ✓ Per-shot `<Audio startFrom={frame}>` (Task 6)
- ✓ `calculateMetadata` computes `durationInFrames` from shotlist (Task 6)
- ✓ Chyron, Ticker, FilmGrain, fade overlays ported (Task 4)
- ✓ `synthesize-narration.js` drops timed-mix (Task 8)
- ✓ `finalize-clip.js` single muxed input (Task 9)
- ✓ `produce-clip.js` Stage 2 = remotion render (Task 10)
- ✓ `record-clip.js` and `BroadcastStage.jsx` deleted (Task 12)
- ✓ `Config.setPublicDir('./public')` for Mapbox style/font serving (Task 1)
- ✓ Audio via Express server URL on `:3002` (Task 6)

**Known risk — Mapbox token in Remotion context:** `createMap` reads `import.meta.env.VITE_MAPBOX_TOKEN` (Vite-injected). Remotion uses webpack, which does not inject `import.meta.env.*` the same way. Task 11 Step 4 documents the fallback. Before Task 7, verify the token is accessible and add an env fallback if needed.
