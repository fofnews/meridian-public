import { describe, it, expect, vi } from 'vitest';

// Mock Remotion so the overlays module can be imported outside a Remotion context.
// interpolate must be provided because dataCalloutOpacity calls it at import time.
vi.mock('remotion', () => ({
  useCurrentFrame: vi.fn(),
  useVideoConfig: vi.fn(() => ({ fps: 30 })),
  interpolate: (x, inputRange, outputRange, _options) => {
    const [x0, x1, x2, x3] = inputRange;
    const [y0, y1, y2, y3] = outputRange;
    if (x <= x0) return y0;
    if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    if (x <= x2) return y1;
    if (x <= x3) return y2 + (y3 - y2) * (x - x2) / (x3 - x2);
    return y3;
  },
  AbsoluteFill: ({ children, style }) => <div style={style}>{children}</div>,
  Sequence: ({ children }) => <>{children}</>,
}));

import { dataCalloutOpacity, QuoteCallout, subtitleFontSize, quoteCalloutHorizontal, mapAttributionBottom } from '../overlays.jsx';

describe('DataCallout — opacity interpolation', () => {
  const fromFrame      = 100;
  const durationFrames = 60;
  const fadeFrames     = 9;

  it('opacity is 0 before the overlay starts (frame = fromFrame - 1)', () => {
    expect(dataCalloutOpacity(fromFrame - 1, fromFrame, durationFrames, fadeFrames)).toBe(0);
  });

  it('opacity is 1 when fully faded in (frame = fromFrame + fadeFrames)', () => {
    expect(dataCalloutOpacity(fromFrame + fadeFrames, fromFrame, durationFrames, fadeFrames)).toBe(1);
  });

  it('opacity is still 1 at start of fade-out (frame = fromFrame + durationFrames - fadeFrames)', () => {
    expect(dataCalloutOpacity(fromFrame + durationFrames - fadeFrames, fromFrame, durationFrames, fadeFrames)).toBe(1);
  });

  it('opacity is 0 after the overlay ends (frame = fromFrame + durationFrames + 1)', () => {
    expect(dataCalloutOpacity(fromFrame + durationFrames + 1, fromFrame, durationFrames, fadeFrames)).toBe(0);
  });
});

describe('QuoteCallout — opacity interpolation (reuses dataCalloutOpacity)', () => {
  const fromFrame      = 200;
  const durationFrames = 60;
  const fadeFrames     = 9;

  it('opacity is 0 before the overlay starts', () => {
    expect(dataCalloutOpacity(fromFrame - 1, fromFrame, durationFrames, fadeFrames)).toBe(0);
  });

  it('opacity is 1 when fully faded in', () => {
    expect(dataCalloutOpacity(fromFrame + fadeFrames, fromFrame, durationFrames, fadeFrames)).toBe(1);
  });

  it('opacity is 1 at start of fade-out', () => {
    expect(dataCalloutOpacity(fromFrame + durationFrames - fadeFrames, fromFrame, durationFrames, fadeFrames)).toBe(1);
  });

  it('opacity is 0 after the overlay ends', () => {
    expect(dataCalloutOpacity(fromFrame + durationFrames + 1, fromFrame, durationFrames, fadeFrames)).toBe(0);
  });
});

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
