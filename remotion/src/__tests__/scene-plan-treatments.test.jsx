import { describe, it, expect, vi } from 'vitest';

vi.mock('../scene-plan/projection.jsx', () => ({
  useProject: vi.fn(() => null),
  ProjectFnContext: { _currentValue: null },
}));

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
  AbsoluteFill: ({ children, style }) => <div style={style}>{children}</div>,
}));

import { useCurrentFrame } from 'remotion';
import { LowerThird } from '../scene-plan/treatments/LowerThird.jsx';
import { StatCard } from '../scene-plan/treatments/StatCard.jsx';
import { MapAnnotation } from '../scene-plan/treatments/MapAnnotation.jsx';
import { ConnectionArc } from '../scene-plan/treatments/ConnectionArc.jsx';

const LOWER_TREATMENT = { type: 'lower-third', tStart: 1.0, tEnd: 4.0, headline: 'Trade tensions rise', label: 'Context' };

describe('LowerThird', () => {
  it('exports a function', () => {
    expect(typeof LowerThird).toBe('function');
  });

  it('renders null when fully faded out (frame 0)', () => {
    useCurrentFrame.mockReturnValue(0);
    const result = LowerThird({ treatment: LOWER_TREATMENT });
    expect(result).toBeNull();
  });
});

const STAT_TREATMENT = { type: 'stat-card', tStart: 2.0, tEnd: 5.0, value: '47%', label: 'DATA' };

describe('StatCard', () => {
  it('exports a function', () => {
    expect(typeof StatCard).toBe('function');
  });

  it('renders null when fully faded out (frame 0)', () => {
    useCurrentFrame.mockReturnValue(0);
    const result = StatCard({ treatment: STAT_TREATMENT });
    expect(result).toBeNull();
  });
});

const MAP_TREATMENT = { type: 'map-annotation', tStart: 0, tEnd: 3, lat: 48.8, lng: 2.3, text: 'Paris' };

describe('MapAnnotation', () => {
  it('exports a function', () => {
    expect(typeof MapAnnotation).toBe('function');
  });

  it('renders null when no ProjectFn is in context (deferred)', () => {
    // ProjectFnContext defaults to null → useProject() returns null → component returns null
    useCurrentFrame.mockReturnValue(15); // mid-duration, opacity > 0
    const result = MapAnnotation({ treatment: MAP_TREATMENT });
    expect(result).toBeNull();
  });
});

const ARC_TREATMENT = {
  type: 'connection-arc', tStart: 0, tEnd: 3,
  fromLat: 48.8, fromLng: 2.3, toLat: 51.5, toLng: -0.1,
};

describe('ConnectionArc', () => {
  it('exports a function', () => {
    expect(typeof ConnectionArc).toBe('function');
  });

  it('renders null when no ProjectFn is in context (deferred)', () => {
    useCurrentFrame.mockReturnValue(15);
    const result = ConnectionArc({ treatment: ARC_TREATMENT });
    expect(result).toBeNull();
  });
});
