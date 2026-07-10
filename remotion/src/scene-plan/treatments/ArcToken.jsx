// ArcToken — animated dots moving along arcs between geo-anchored pairs.
// Migrated from the legacy ArcTokens overlay in overlays.jsx.
// Uses linear interpolation between lat/lng pairs (close enough for news geography).
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT } from '../../tokens.js';

const PERIOD_S = 2.5;

function lerp(a, b, t) { return a + (b - a) * t; }

export function ArcToken({ treatment, mapRef }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity   = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  const map  = mapRef?.current ?? null;
  const arcs = treatment.arcs ?? [];
  if (arcs.length === 0) return null;

  const periodFrames = PERIOD_S * fps;
  const t = (frame % periodFrames) / periodFrames;

  const tokens = arcs.map((arc, i) => {
    const lng = lerp(arc.from.lng, arc.to.lng, t);
    const lat = lerp(arc.from.lat, arc.to.lat, t);
    if (!map) return null;
    try {
      const pt = map.project([lng, lat]);
      return { key: i, x: pt.x, y: pt.y };
    } catch { return null; }
  }).filter(Boolean);

  if (tokens.length === 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 13, opacity }}>
      {tokens.map(({ key, x, y }) => (
        <div
          key={key}
          style={{
            position: 'absolute',
            left: x - 4,
            top:  y - 4,
            width:  8,
            height: 8,
            borderRadius: '50%',
            background: ACCENT,
            boxShadow: `0 0 6px rgba(232,197,71,0.8)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
}
