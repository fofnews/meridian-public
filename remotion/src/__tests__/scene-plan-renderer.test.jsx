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
  Sequence: ({ children, from, durationInFrames }) =>
    <div data-from={from} data-dur={durationInFrames}>{children}</div>,
  AbsoluteFill: ({ children, style }) => <div style={style}>{children}</div>,
}));

vi.mock('../scene-plan/projection.jsx', () => ({
  ProjectFnContext: { Provider: ({ children }) => <>{children}</> },
  useProject: vi.fn(() => null),
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
    const result = SceneRenderer({ plan: VALID_PLAN, mapRef: { current: null } });
    // ProjectFnContext.Provider wraps the sequences
    // Its children should be the Sequence elements (2 overlays, not 3)
    const providerChildren = result?.props?.children;
    const sequences = Array.isArray(providerChildren) ? providerChildren : [providerChildren];
    expect(sequences.length).toBe(2);
  });

  it('computes correct from-frame for a treatment (PRE_ROLL_S = 1)', () => {
    const result = SceneRenderer({ plan: VALID_PLAN, mapRef: { current: null } });
    const providerChildren = result?.props?.children;
    const sequences = Array.isArray(providerChildren) ? providerChildren : [providerChildren];
    // lower-third tStart=1.0 → fromFrame = (1 + 1.0) * 30 = 60
    const firstSeq = sequences[0];
    expect(firstSeq?.props?.from).toBe(60);
  });
});
