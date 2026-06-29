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
