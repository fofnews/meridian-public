# Native 9:16 (TikTok) Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render TikTok output as a native 1080×1920 Remotion composition instead of cropping a 16:9 master, so all overlays are fully visible at the correct proportions.

**Architecture:** A second Remotion composition `Broadcast916` (1080×1920) is added alongside the existing `Broadcast` (1920×1080). Overlay components gain an `aspect` prop that switches font sizes and positions. `produce-clip.js` conditionally runs a second render when TikTok is in the platform list and splits the `finalize-clip` call. The 16:9 YouTube path is entirely unchanged.

**Tech Stack:** React 19, Remotion 4, ffmpeg, Vitest

---

## File Map

| File | Change |
|---|---|
| `remotion/src/overlays.jsx` | Remove LIVE badge + time from `TopBar`; export 3 style helpers; `SubtitleBar`, `QuoteCallout`, `MapAttribution` accept `aspect` prop |
| `remotion/src/__tests__/overlays.test.jsx` | Tests for the 3 new style helpers |
| `remotion/src/Root.jsx` | Add `Broadcast916` composition at 1080×1920 |
| `remotion/src/Broadcast.jsx` | Full-bleed 9:16 layout branch; pass `aspect` to overlays |
| `scripts/finalize-clip.js` | Set TikTok `videoFilter: null` (no crop needed) |
| `scripts/produce-clip.js` | Conditional 9:16 render + split finalize-clip calls |

---

### Task 1: Remove LIVE badge and time from TopBar

**Files:**
- Modify: `remotion/src/overlays.jsx`

The `TopBar` component renders a LIVE badge and a date+time string. Both are removed from all video renders. No unit test needed — this is a pure JSX deletion with no logic to verify.

- [ ] **Step 1: Edit `TopBar` in `remotion/src/overlays.jsx`**

Replace the entire `TopBar` function (lines 190–220) with:

```jsx
export function TopBar({ edition, t }) {
  const [dateStr] = formatBroadcastTime(edition, t);
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
      <div style={{ color: TEXT_55, fontSize: 11, letterSpacing: 1, fontFamily: 'Source Serif 4, serif' }}>
        {dateStr}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run tests to confirm nothing broke**

```
npm test
```

Expected: all 72 tests pass.

- [ ] **Step 3: Commit**

```
git add remotion/src/overlays.jsx
git commit -m "feat: remove LIVE badge and time from video TopBar"
```

---

### Task 2: Export aspect-aware style helpers and wire into overlay components

**Files:**
- Modify: `remotion/src/overlays.jsx`
- Modify: `remotion/src/__tests__/overlays.test.jsx`

Three overlay components need to behave differently in 9:16. Extract the logic into exported pure functions so they can be unit-tested in isolation.

- [ ] **Step 1: Write failing tests**

Add to the bottom of `remotion/src/__tests__/overlays.test.jsx`:

```js
import { dataCalloutOpacity, subtitleFontSize, quoteCalloutHorizontal, mapAttributionBottom } from '../overlays.jsx';

describe('subtitleFontSize', () => {
  it('returns 40 for 16:9', () => {
    expect(subtitleFontSize('16:9')).toBe(40);
  });
  it('returns 60 for 9:16', () => {
    expect(subtitleFontSize('9:16')).toBe(60);
  });
  it('defaults to 40 for unrecognised aspect', () => {
    expect(subtitleFontSize('4:3')).toBe(40);
  });
});

describe('quoteCalloutHorizontal', () => {
  it('returns left 5% for 16:9', () => {
    expect(quoteCalloutHorizontal('16:9')).toEqual({ left: '5%' });
  });
  it('returns centered style for 9:16', () => {
    expect(quoteCalloutHorizontal('9:16')).toEqual({ left: '50%', transform: 'translateX(-50%)' });
  });
});

describe('mapAttributionBottom', () => {
  it('returns 8 for 16:9', () => {
    expect(mapAttributionBottom('16:9')).toBe(8);
  });
  it('returns 100 for 9:16', () => {
    expect(mapAttributionBottom('9:16')).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test
```

Expected: 8 new failures — `subtitleFontSize is not a function`, etc.

- [ ] **Step 3: Export the three helpers from `remotion/src/overlays.jsx`**

Add these three functions immediately before the `SubtitleBar` function (around line 278):

```js
export function subtitleFontSize(aspect) {
  return aspect === '9:16' ? 60 : 40;
}

export function quoteCalloutHorizontal(aspect) {
  return aspect === '9:16'
    ? { left: '50%', transform: 'translateX(-50%)' }
    : { left: '5%' };
}

export function mapAttributionBottom(aspect) {
  return aspect === '9:16' ? 100 : 8;
}
```

- [ ] **Step 4: Run tests to verify the helpers pass**

```
npm test
```

Expected: all 8 new tests pass (72 + 8 = 80 total).

- [ ] **Step 5: Wire helpers into `SubtitleBar`**

In `SubtitleBar`, add `aspect = '16:9'` to the props destructure and update the `fontSize` line:

```jsx
export function SubtitleBar({ shots, timestamps, t, preRollS = 1, aspect = '16:9' }) {
```

Change the `fontSize: 30` line in the word span to:

```jsx
fontSize: subtitleFontSize(aspect),
```

- [ ] **Step 6: Wire helpers into `QuoteCallout`**

Add `aspect = '16:9'` to props and replace the hardcoded `left: '5%'` in the outer `<div>` style:

```jsx
export function QuoteCallout({ text, fromFrame, durationFrames, fadeFrames = 9, aspect = '16:9' }) {
```

Replace the outer div's style object — change `left: '5%',` to `...quoteCalloutHorizontal(aspect),`:

```jsx
    <div style={{
      position: 'absolute',
      ...quoteCalloutHorizontal(aspect),
      bottom: 140,
      maxWidth: '45%',
      opacity,
      zIndex: 15,
      pointerEvents: 'none',
    }}>
```

- [ ] **Step 7: Wire helper into `MapAttribution`**

Add `aspect = '16:9'` to props and use `mapAttributionBottom`:

```jsx
export function MapAttribution({ aspect = '16:9' }) {
  return (
    <div style={{
      position: 'absolute', bottom: mapAttributionBottom(aspect), left: 10, zIndex: 10,
      color: 'rgba(240,235,224,0.30)', fontSize: 8,
      letterSpacing: 0.4, pointerEvents: 'none',
      fontFamily: 'Source Serif 4, serif',
    }}>
      © Mapbox · © OpenStreetMap
    </div>
  );
}
```

- [ ] **Step 8: Run full test suite**

```
npm test
```

Expected: 80 tests pass.

- [ ] **Step 9: Commit**

```
git add remotion/src/overlays.jsx remotion/src/__tests__/overlays.test.jsx
git commit -m "feat: aspect-aware subtitle size and overlay positioning"
```

---

### Task 3: Add Broadcast916 composition to Root.jsx

**Files:**
- Modify: `remotion/src/Root.jsx`

Add a second composition at 1080×1920 that reuses the same `Broadcast` component and `calculateMetadata`. Remotion identifies compositions by `id` — `Broadcast916` is the target name used in produce-clip.

- [ ] **Step 1: Edit `remotion/src/Root.jsx`**

Replace the entire file content with:

```jsx
// remotion/src/Root.jsx
import { Composition, registerRoot } from 'remotion';
import { Broadcast, calculateMetadata } from './Broadcast.jsx';

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Broadcast"
        component={Broadcast}
        calculateMetadata={calculateMetadata}
        defaultProps={{ edition: null, fps: 30, aspect: '16:9', port: 3002 }}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={1}
      />
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
    </>
  );
}

registerRoot(RemotionRoot);
```

- [ ] **Step 2: Run tests**

```
npm test
```

Expected: 80 tests pass (Root.jsx has no unit tests; this confirms nothing else broke).

- [ ] **Step 3: Commit**

```
git add remotion/src/Root.jsx
git commit -m "feat: add Broadcast916 composition at 1080x1920"
```

---

### Task 4: Add 9:16 full-bleed layout to Broadcast.jsx and pass aspect to overlays

**Files:**
- Modify: `remotion/src/Broadcast.jsx`

When `aspect === '9:16'`, the map fills the entire frame and all overlays float over it. The 16:9 path is unchanged. Both paths must pass `aspect` to `SubtitleBar`, `MapAttribution`, and `QuoteCallout`.

- [ ] **Step 1: Replace the return statement in `Broadcast.jsx`**

The component signature already has `aspect = '16:9'` in the props. Replace everything from `if (!shotlist)` to the end of the component with:

```jsx
  if (!shotlist) return <AbsoluteFill style={{ background: '#000' }} />;

  // Overlay sequences shared between both layouts.
  const overlaySequences = shotlist.shots.flatMap((shot, i) =>
    (shot.overlays ?? []).map((ov, j) => {
      const fromFrame    = Math.round((PRE_ROLL_S + shot.t + ov.tOffset) * fps);
      const shotEndFrame = Math.round((PRE_ROLL_S + shot.t + shot.hold) * fps);
      const durFrames    = Math.min(
        Math.round((ov.durationMs / 1000) * fps),
        shotEndFrame - fromFrame,
      );
      if (durFrames <= 0) return null;
      return (
        <Sequence key={`${i}-${j}`} from={fromFrame} durationInFrames={durFrames}>
          {ov.type === 'data-callout' && (
            <DataCallout text={ov.text} fromFrame={fromFrame} durationFrames={durFrames} />
          )}
          {ov.type === 'quote-callout' && (
            <QuoteCallout text={ov.text} fromFrame={fromFrame} durationFrames={durFrames} aspect={aspect} />
          )}
        </Sequence>
      );
    })
  );

  const audioSequences = shotlist.shots.map((shot, i) => (
    <Sequence key={i} from={Math.round((PRE_ROLL_S + shot.t) * fps)} durationInFrames={Math.round(shot.hold * fps)}>
      <Audio src={`http://localhost:${port}/out/audio/${edition}/shot-${i}.wav`} />
    </Sequence>
  ));

  const fadeOverlay = (
    <FadeOverlay
      durationInFrames={durationInFrames}
      preRollS={PRE_ROLL_S}
      postRollS={POST_ROLL_S}
    />
  );

  // ── 9:16 full-bleed layout ────────────────────────────────────────────────
  if (aspect === '9:16') {
    return (
      <AbsoluteFill style={{ background: '#000' }}>
        <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <TopBar edition={edition} t={t} />
        <MapAttribution aspect={aspect} />
        <RemotionFilmGrain opacity={0.055} />
        <SubtitleBar shots={shotlist.shots} timestamps={timestamps} t={t} preRollS={PRE_ROLL_S} aspect={aspect} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <Ticker shots={shotlist.shots} />
          <Chyron
            shots={shotlist.shots}
            t={t}
            preRollS={PRE_ROLL_S}
            durationInFrames={durationInFrames}
          />
        </div>
        {overlaySequences}
        {fadeOverlay}
        {audioSequences}
      </AbsoluteFill>
    );
  }

  // ── 16:9 layout (unchanged) ───────────────────────────────────────────────
  return (
    <AbsoluteFill style={{ background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', width: '100%', flex: 1, overflow: 'hidden' }}>
        <div
          ref={mapContainer}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <TopBar edition={edition} t={t} />
        <MapAttribution aspect={aspect} />
        <RemotionFilmGrain opacity={0.055} />
        <SubtitleBar shots={shotlist.shots} timestamps={timestamps} t={t} preRollS={PRE_ROLL_S} aspect={aspect} />
      </div>
      <div style={{ flexShrink: 0 }}>
        <Ticker shots={shotlist.shots} />
        <Chyron
          shots={shotlist.shots}
          t={t}
          preRollS={PRE_ROLL_S}
          durationInFrames={durationInFrames}
        />
      </div>
      {overlaySequences}
      {fadeOverlay}
      {audioSequences}
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Run tests**

```
npm test
```

Expected: 80 tests pass.

- [ ] **Step 3: Commit**

```
git add remotion/src/Broadcast.jsx
git commit -m "feat: add 9:16 full-bleed layout branch to Broadcast"
```

---

### Task 5: Remove TikTok crop filter from finalize-clip.js

**Files:**
- Modify: `scripts/finalize-clip.js`

The TikTok source is now a native 1080×1920 render — no crop or scale needed. Setting `videoFilter: null` passes the video through unchanged (same as YouTube).

- [ ] **Step 1: Edit the `tiktok` entry in `PLATFORM_DEFS`**

In `scripts/finalize-clip.js`, replace:

```js
  tiktok: {
    lufs:        -16,
    // crop(608 × 1080 from centre) → scale(1080 × 1920)
    videoFilter: 'crop=608:1080:656:0,scale=1080:1920',
    thumbTime:   PRE_ROLL_S + 5,
  },
```

with:

```js
  tiktok: {
    lufs:        -16,
    videoFilter: null,
    thumbTime:   PRE_ROLL_S + 5,
  },
```

- [ ] **Step 2: Run tests**

```
npm test
```

Expected: 80 tests pass.

- [ ] **Step 3: Commit**

```
git add scripts/finalize-clip.js
git commit -m "feat: remove TikTok crop filter (native 9:16 render)"
```

---

### Task 6: Add 9:16 render and split finalize calls in produce-clip.js

**Files:**
- Modify: `scripts/produce-clip.js`

When `platforms` includes `tiktok`, produce-clip runs a second Remotion render targeting `Broadcast916` and calls finalize-clip twice — once for non-TikTok platforms with the 16:9 master, once for TikTok with the 9:16 master. If `tiktok` is the only platform, the 16:9 render is skipped entirely.

- [ ] **Step 1: Add `platformList` declaration near the top of produce-clip.js**

After the `platforms` line (around line 51):

```js
const platforms    = args['platforms']    ?? 'youtube,tiktok';
```

Add immediately after:

```js
const platformList        = platforms.split(',').map(s => s.trim());
const hasTiktok           = platformList.includes('tiktok');
const nonTiktokPlatforms  = platformList.filter(p => p !== 'tiktok');
```

- [ ] **Step 2: Replace Stage 3 in produce-clip.js**

Find the `// ── Stage 3: remotion render ──` block (lines ~144–196) and replace it entirely with:

```js
// ── Stage 3: remotion render(s) ──────────────────────────────────────────────

banner('3 / 4', `remotion render  edition=${edition}`);

const { port: renderPort, close: closeRenderServer } = await startRenderServer({ rootDir: ROOT });
console.log(`  ✓ Render server listening on :${renderPort}`);

mkdirSync(join(ROOT, 'out', 'raw'), { recursive: true });

const rawPath     = join(ROOT, 'out', 'raw', `${edition}.mp4`);
const raw9x16Path = join(ROOT, 'out', 'raw', `${edition}-9x16.mp4`);

const remotionBin = process.platform === 'win32'
  ? join(ROOT, 'node_modules', '.bin', 'remotion.cmd')
  : join(ROOT, 'node_modules', '.bin', 'remotion');

const propsFiles = [];
let renderError = null;
try {
  // 3a: 16:9 render — skipped only when tiktok is the sole platform.
  if (nonTiktokPlatforms.length > 0) {
    const propsPath = join(ROOT, 'out', `remotion-props-${edition}.json`);
    propsFiles.push(propsPath);
    writeFileSync(propsPath, JSON.stringify({
      edition, aspect: '16:9', port: renderPort,
      mapboxToken: process.env.MAPBOX_TOKEN_RENDER ?? process.env.VITE_MAPBOX_TOKEN ?? '',
    }));
    await runAsync('record-16x9', remotionBin, [
      'render', 'Broadcast',
      `--props=${propsPath}`,
      '--output', rawPath,
      '--concurrency', '1', '--log', 'verbose',
    ], { shell: process.platform === 'win32' });
  }

  // 3b: 9:16 render — only when tiktok is in platforms.
  if (hasTiktok) {
    const props9x16Path = join(ROOT, 'out', `remotion-props-${edition}-9x16.json`);
    propsFiles.push(props9x16Path);
    writeFileSync(props9x16Path, JSON.stringify({
      edition, aspect: '9:16', port: renderPort,
      mapboxToken: process.env.MAPBOX_TOKEN_RENDER ?? process.env.VITE_MAPBOX_TOKEN ?? '',
    }));
    await runAsync('record-9x16', remotionBin, [
      'render', 'Broadcast916',
      `--props=${props9x16Path}`,
      '--output', raw9x16Path,
      '--concurrency', '1', '--log', 'verbose',
    ], { shell: process.platform === 'win32' });
  }
} catch (err) {
  renderError = err;
}

await closeRenderServer();
console.log('  Render server closed.');
for (const f of propsFiles) { try { unlinkSync(f); } catch {} }

if (renderError) {
  console.error(`\n✗ ${renderError.message}`);
  process.exit(renderError.status ?? 1);
}

if (nonTiktokPlatforms.length > 0 && !existsSync(rawPath)) {
  console.error(`✗ remotion render did not produce ${rawPath}`);
  process.exit(1);
}
if (hasTiktok && !existsSync(raw9x16Path)) {
  console.error(`✗ remotion render did not produce ${raw9x16Path}`);
  process.exit(1);
}
```

- [ ] **Step 3: Replace Stage 4 in produce-clip.js**

Find the `// ── Stage 4: finalize-clip ──` block (lines ~198–210) and replace it with:

```js
// ── Stage 4: finalize-clip ────────────────────────────────────────────────────

banner('4 / 4', `finalize-clip  edition=${edition}  platforms=${platforms}`);

// 4a: finalize non-tiktok platforms with the 16:9 master.
if (nonTiktokPlatforms.length > 0) {
  run('finalize-16x9', 'node', [
    join(SCRIPTS, 'finalize-clip.js'),
    `--edition=${edition}`,
    `--platforms=${nonTiktokPlatforms.join(',')}`,
    ...(bed ? [`--bed=${bed}`] : []),
  ]);
}

// 4b: finalize tiktok with the native 9:16 master.
if (hasTiktok) {
  run('finalize-tiktok', 'node', [
    join(SCRIPTS, 'finalize-clip.js'),
    `--edition=${edition}`,
    `--platforms=tiktok`,
    `--video=${raw9x16Path}`,
    ...(bed ? [`--bed=${bed}`] : []),
  ]);
}
```

- [ ] **Step 4: Remove the old `propsPath` and `writeFileSync` lines** that currently sit between the `startRenderServer` call and `let renderError = null` (around lines 165–166 of the original file). Find and delete:

```js
// Pass props via a JSON file — inline --props JSON breaks on Windows CMD
// because CMD strips the double quotes from the value.
const propsPath = join(ROOT, 'out', `remotion-props-${edition}.json`);
writeFileSync(propsPath, JSON.stringify({ edition, aspect, port: renderPort, mapboxToken: process.env.MAPBOX_TOKEN_RENDER ?? process.env.VITE_MAPBOX_TOKEN ?? '' }));
```

These are now handled inside the new Stage 3 block.

- [ ] **Step 5: Remove the now-redundant `remotionBin` declaration** that currently sits before Stage 3 (around line 159). It is redeclared inside the new Stage 3 block above.

Find and delete these lines from their old position:

```js
// On Windows, .bin/remotion is a bash script — use the .cmd wrapper instead.
const remotionBin = process.platform === 'win32'
  ? join(ROOT, 'node_modules', '.bin', 'remotion.cmd')
  : join(ROOT, 'node_modules', '.bin', 'remotion');
```

- [ ] **Step 6: Remove the now-redundant `rawPath` and `mkdirSync` lines** from their old position (around lines 155–157):

Find and delete:

```js
const rawPath = join(ROOT, 'out', 'raw', `${edition}.mp4`);
mkdirSync(join(ROOT, 'out', 'raw'), { recursive: true });
```

These are now declared inside the new Stage 3 block.

- [ ] **Step 7: Update the summary section at the end of produce-clip.js**

The summary uses `platforms.split(',').map(s => s.trim())` to iterate platforms — but `platformList` is now already declared. Find the line:

```js
const platformList = platforms.split(',').map(s => s.trim());
```

in the summary section and delete it (it's now a duplicate of the one added in Step 1).

- [ ] **Step 8: Run tests**

```
npm test
```

Expected: 80 tests pass.

- [ ] **Step 9: Commit**

```
git add scripts/produce-clip.js
git commit -m "feat: add 9:16 Remotion render and split finalize calls for TikTok"
```

---

## Verification

After all tasks are complete, do a smoke-test render of a known edition:

```
node scripts/produce-clip.js --edition=2026-06-04-evening --platforms=youtube,tiktok
```

Check:
- `out/raw/2026-06-04-evening.mp4` exists (16:9 master)
- `out/raw/2026-06-04-evening-9x16.mp4` exists (9:16 master)
- `out/final/2026-06-04-evening-youtube.mp4` — TopBar shows date but no LIVE, no time
- `out/final/2026-06-04-evening-tiktok.mp4` — full-bleed map, all overlays visible, subtitles at 60px
- TikTok thumbnail dimensions: `ffprobe out/final/2026-06-04-evening-tiktok.mp4 | grep Stream` should show `1080x1920`
