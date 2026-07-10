// MagnitudeBubble — a geo-anchored circle whose area is proportional to a
// numeric value (log-scaled). Used for 'data' beats with a numeric magnitude
// extracted from the narration.
import { AbsoluteFill, useVideoConfig, interpolate } from 'remotion';
import { useCurrentFrame } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT } from '../../tokens.js';

export function MagnitudeBubble({ treatment, mapRef }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity   = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  const map = mapRef?.current ?? null;
  if (!map) return null;

  const { lat, lng, value, unit = '', minPx = 18, maxPx = 80 } = treatment;

  let cx, cy;
  try {
    const pt = map.project([lng, lat]);
    cx = pt.x;
    cy = pt.y;
  } catch { return null; }

  // Log10-scale: 1→0%, 1000→100% of the minPx–maxPx range.
  const logScale = Math.min(1, Math.log10(Math.max(1, Math.abs(value))) / 3);
  const r        = minPx + (maxPx - minPx) * logScale;

  // Entrance: expand from 0 → r in first 0.6 s.
  const tNow = frame / fps;
  const enterR = interpolate(tNow, [0, 0.6], [0, r], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const label    = unit ? `${value}${unit}` : String(value);
  const fontSize = Math.max(10, Math.round(r * 0.42));

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 15, opacity }}>
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <circle
          cx={cx.toFixed(1)} cy={cy.toFixed(1)}
          r={enterR.toFixed(1)}
          fill={ACCENT} fillOpacity={0.16}
          stroke={ACCENT} strokeWidth={2} strokeOpacity={0.70}
        />
        {enterR > 12 && (
          <text
            x={cx.toFixed(1)} y={(cy + fontSize * 0.35).toFixed(1)}
            textAnchor="middle"
            fill={ACCENT} fontSize={fontSize}
            fontFamily="Playfair Display, serif"
            fontWeight="700"
          >
            {label}
          </text>
        )}
      </svg>
    </AbsoluteFill>
  );
}
