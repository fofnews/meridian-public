// RippleExpand — concentric rings expanding from a geo-anchored point.
// Stakes/significance pulse: 3 rings staggered by 1/3 of duration, expanding
// to MAX_RADIUS px, fading as they grow. Requires mapRef for geo-projection.
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT } from '../../tokens.js';

const RING_COUNT  = 3;
const MAX_RADIUS  = 80;   // pixels at full expansion
const RING_WIDTH  = 2;

export function RippleExpand({ treatment, mapRef }) {
  const frame          = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const durationS      = treatment.tEnd - treatment.tStart;
  const opacity        = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  const map = mapRef?.current ?? null;
  if (!map) return null;

  let pt;
  try { pt = map.project([treatment.lng, treatment.lat]); } catch { return null; }
  if (!pt) return null;

  const tNow    = frame / fps;
  const loopDur = durationS / 1.5;  // each ring completes before treatment ends

  const rings = Array.from({ length: RING_COUNT }, (_, i) => {
    const phase    = i / RING_COUNT;
    const progress = ((tNow / loopDur) + phase) % 1;
    return {
      r:       progress * MAX_RADIUS,
      ringOp:  (1 - progress) * 0.85,
    };
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 14, opacity }}>
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {rings.map((ring, i) => (
          <circle
            key={i}
            cx={pt.x.toFixed(1)}
            cy={pt.y.toFixed(1)}
            r={Math.max(0, ring.r).toFixed(1)}
            fill="none"
            stroke={ACCENT}
            strokeWidth={RING_WIDTH}
            opacity={ring.ringOp}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
}
