// SpotlightMask — full-screen dark vignette with a circular soft cutout
// at the geo-anchored story location. Used for cinematic emphasis on high-impact shots.
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';

export function SpotlightMask({ treatment, mapRef }) {
  const { fps, width, height } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity   = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  const map = mapRef?.current ?? null;
  if (!map) return null;

  const { lat, lng, radiusPx = 280 } = treatment;

  let cx, cy;
  try {
    const pt = map.project([lng, lat]);
    cx = pt.x;
    cy = pt.y;
  } catch { return null; }

  const cxPct  = `${((cx / width)  * 100).toFixed(2)}%`;
  const cyPct  = `${((cy / height) * 100).toFixed(2)}%`;
  const inner  = `${radiusPx}px`;
  const outer  = `${radiusPx + 200}px`;

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(circle at ${cxPct} ${cyPct}, transparent ${inner}, rgba(0,0,0,0.70) ${outer})`,
      pointerEvents: 'none',
      zIndex: 12,
      opacity,
    }} />
  );
}
