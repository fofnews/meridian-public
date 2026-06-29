import { describe, it, expect, vi } from 'vitest';

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
