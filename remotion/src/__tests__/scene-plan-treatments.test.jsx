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
  AbsoluteFill: ({ children, style }) => <div style={style}>{children}</div>,
}));

import { useCurrentFrame } from 'remotion';
import { LowerThird } from '../scene-plan/treatments/LowerThird.jsx';

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
