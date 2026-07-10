# Scene-Plan Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the `scene-plan/` module (typed treatment layer: shot data → validated `ScenePlan` JSON → Remotion overlay renderer) for screen-anchored overlays (`LowerThird`, `StatCard`), leaving the camera system and existing overlay system untouched.

**Architecture:** Extend `synthesize-narration.js` to convert finalized shot overlays into a `ScenePlan` (validated by Zod at write-time). Mount `SceneRenderer` as a new layer above the existing map in `Broadcast.jsx`. The existing `overlaySequences` pipeline continues unchanged; scene-plan overlays render alongside it. Geo-anchored treatments (`MapAnnotation`, `ConnectionArc`) are wired to the `ProjectFn` context but explicitly deferred pending confirmed real-shot data.

**Tech Stack:** React 19, Remotion 4, Vitest, Zod (to install), plain JS/JSX (no TypeScript in this repo)

---

## Investigation Corrections

The brief made several assumptions that differ from the code. These corrections are authoritative:

1. **No TypeScript** — project has no `tsconfig.json`, no `ts` deps. All scene-plan files are `.js`/`.jsx`. The brief's `.ts`/`.tsx` extensions do not apply.
2. **No standalone token module** — `tokens.ts` does not get created. Instead, create `remotion/src/tokens.js` as the merge target and update `overlays.jsx` to import from it.
3. **No selector.ts** — the selector logic already exists as `classifyIntent` in `scripts/intent-classifier.js` and overlay-building in `scripts/anchor-finder.js`. Do not create a parallel version. The adapter (Task 12) converts `shot.overlays[]` (already emitted by `buildAnchoredCameraPath`) into ScenePlan treatments.
4. **ScenePlan emitted from `synthesize-narration.js`, not `build-shotlist.js`** — overlays are finalized in `synthesize-narration.js` (after TTS, re-anchoring, quote detection). That is where `buildScenePlan()` + `ScenePlan.parse()` belong.
5. **Render path = live WebGL** — confirmed by `useRemotionMap.js`. ProjectFn: `(p) => { const pt = mapRef.current.project([p.lng, p.lat]); return { x: pt.x, y: pt.y }; }`. Map camera is set via `jumpTo` (sync) before Remotion captures the frame, so `project()` is always current.
6. **`SceneRenderer` receives `mapRef`** (not a pre-computed `projectFn`) to avoid stale closure. It creates the `projectFn` lazily and provides it via `ProjectFnContext`.

---

## File Map

| Action   | Path | Role |
|----------|------|------|
| Create   | `remotion/src/tokens.js` | Single token source: color constants used by overlays and treatments |
| Modify   | `remotion/src/overlays.jsx` | Import colors from `tokens.js` instead of inline |
| Create   | `remotion/src/scene-plan/schema.js` | Zod discriminated union + `ScenePlan` schema |
| Create   | `remotion/src/scene-plan/timing.js` | `useFadeOpacity` hook (relative-frame fade inside a Sequence) |
| Create   | `remotion/src/scene-plan/projection.jsx` | `ProjectFnContext` + `useProject()` hook |
| Create   | `remotion/src/scene-plan/registry.js` | `type → component` map, `isOverlay()`, `isCameraMove()`, `getComponent()` |
| Create   | `remotion/src/scene-plan/treatments/LowerThird.jsx` | Screen-anchored lower-third text card |
| Create   | `remotion/src/scene-plan/treatments/StatCard.jsx` | Screen-anchored stat/data card |
| Create   | `remotion/src/scene-plan/treatments/MapAnnotation.jsx` | Geo-anchored pin label (wired but deferred) |
| Create   | `remotion/src/scene-plan/treatments/ConnectionArc.jsx` | Geo-anchored SVG arc (wired but deferred) |
| Create   | `remotion/src/scene-plan/SceneRenderer.jsx` | Validates plan, renders overlay Sequences |
| Modify   | `scripts/synthesize-narration.js` | Add `buildScenePlan()` + `ScenePlan.parse()` at end, write to `shotlist.scenePlan` |
| Modify   | `remotion/src/Broadcast.jsx` | Import + mount `<SceneRenderer plan={shotlist.scenePlan} mapRef={mapRef} />` |
| Create   | `remotion/src/__tests__/scene-plan-schema.test.js` | Zod schema parse tests |
| Create   | `remotion/src/__tests__/scene-plan-renderer.test.jsx` | SceneRenderer render tests |

---

## Key Types (JSDoc reference)

```js
// Shot overlay descriptor (from anchor-finder.js / synthesize-narration.js)
// { type: string, tOffset: number (s from shot start), durationMs: number, text?: string, ... }

// ScenePlan (validated by Zod schema.js)
// {
//   version: '1',
//   edition: string,
//   fps: number,
//   width: number,
//   height: number,
//   scenes: Scene[]
// }

// Scene
// { shotIndex: number, tStart: number (s, no pre-roll), tEnd: number, treatments: Treatment[] }

// Treatment (discriminated union on 'type')
// lower-third: { type, tStart, tEnd, headline, label? }
// stat-card:   { type, tStart, tEnd, value, label? }
// map-annotation: { type, tStart, tEnd, lat, lng, text }
// connection-arc: { type, tStart, tEnd, fromLat, fromLng, toLat, toLng }
// camera-move:    { type, tStart, tEnd, lat, lng, zoom, pitch, bearing }
```

---

## Task 1: Install Zod

**Files:** none (package dependency)

- [ ] **Step 1: Install**

```bash
npm install zod
```

- [ ] **Step 2: Verify**

```bash
node -e "import('zod').then(z => console.log('zod ok:', z.z.string().parse('hello')))"
```

Expected output: `zod ok: hello`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add zod for ScenePlan runtime validation"
```

---

## Task 2: Create tokens.js and update overlays.jsx

**Files:**
- Create: `remotion/src/tokens.js`
- Modify: `remotion/src/overlays.jsx:8-15` (replace inline color constants with imports)

- [ ] **Step 1: Write the failing test**

Create `remotion/src/__tests__/scene-plan-tokens.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  ACCENT, ACCENT_TEXT, TEXT_60, TEXT_55, BG_OVERLAY,
  CHYRON_UPPER, CHYRON_LOWER, BORDER_ACTIVE, BORDER_HERO,
} from '../tokens.js';

describe('tokens', () => {
  it('ACCENT is the gold color', () => {
    expect(ACCENT).toBe('#e8c547');
  });
  it('BG_OVERLAY is dark semi-transparent', () => {
    expect(BG_OVERLAY).toMatch(/rgba\(10,13,20/);
  });
  it('all exports are strings', () => {
    const vals = [ACCENT, ACCENT_TEXT, TEXT_60, TEXT_55, BG_OVERLAY,
                  CHYRON_UPPER, CHYRON_LOWER, BORDER_ACTIVE, BORDER_HERO];
    for (const v of vals) expect(typeof v).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run remotion/src/__tests__/scene-plan-tokens.test.js
```

Expected: FAIL — `tokens.js` not found.

- [ ] **Step 3: Create `remotion/src/tokens.js`**

```js
// remotion/src/tokens.js
// Single color-token source for all Remotion overlays and scene-plan treatments.
export const ACCENT        = '#e8c547';
export const ACCENT_TEXT   = '#0a0d14';
export const TEXT_PRIMARY  = 'rgba(240,235,224,1.0)';
export const TEXT_60       = 'rgba(240,235,224,0.60)';
export const TEXT_55       = 'rgba(240,235,224,0.55)';
export const BG_OVERLAY    = 'rgba(10,13,20,0.82)';
export const CHYRON_UPPER  = 'rgba(10,13,20,0.92)';
export const CHYRON_LOWER  = 'rgba(18,22,36,0.96)';
export const BORDER_ACTIVE = 'rgba(232,197,71,0.70)';
export const BORDER_HERO   = 'rgba(232,197,71,0.30)';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run remotion/src/__tests__/scene-plan-tokens.test.js
```

Expected: PASS

- [ ] **Step 5: Update `remotion/src/overlays.jsx`**

Replace the inline color block (lines 8–15) with imports. Change:

```js
// ── Color constants (dark theme) ──────────────────────────────────────────────
const ACCENT         = '#e8c547';
const ACCENT_TEXT    = '#0a0d14';
const TEXT_60        = 'rgba(240,235,224,0.60)';
const TEXT_55        = 'rgba(240,235,224,0.55)';
const CHYRON_UPPER   = 'rgba(10,13,20,0.92)';
const CHYRON_LOWER   = 'rgba(18,22,36,0.96)';
const BORDER_ACTIVE  = 'rgba(232,197,71,0.70)';
```

To:

```js
import { ACCENT, ACCENT_TEXT, TEXT_60, TEXT_55, CHYRON_UPPER, CHYRON_LOWER, BORDER_ACTIVE } from './tokens.js';
```

- [ ] **Step 6: Run existing overlay tests to verify no regression**

```bash
npx vitest run remotion/src/__tests__/overlays.test.jsx
```

Expected: PASS (same as before)

- [ ] **Step 7: Commit**

```bash
git add remotion/src/tokens.js remotion/src/overlays.jsx remotion/src/__tests__/scene-plan-tokens.test.js
git commit -m "feat: extract color tokens into remotion/src/tokens.js; import in overlays.jsx"
```

---

## Task 3: Create scene-plan/schema.js

**Files:**
- Create: `remotion/src/scene-plan/schema.js`
- Create (tests): `remotion/src/__tests__/scene-plan-schema.test.js`

- [ ] **Step 1: Write the failing tests**

Create `remotion/src/__tests__/scene-plan-schema.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { ScenePlan, Treatment } from '../scene-plan/schema.js';

const VALID_PLAN = {
  version: '1',
  edition: '2026-06-28-evening',
  fps: 30,
  width: 1920,
  height: 1080,
  scenes: [
    {
      shotIndex: 0,
      tStart: 0,
      tEnd: 12.5,
      treatments: [
        { type: 'lower-third', tStart: 1.0, tEnd: 4.0, headline: 'Trade tensions rise', label: 'Context' },
        { type: 'stat-card',   tStart: 5.0, tEnd: 8.0, value: '47%',                   label: 'DATA' },
      ],
    },
    {
      shotIndex: 1,
      tStart: 12.5,
      tEnd: 25.0,
      treatments: [
        { type: 'camera-move', tStart: 12.5, tEnd: 14.5, lat: 48.8, lng: 2.3, zoom: 9, pitch: 50, bearing: -10 },
        { type: 'map-annotation', tStart: 15.0, tEnd: 20.0, lat: 48.8, lng: 2.3, text: 'Paris' },
        { type: 'connection-arc', tStart: 16.0, tEnd: 22.0, fromLat: 48.8, fromLng: 2.3, toLat: 51.5, toLng: -0.1 },
      ],
    },
  ],
};

describe('ScenePlan schema', () => {
  it('parses a valid plan without throwing', () => {
    expect(() => ScenePlan.parse(VALID_PLAN)).not.toThrow();
  });

  it('returns the typed object on success', () => {
    const parsed = ScenePlan.parse(VALID_PLAN);
    expect(parsed.version).toBe('1');
    expect(parsed.scenes).toHaveLength(2);
    expect(parsed.scenes[0].treatments[0].type).toBe('lower-third');
  });

  it('throws when version is wrong', () => {
    expect(() => ScenePlan.parse({ ...VALID_PLAN, version: '2' })).toThrow();
  });

  it('throws when a treatment type is unknown', () => {
    const bad = structuredClone(VALID_PLAN);
    bad.scenes[0].treatments.push({ type: 'unknown-type', tStart: 0, tEnd: 1 });
    expect(() => ScenePlan.parse(bad)).toThrow();
  });

  it('throws when tEnd is missing on a treatment', () => {
    const bad = structuredClone(VALID_PLAN);
    delete bad.scenes[0].treatments[0].tEnd;
    expect(() => ScenePlan.parse(bad)).toThrow();
  });

  it('throws when lower-third is missing headline', () => {
    const bad = structuredClone(VALID_PLAN);
    delete bad.scenes[0].treatments[0].headline;
    expect(() => ScenePlan.parse(bad)).toThrow();
  });

  it('parses safeParse as success for valid plan', () => {
    const result = ScenePlan.safeParse(VALID_PLAN);
    expect(result.success).toBe(true);
  });

  it('safeParse returns failure for invalid plan', () => {
    const result = ScenePlan.safeParse({ version: '1', edition: 'x' }); // missing fields
    expect(result.success).toBe(false);
  });
});

describe('Treatment discriminated union', () => {
  it('parses a lower-third treatment', () => {
    const t = Treatment.parse({ type: 'lower-third', tStart: 0, tEnd: 3, headline: 'Hi' });
    expect(t.type).toBe('lower-third');
  });

  it('parses a stat-card treatment', () => {
    const t = Treatment.parse({ type: 'stat-card', tStart: 0, tEnd: 3, value: '42%' });
    expect(t.type).toBe('stat-card');
    expect(t.value).toBe('42%');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run remotion/src/__tests__/scene-plan-schema.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `remotion/src/scene-plan/schema.js`**

```js
// remotion/src/scene-plan/schema.js
import { z } from 'zod';

const LowerThirdTreatment = z.object({
  type: z.literal('lower-third'),
  tStart: z.number(),
  tEnd: z.number(),
  headline: z.string(),
  label: z.string().optional(),
});

const StatCardTreatment = z.object({
  type: z.literal('stat-card'),
  tStart: z.number(),
  tEnd: z.number(),
  value: z.string(),
  label: z.string().optional(),
});

const MapAnnotationTreatment = z.object({
  type: z.literal('map-annotation'),
  tStart: z.number(),
  tEnd: z.number(),
  lat: z.number(),
  lng: z.number(),
  text: z.string(),
});

const ConnectionArcTreatment = z.object({
  type: z.literal('connection-arc'),
  tStart: z.number(),
  tEnd: z.number(),
  fromLat: z.number(),
  fromLng: z.number(),
  toLat: z.number(),
  toLng: z.number(),
});

const CameraMoveTreatment = z.object({
  type: z.literal('camera-move'),
  tStart: z.number(),
  tEnd: z.number(),
  lat: z.number(),
  lng: z.number(),
  zoom: z.number(),
  pitch: z.number(),
  bearing: z.number(),
});

export const Treatment = z.discriminatedUnion('type', [
  LowerThirdTreatment,
  StatCardTreatment,
  MapAnnotationTreatment,
  ConnectionArcTreatment,
  CameraMoveTreatment,
]);

const Scene = z.object({
  shotIndex: z.number().int().nonnegative(),
  tStart: z.number(),
  tEnd: z.number(),
  treatments: z.array(Treatment),
});

export const ScenePlan = z.object({
  version: z.literal('1'),
  edition: z.string(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  scenes: z.array(Scene),
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run remotion/src/__tests__/scene-plan-schema.test.js
```

Expected: PASS (all 8 tests)

- [ ] **Step 5: Commit**

```bash
git add remotion/src/scene-plan/schema.js remotion/src/__tests__/scene-plan-schema.test.js
git commit -m "feat: scene-plan Zod schema (ScenePlan, Treatment discriminated union)"
```

---

## Task 4: Create scene-plan/timing.js

**Files:**
- Create: `remotion/src/scene-plan/timing.js`

- [ ] **Step 1: Write the failing test**

Add to `remotion/src/__tests__/scene-plan-schema.test.js` (or create `scene-plan-timing.test.js`):

Create `remotion/src/__tests__/scene-plan-timing.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';

// useFadeOpacity calls useCurrentFrame() and interpolate() from remotion.
// Mock remotion and import the hook.
vi.mock('remotion', () => ({
  useCurrentFrame: vi.fn(),
  interpolate: (x, inputRange, outputRange, _opts) => {
    const [x0, x1, x2, x3] = inputRange;
    const [y0, y1, y2, y3] = outputRange;
    if (x <= x0) return y0;
    if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    if (x <= x2) return y1;
    if (x <= x3) return y2 + (y3 - y2) * (x - x2) / (x3 - x2);
    return y3;
  },
}));

import { useCurrentFrame } from 'remotion';
import { useFadeOpacity } from '../scene-plan/timing.js';

function callHookAtFrame(frame, opts) {
  useCurrentFrame.mockReturnValue(frame);
  return useFadeOpacity(opts);
}

describe('useFadeOpacity', () => {
  const opts = { durationS: 2, fps: 30, fadeS: 0.3 };
  // totalFrames = 60, fadeFrames = 9

  it('returns 0 at frame 0 (start of fade-in)', () => {
    expect(callHookAtFrame(0, opts)).toBe(0);
  });

  it('returns 1 at frame 9 (fully faded in)', () => {
    expect(callHookAtFrame(9, opts)).toBe(1);
  });

  it('returns 1 at frame 51 (start of fade-out: 60 - 9)', () => {
    expect(callHookAtFrame(51, opts)).toBe(1);
  });

  it('returns 0 at frame 60 (fully faded out)', () => {
    expect(callHookAtFrame(60, opts)).toBe(0);
  });

  it('returns 0 before frame 0', () => {
    expect(callHookAtFrame(-1, opts)).toBe(0);
  });

  it('returns 0 after frame 60', () => {
    expect(callHookAtFrame(61, opts)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run remotion/src/__tests__/scene-plan-timing.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `remotion/src/scene-plan/timing.js`**

```js
// remotion/src/scene-plan/timing.js
// useFadeOpacity — returns 0→1→1→0 fade opacity for an overlay inside a Sequence.
// useCurrentFrame() is 0-based (relative to the Sequence start) inside a Remotion Sequence.
import { useCurrentFrame, interpolate } from 'remotion';

export function useFadeOpacity({ durationS, fps, fadeS = 0.3 }) {
  const frame = useCurrentFrame();
  const totalFrames = Math.round(durationS * fps);
  const fadeFrames = Math.round(fadeS * fps);
  return interpolate(
    frame,
    [0, fadeFrames, totalFrames - fadeFrames, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run remotion/src/__tests__/scene-plan-timing.test.js
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add remotion/src/scene-plan/timing.js remotion/src/__tests__/scene-plan-timing.test.js
git commit -m "feat: scene-plan timing hook useFadeOpacity"
```

---

## Task 5: Create scene-plan/projection.jsx

**Files:**
- Create: `remotion/src/scene-plan/projection.jsx`

No unit test (trivial React context; behavior tested through SceneRenderer in Task 11).

- [ ] **Step 1: Create `remotion/src/scene-plan/projection.jsx`**

```jsx
// remotion/src/scene-plan/projection.jsx
// ProjectFnContext provides geo-to-screen projection to geo-anchored treatments.
// ProjectFn = (p: { lat: number, lng: number }) => { x: number, y: number }
import { createContext, useContext } from 'react';

export const ProjectFnContext = createContext(null);

export function useProject() {
  return useContext(ProjectFnContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add remotion/src/scene-plan/projection.jsx
git commit -m "feat: scene-plan ProjectFnContext for geo-to-screen projection"
```

---

## Task 6: Create treatments/LowerThird.jsx

**Files:**
- Create: `remotion/src/scene-plan/treatments/LowerThird.jsx`

- [ ] **Step 1: Write the failing test**

Create `remotion/src/__tests__/scene-plan-treatments.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';

vi.mock('remotion', () => ({
  useCurrentFrame: vi.fn(() => 5),
  useVideoConfig: vi.fn(() => ({ fps: 30 })),
  interpolate: (x, inputRange, outputRange, _opts) => {
    const [x0, x1, x2, x3] = inputRange;
    const [y0, y1, y2, y3] = outputRange;
    if (x <= x0) return y0;
    if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    if (x <= x2) return y1;
    if (x <= x3) return y2 + (y3 - y2) * (x - x2) / (x3 - x2);
    return y3;
  },
}));

import { LowerThird } from '../scene-plan/treatments/LowerThird.jsx';

const TREATMENT = { type: 'lower-third', tStart: 1.0, tEnd: 4.0, headline: 'Trade tensions rise', label: 'Context' };

describe('LowerThird', () => {
  it('exports a function', () => {
    expect(typeof LowerThird).toBe('function');
  });

  it('renders null when fully faded out (frame 0, before fade-in)', () => {
    const { useCurrentFrame } = await import('remotion');
    useCurrentFrame.mockReturnValue(0);
    // At frame 0, opacity = 0 → component returns null
    const result = LowerThird({ treatment: TREATMENT });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run remotion/src/__tests__/scene-plan-treatments.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `remotion/src/scene-plan/treatments/LowerThird.jsx`**

```jsx
// remotion/src/scene-plan/treatments/LowerThird.jsx
import { useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT, BG_OVERLAY, BORDER_ACTIVE, TEXT_PRIMARY } from '../../tokens.js';

export function LowerThird({ treatment }) {
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 160,
      left: '4%',
      maxWidth: '45%',
      opacity,
      zIndex: 16,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: BG_OVERLAY,
        borderRadius: 4,
        padding: '10px 20px',
        borderLeft: `2px solid ${BORDER_ACTIVE}`,
      }}>
        {treatment.label && (
          <div style={{
            color: 'rgba(240,235,224,0.45)',
            fontFamily: 'Source Serif 4, serif',
            fontSize: 8,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>{treatment.label}</div>
        )}
        <div style={{
          color: TEXT_PRIMARY,
          fontFamily: 'Playfair Display, serif',
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1.3,
        }}>{treatment.headline}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run remotion/src/__tests__/scene-plan-treatments.test.jsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add remotion/src/scene-plan/treatments/LowerThird.jsx remotion/src/__tests__/scene-plan-treatments.test.jsx
git commit -m "feat: scene-plan LowerThird treatment (screen-anchored)"
```

---

## Task 7: Create treatments/StatCard.jsx

**Files:**
- Create: `remotion/src/scene-plan/treatments/StatCard.jsx`

- [ ] **Step 1: Add test to `scene-plan-treatments.test.jsx`**

Append to `remotion/src/__tests__/scene-plan-treatments.test.jsx`:

```jsx
import { StatCard } from '../scene-plan/treatments/StatCard.jsx';

const STAT_TREATMENT = { type: 'stat-card', tStart: 2.0, tEnd: 5.0, value: '47%', label: 'DATA' };

describe('StatCard', () => {
  it('exports a function', () => {
    expect(typeof StatCard).toBe('function');
  });

  it('renders null when fully faded out (frame 0)', () => {
    const { useCurrentFrame } = await import('remotion');
    useCurrentFrame.mockReturnValue(0);
    const result = StatCard({ treatment: STAT_TREATMENT });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run remotion/src/__tests__/scene-plan-treatments.test.jsx
```

Expected: FAIL — `StatCard` not found.

- [ ] **Step 3: Create `remotion/src/scene-plan/treatments/StatCard.jsx`**

```jsx
// remotion/src/scene-plan/treatments/StatCard.jsx
import { useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT, BG_OVERLAY, BORDER_ACTIVE } from '../../tokens.js';

export function StatCard({ treatment }) {
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 110,
      left: '50%',
      transform: 'translateX(-50%)',
      opacity,
      zIndex: 15,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: BG_OVERLAY,
        borderRadius: 6,
        padding: '16px 32px',
        borderTop: `2px solid ${BORDER_ACTIVE}`,
        textAlign: 'center',
      }}>
        {treatment.label && (
          <div style={{
            color: ACCENT,
            fontFamily: 'Source Serif 4, serif',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>{treatment.label}</div>
        )}
        <div style={{
          color: ACCENT,
          fontFamily: 'Playfair Display, serif',
          fontSize: 64,
          fontWeight: 900,
          lineHeight: 1,
        }}>{treatment.value}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run remotion/src/__tests__/scene-plan-treatments.test.jsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add remotion/src/scene-plan/treatments/StatCard.jsx
git commit -m "feat: scene-plan StatCard treatment (screen-anchored)"
```

---

## Task 8: Create treatments/MapAnnotation.jsx (geo-anchored, wired but deferred)

**Files:**
- Create: `remotion/src/scene-plan/treatments/MapAnnotation.jsx`

- [ ] **Step 1: Add test to `scene-plan-treatments.test.jsx`**

```jsx
import { MapAnnotation } from '../scene-plan/treatments/MapAnnotation.jsx';

const MAP_TREATMENT = { type: 'map-annotation', tStart: 0, tEnd: 3, lat: 48.8, lng: 2.3, text: 'Paris' };

describe('MapAnnotation', () => {
  it('exports a function', () => {
    expect(typeof MapAnnotation).toBe('function');
  });

  it('renders null when no ProjectFn is in context (deferred)', () => {
    // ProjectFnContext defaults to null → no project function → returns null
    const result = MapAnnotation({ treatment: MAP_TREATMENT });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run remotion/src/__tests__/scene-plan-treatments.test.jsx
```

Expected: FAIL — `MapAnnotation` not found.

- [ ] **Step 3: Create `remotion/src/scene-plan/treatments/MapAnnotation.jsx`**

```jsx
// remotion/src/scene-plan/treatments/MapAnnotation.jsx
// Geo-anchored: projects a lat/lng to screen coords via ProjectFnContext.
// Deferred — returns null when no project function is available (first milestone).
import { useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { useProject } from '../projection.jsx';
import { ACCENT, BG_OVERLAY } from '../../tokens.js';

export function MapAnnotation({ treatment }) {
  const project = useProject();
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity = useFadeOpacity({ durationS, fps });

  if (!project || opacity === 0) return null;

  const { x, y } = project({ lat: treatment.lat, lng: treatment.lng });

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, -100%)',
      opacity,
      zIndex: 17,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: BG_OVERLAY,
        borderRadius: 3,
        padding: '4px 10px',
        borderBottom: `2px solid ${ACCENT}`,
        whiteSpace: 'nowrap',
        color: ACCENT,
        fontFamily: 'Source Serif 4, serif',
        fontSize: 11,
        letterSpacing: 0.5,
      }}>{treatment.text}</div>
      {/* Pin dot */}
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: ACCENT,
        margin: '2px auto 0',
      }} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run remotion/src/__tests__/scene-plan-treatments.test.jsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add remotion/src/scene-plan/treatments/MapAnnotation.jsx
git commit -m "feat: scene-plan MapAnnotation treatment (geo-anchored, deferred until ProjectFn wired)"
```

---

## Task 9: Create treatments/ConnectionArc.jsx (geo-anchored, wired but deferred)

**Files:**
- Create: `remotion/src/scene-plan/treatments/ConnectionArc.jsx`

- [ ] **Step 1: Add test**

```jsx
import { ConnectionArc } from '../scene-plan/treatments/ConnectionArc.jsx';

const ARC_TREATMENT = {
  type: 'connection-arc', tStart: 0, tEnd: 3,
  fromLat: 48.8, fromLng: 2.3, toLat: 51.5, toLng: -0.1,
};

describe('ConnectionArc', () => {
  it('exports a function', () => {
    expect(typeof ConnectionArc).toBe('function');
  });

  it('renders null when no ProjectFn is in context (deferred)', () => {
    const result = ConnectionArc({ treatment: ARC_TREATMENT });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run remotion/src/__tests__/scene-plan-treatments.test.jsx
```

Expected: FAIL — `ConnectionArc` not found.

- [ ] **Step 3: Create `remotion/src/scene-plan/treatments/ConnectionArc.jsx`**

```jsx
// remotion/src/scene-plan/treatments/ConnectionArc.jsx
// Geo-anchored SVG arc between two projected points.
// Returns null when no ProjectFn is available (deferred for first milestone).
import { useVideoConfig, AbsoluteFill } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { useProject } from '../projection.jsx';
import { ACCENT } from '../../tokens.js';

export function ConnectionArc({ treatment }) {
  const project = useProject();
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity = useFadeOpacity({ durationS, fps });

  if (!project || opacity === 0) return null;

  const from = project({ lat: treatment.fromLat, lng: treatment.fromLng });
  const to   = project({ lat: treatment.toLat,   lng: treatment.toLng   });

  // Quadratic bezier control point: midpoint lifted by 1/4 of chord length.
  const midX  = (from.x + to.x) / 2;
  const midY  = (from.y + to.y) / 2;
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  const cx    = midX;
  const cy    = midY - chord * 0.25;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 17, opacity }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <path
          d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2}
          strokeDasharray="6 4"
          opacity={0.75}
        />
        <circle cx={from.x} cy={from.y} r={4} fill={ACCENT} />
        <circle cx={to.x}   cy={to.y}   r={4} fill={ACCENT} />
      </svg>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run remotion/src/__tests__/scene-plan-treatments.test.jsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add remotion/src/scene-plan/treatments/ConnectionArc.jsx
git commit -m "feat: scene-plan ConnectionArc treatment (geo-anchored, deferred)"
```

---

## Task 10: Create scene-plan/registry.js

**Files:**
- Create: `remotion/src/scene-plan/registry.js`

- [ ] **Step 1: Write the failing test**

Create `remotion/src/__tests__/scene-plan-registry.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { isOverlay, isCameraMove, getComponent } from '../scene-plan/registry.js';

describe('isOverlay', () => {
  it('returns true for lower-third', () => expect(isOverlay('lower-third')).toBe(true));
  it('returns true for stat-card',   () => expect(isOverlay('stat-card')).toBe(true));
  it('returns true for map-annotation', () => expect(isOverlay('map-annotation')).toBe(true));
  it('returns true for connection-arc', () => expect(isOverlay('connection-arc')).toBe(true));
  it('returns false for camera-move',  () => expect(isOverlay('camera-move')).toBe(false));
  it('returns false for unknown type', () => expect(isOverlay('unknown')).toBe(false));
});

describe('isCameraMove', () => {
  it('returns true for camera-move',   () => expect(isCameraMove('camera-move')).toBe(true));
  it('returns false for lower-third',  () => expect(isCameraMove('lower-third')).toBe(false));
  it('returns false for unknown type', () => expect(isCameraMove('unknown')).toBe(false));
});

describe('getComponent', () => {
  it('returns a function for lower-third', () => expect(typeof getComponent('lower-third')).toBe('function'));
  it('returns a function for stat-card',   () => expect(typeof getComponent('stat-card')).toBe('function'));
  it('returns a function for map-annotation', () => expect(typeof getComponent('map-annotation')).toBe('function'));
  it('returns a function for connection-arc', () => expect(typeof getComponent('connection-arc')).toBe('function'));
  it('returns null for camera-move (not rendered)', () => expect(getComponent('camera-move')).toBeNull());
  it('returns null for unknown type',               () => expect(getComponent('unknown')).toBeNull());
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run remotion/src/__tests__/scene-plan-registry.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `remotion/src/scene-plan/registry.js`**

```js
// remotion/src/scene-plan/registry.js
import { LowerThird }    from './treatments/LowerThird.jsx';
import { StatCard }      from './treatments/StatCard.jsx';
import { MapAnnotation } from './treatments/MapAnnotation.jsx';
import { ConnectionArc } from './treatments/ConnectionArc.jsx';

const REGISTRY = {
  'lower-third':    LowerThird,
  'stat-card':      StatCard,
  'map-annotation': MapAnnotation,
  'connection-arc': ConnectionArc,
};

const OVERLAY_TYPES   = new Set(Object.keys(REGISTRY));
const CAMERA_TYPES    = new Set(['camera-move']);

export function isOverlay(type)   { return OVERLAY_TYPES.has(type); }
export function isCameraMove(type){ return CAMERA_TYPES.has(type); }
export function getComponent(type){ return REGISTRY[type] ?? null; }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run remotion/src/__tests__/scene-plan-registry.test.js
```

Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add remotion/src/scene-plan/registry.js remotion/src/__tests__/scene-plan-registry.test.js
git commit -m "feat: scene-plan registry (type→component map, isOverlay, isCameraMove)"
```

---

## Task 11: Create scene-plan/SceneRenderer.jsx

**Files:**
- Create: `remotion/src/scene-plan/SceneRenderer.jsx`
- Create (tests): `remotion/src/__tests__/scene-plan-renderer.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `remotion/src/__tests__/scene-plan-renderer.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';

vi.mock('remotion', () => ({
  useCurrentFrame: vi.fn(() => 10),
  useVideoConfig:  vi.fn(() => ({ fps: 30 })),
  interpolate: (x, inputRange, outputRange, _opts) => {
    const [x0, x1, x2, x3] = inputRange;
    const [y0, y1, y2, y3] = outputRange;
    if (x <= x0) return y0;
    if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    if (x <= x2) return y1;
    if (x <= x3) return y2 + (y3 - y2) * (x - x2) / (x3 - x2);
    return y3;
  },
  Sequence: ({ children, from, durationInFrames, 'data-testid': testid }) =>
    <div data-from={from} data-dur={durationInFrames} data-testid={testid}>{children}</div>,
  AbsoluteFill: ({ children, style }) => <div style={style}>{children}</div>,
}));

import { SceneRenderer } from '../scene-plan/SceneRenderer.jsx';

const VALID_PLAN = {
  version: '1',
  edition: '2026-06-28-evening',
  fps: 30, width: 1920, height: 1080,
  scenes: [
    {
      shotIndex: 0, tStart: 0, tEnd: 12,
      treatments: [
        { type: 'lower-third', tStart: 1.0, tEnd: 4.0, headline: 'Test', label: 'L' },
        { type: 'stat-card',   tStart: 5.0, tEnd: 8.0, value: '99%',    label: 'D' },
        { type: 'camera-move', tStart: 0,   tEnd: 2,   lat: 0, lng: 0, zoom: 2, pitch: 0, bearing: 0 },
      ],
    },
  ],
};

describe('SceneRenderer', () => {
  it('exports a function', () => {
    expect(typeof SceneRenderer).toBe('function');
  });

  it('throws ZodError when plan is invalid', () => {
    expect(() => SceneRenderer({ plan: { version: '2' }, mapRef: { current: null } }))
      .toThrow();
  });

  it('filters out camera-move treatments (not rendered as overlays)', () => {
    // Only lower-third and stat-card → 2 Sequences, not 3
    const result = SceneRenderer({ plan: VALID_PLAN, mapRef: { current: null } });
    // result is a JSX element; count Sequence children
    // We check that camera-move is excluded by inspecting the children array
    const children = result?.props?.children ?? [];
    const sequences = Array.isArray(children) ? children : [children];
    // 2 overlay treatments + ProjectFnContext wrapper
    expect(sequences.length).toBe(2);
  });

  it('computes correct from-frame for a treatment (PRE_ROLL_S = 1)', () => {
    const result = SceneRenderer({ plan: VALID_PLAN, mapRef: { current: null } });
    const children = Array.isArray(result?.props?.children) ? result.props.children : [result?.props?.children];
    // lower-third tStart=1.0 → fromFrame = (1 + 1.0) * 30 = 60
    const firstSeq = children[0];
    expect(firstSeq?.props?.from).toBe(60);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run remotion/src/__tests__/scene-plan-renderer.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `remotion/src/scene-plan/SceneRenderer.jsx`**

```jsx
// remotion/src/scene-plan/SceneRenderer.jsx
// Validates a ScenePlan and renders each overlay treatment in its own Sequence.
// Camera-move treatments are filtered out (handled by existing camera system).
import { Sequence, useVideoConfig } from 'remotion';
import { ScenePlan } from './schema.js';
import { isOverlay, getComponent } from './registry.js';
import { ProjectFnContext } from './projection.jsx';

const PRE_ROLL_S = 1; // must stay in sync with Broadcast.jsx

export function SceneRenderer({ plan, mapRef }) {
  const { fps } = useVideoConfig();

  const parsed = ScenePlan.parse(plan); // throws ZodError on invalid plan

  const projectFn = mapRef?.current
    ? (p) => {
        const pt = mapRef.current.project([p.lng, p.lat]);
        return { x: pt.x, y: pt.y };
      }
    : null;

  const sequences = [];
  for (const scene of parsed.scenes) {
    for (let ti = 0; ti < scene.treatments.length; ti++) {
      const t = scene.treatments[ti];
      if (!isOverlay(t.type)) continue;

      const Component = getComponent(t.type);
      if (!Component) continue;

      const fromFrame = Math.round((PRE_ROLL_S + t.tStart) * fps);
      const durFrames = Math.round((t.tEnd - t.tStart) * fps);
      if (durFrames <= 0) continue;

      sequences.push(
        <Sequence key={`${scene.shotIndex}-${ti}`} from={fromFrame} durationInFrames={durFrames}>
          <Component treatment={t} />
        </Sequence>
      );
    }
  }

  return (
    <ProjectFnContext.Provider value={projectFn}>
      {sequences}
    </ProjectFnContext.Provider>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run remotion/src/__tests__/scene-plan-renderer.test.jsx
```

Expected: PASS

- [ ] **Step 5: Run the full test suite to verify no regressions**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add remotion/src/scene-plan/SceneRenderer.jsx remotion/src/__tests__/scene-plan-renderer.test.jsx
git commit -m "feat: SceneRenderer validates ScenePlan and mounts overlay Sequences"
```

---

## Task 12: Extend synthesize-narration.js to emit ScenePlan

**Files:**
- Modify: `scripts/synthesize-narration.js`

The ScenePlan is built AFTER all overlays are finalized (after the re-anchor block at line 366) and written into `shotlist.scenePlan` before the final `writeFileSync`.

- [ ] **Step 1: Add import for schema and build helper at the top of synthesize-narration.js**

Add after the existing imports (around line 28):

```js
import { ScenePlan } from '../remotion/src/scene-plan/schema.js';
```

- [ ] **Step 2: Add `buildScenePlan` function before the `main()` call (before line 398 in build-shotlist.js, or at the module level in synthesize-narration.js)**

Add this function before the final `console.log` lines in `synthesize-narration.js`:

```js
// ── Build and validate ScenePlan from finalized shot overlays ─────────────────
// Converts shot.overlays[] entries into typed ScenePlan treatments.
// Overlay types not represented in the schema (arc-tokens, comparison, escalation)
// are silently skipped — they continue to render via the existing overlaySequences path.

function buildScenePlan(shotlist) {
  const isWide = (shotlist.aspect ?? '16:9') !== '9:16';
  const width  = isWide ? 1920 : 1080;
  const height = isWide ? 1080 : 1920;

  const scenes = shotlist.shots.map((shot, i) => {
    const tStart = shot.t;
    const tEnd   = shot.t + shot.hold;
    const treatments = [];

    for (const ov of (shot.overlays ?? [])) {
      const ovTStart = shot.t + (ov.tOffset ?? 0);
      const ovTEnd   = ovTStart + (ov.durationMs ?? 0) / 1000;
      if (ovTEnd <= ovTStart) continue;

      if (ov.type === 'data-callout') {
        treatments.push({ type: 'stat-card', tStart: ovTStart, tEnd: ovTEnd, value: ov.text ?? '', label: 'DATA' });
      } else if (ov.type === 'context-label') {
        treatments.push({ type: 'lower-third', tStart: ovTStart, tEnd: ovTEnd, headline: ov.text ?? '', label: 'Context' });
      } else if (ov.type === 'quote-callout') {
        treatments.push({ type: 'lower-third', tStart: ovTStart, tEnd: ovTEnd, headline: ov.text ?? '', label: 'Quote' });
      }
      // arc-tokens, comparison, escalation → not in ScenePlan v1; render via existing overlaySequences
    }

    return { shotIndex: i, tStart, tEnd, treatments };
  });

  return { version: '1', edition: shotlist.edition, fps: 30, width, height, scenes };
}
```

- [ ] **Step 3: Call `buildScenePlan` and write to shotlist after the re-anchor block**

After the `if (anyReAnchored) { ... }` block (after line ~366), add:

```js
// Emit ScenePlan — validate at generation so a bad plan fails before render.
const scenePlan = buildScenePlan(shotlist);
ScenePlan.parse(scenePlan); // throws if schema is violated
shotlist.scenePlan = scenePlan;
writeFileSync(shotlistPath, JSON.stringify(shotlist, null, 2));
console.log(`ScenePlan emitted (${scenePlan.scenes.length} scenes) → ${shotlistPath}`);
```

- [ ] **Step 4: Verify against a real edition**

Run synthesize-narration with an existing edition that has already been synthesized (dry-run to avoid re-generating audio):

```bash
node scripts/synthesize-narration.js --edition=2026-06-12-evening --dry-run
```

Expected output includes: `ScenePlan emitted (N scenes) → out/shotlists/2026-06-12-evening.json`

Verify the output file has a `scenePlan` key:

```bash
node -e "const d=JSON.parse(require('fs').readFileSync('out/shotlists/2026-06-12-evening.json')); console.log('scenes:', d.scenePlan?.scenes?.length, 'version:', d.scenePlan?.version)"
```

Expected: `scenes: N version: 1`

- [ ] **Step 5: Commit**

```bash
git add scripts/synthesize-narration.js
git commit -m "feat: synthesize-narration emits ScenePlan into shotlist.scenePlan with Zod validation"
```

---

## Task 13: Wire SceneRenderer into Broadcast.jsx

**Files:**
- Modify: `remotion/src/Broadcast.jsx`

- [x] **Step 1: Add SceneRenderer import**

Add to the imports at the top of `Broadcast.jsx`:

```js
import { SceneRenderer } from './scene-plan/SceneRenderer.jsx';
```

- [x] **Step 2: Mount SceneRenderer in both layouts**

In `Broadcast.jsx`, find the two return blocks (9:16 layout at line ~238, 16:9 layout at line ~266). In each, add `<SceneRenderer>` alongside `{overlaySequences}`:

For 9:16 layout (inside `<AbsoluteFill>`), after `{overlaySequences}`:
```jsx
{shotlist.scenePlan && (
  <SceneRenderer plan={shotlist.scenePlan} mapRef={mapRef} />
)}
```

For 16:9 layout (inside outer `<AbsoluteFill>`), after `{overlaySequences}`:
```jsx
{shotlist.scenePlan && (
  <SceneRenderer plan={shotlist.scenePlan} mapRef={mapRef} />
)}
```

- [x] **Step 3: Run the full test suite to verify no regressions**

```bash
npx vitest run
```

Expected: All tests pass.

- [x] **Step 4: Verify in Remotion Studio**

Start the Express server and Remotion Studio:

```bash
# Terminal 1
node server.js

# Terminal 2
npx remotion studio
```

Open the `Broadcast` composition in the browser. Scrub to a frame where `data-callout` or `context-label` overlays are active (if the edition has any). Verify:
- Existing `DataCallout`, `ContextLabelOverlay`, `Chyron` etc. still render correctly
- New `StatCard` and `LowerThird` (from ScenePlan) appear alongside them
- Camera motion is visually unchanged

- [x] **Step 5: Commit**

```bash
git add remotion/src/Broadcast.jsx
git commit -m "feat: mount SceneRenderer in Broadcast for scene-plan overlays"
```

---

## Definition of Done Checklist

- [ ] `npx vitest run` passes with zero failures
- [ ] Running `node scripts/synthesize-narration.js --edition=<real-edition> --dry-run` produces a `scenePlan` key in the shotlist JSON with `version: '1'`
- [ ] `ScenePlan.parse(shotlist.scenePlan)` succeeds without throwing
- [ ] `LowerThird` and `StatCard` are visible in Remotion Studio when the active shot has `context-label` or `data-callout` overlays
- [ ] `MapAnnotation` and `ConnectionArc` return null (deferred — no ProjectFn, map not live in studio's preview) — explicitly noted as geo-deferred
- [ ] Camera behavior in Remotion Studio is visually unchanged from before
- [ ] One token source in the tree: `remotion/src/tokens.js` imported by both `overlays.jsx` and all treatment components
- [ ] `overlaySequences` in Broadcast.jsx still renders existing overlay types (`arc-tokens`, `comparison`, `escalation`) unchanged

## Known Deferrals

- **`MapAnnotation` + `ConnectionArc` geo projection** — both components are wired to `ProjectFnContext` but return null when `project` is null. In Remotion Studio, `mapRef.current` is available but `map.project()` requires a tile-loaded, idling map which only works during an actual headless render (not studio preview). Full geo integration requires a headless render test with a real edition. Track as a follow-up.
- **Existing overlay types not in ScenePlan v1** — `arc-tokens`, `comparison`, `escalation`, `quote-callout` → continue rendering via `overlaySequences` path. Migration to ScenePlan treatments is a separate task.
