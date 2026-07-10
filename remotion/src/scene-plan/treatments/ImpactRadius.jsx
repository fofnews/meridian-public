// ImpactRadius — concentric rings around a geo-anchored point sized in km.
// Used for 'stakes' beats to visualize range/reach of an event.
// Requires mapRef to compute zoom-aware pixel radius from km.
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT } from '../../tokens.js';

export function ImpactRadius({ treatment, mapRef }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity   = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  const map = mapRef?.current ?? null;
  if (!map) return null;

  const { lat, lng, radiusKm = 100, label } = treatment;

  let cx, cy, radiusPx;
  try {
    const center = map.project([lng, lat]);
    cx = center.x;
    cy = center.y;
    // Mercator scale: meters per pixel at this zoom + latitude.
    const zoom         = map.getZoom();
    const metersPerPx  = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
    radiusPx           = (radiusKm * 1000) / metersPerPx;
  } catch { return null; }

  // Cap to avoid radius that fills the entire frame.
  radiusPx = Math.max(24, Math.min(radiusPx, Math.min(width, height) * 0.42));

  const tNow  = frame / fps;
  const pulse = 1 + 0.035 * Math.sin(tNow * Math.PI * 2);

  // Entrance: scale from 0 → full in first 0.8 s.
  const enterProgress = interpolate(tNow, [0, 0.8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const rings = [
    { scale: 1.0, opacity: 0.55, width: 2,   dash: '' },
    { scale: 0.6, opacity: 0.35, width: 1.5, dash: '6 6' },
    { scale: 0.3, opacity: 0.20, width: 1,   dash: '' },
  ];

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
            cx={cx.toFixed(1)}
            cy={cy.toFixed(1)}
            r={Math.max(0, radiusPx * ring.scale * pulse * enterProgress).toFixed(1)}
            fill="none"
            stroke={ACCENT}
            strokeWidth={ring.width}
            strokeOpacity={ring.opacity}
            strokeDasharray={ring.dash}
          />
        ))}
        {label && (
          <text
            x={(cx + radiusPx * 0.72).toFixed(1)}
            y={(cy - 8).toFixed(1)}
            fill={ACCENT}
            fontSize={11}
            fontFamily="Source Serif 4, serif"
            letterSpacing={1.5}
            opacity={0.80}
          >
            {label}
          </text>
        )}
      </svg>
    </AbsoluteFill>
  );
}
