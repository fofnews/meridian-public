// RouteReveal — a dashed or solid line that draws from origin to destination
// over revealDuration seconds. Used for multi-location 'reveal' beats.
// Different from ConnectionArc: straight/direct route, not a curved Bezier.
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT } from '../../tokens.js';

function mercY(lat) {
  const r = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}

function makeTwoPointProjection(from, to, width, height) {
  const pts  = [[from.lng, from.lat], [to.lng, to.lat]];
  const lngs = pts.map(p => p[0]);
  const lats  = pts.map(p => p[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats),  maxLat = Math.max(...lats);
  const minMY  = mercY(minLat), maxMY = mercY(maxLat);
  const spanLng = (maxLng - minLng) || 0.1;
  const spanMY  = (maxMY  - minMY)  || 0.1;
  const scale  = Math.min((width * 0.55) / spanLng, (height * 0.55) / spanMY);
  const cLng   = (minLng + maxLng) / 2;
  const cMY    = (minMY  + maxMY)  / 2;
  return ([lng, lat]) => ({
    x: width  / 2 + (lng        - cLng) * scale,
    y: height / 2 - (mercY(lat) - cMY)  * scale,
  });
}

export function RouteReveal({ treatment, mapRef }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const durationS      = treatment.tEnd - treatment.tStart;
  const opacity        = useFadeOpacity({ durationS, fps });
  if (opacity === 0) return null;

  const revealDuration = treatment.revealDuration ?? durationS * 0.7;
  const style          = treatment.style ?? 'dashed';
  const tNow           = frame / fps;
  const progress       = Math.min(1, tNow / Math.max(0.001, revealDuration));

  const map = mapRef?.current ?? null;
  let fromPt, toPt;

  if (map) {
    try {
      const f = map.project([treatment.from.lng, treatment.from.lat]);
      const t = map.project([treatment.to.lng,   treatment.to.lat]);
      fromPt = { x: f.x, y: f.y };
      toPt   = { x: f.x + (t.x - f.x) * progress, y: f.y + (t.y - f.y) * progress };
    } catch { return null; }
  } else {
    const proj = makeTwoPointProjection(treatment.from, treatment.to, width, height);
    const f    = proj([treatment.from.lng, treatment.from.lat]);
    const t    = proj([treatment.to.lng,   treatment.to.lat]);
    fromPt = f;
    toPt   = { x: f.x + (t.x - f.x) * progress, y: f.y + (t.y - f.y) * progress };
  }

  const dashProps = style === 'dashed'
    ? { strokeDasharray: '16 8', strokeDashoffset: -(frame * 0.3) }
    : {};

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 15, opacity }}>
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* casing */}
        <line
          x1={fromPt.x.toFixed(1)} y1={fromPt.y.toFixed(1)}
          x2={toPt.x.toFixed(1)}   y2={toPt.y.toFixed(1)}
          stroke="rgba(0,0,0,0.55)" strokeWidth={8} strokeLinecap="round"
        />
        {/* main line */}
        <line
          x1={fromPt.x.toFixed(1)} y1={fromPt.y.toFixed(1)}
          x2={toPt.x.toFixed(1)}   y2={toPt.y.toFixed(1)}
          stroke={ACCENT} strokeWidth={4} strokeLinecap="round"
          {...dashProps}
        />
        {/* origin dot */}
        <circle cx={fromPt.x.toFixed(1)} cy={fromPt.y.toFixed(1)} r={5}
          fill={ACCENT} opacity={0.9} />
        {/* terminus dot — appears when reveal is complete */}
        {progress >= 0.95 && (
          <circle cx={toPt.x.toFixed(1)} cy={toPt.y.toFixed(1)} r={6}
            fill={ACCENT} stroke="rgba(0,0,0,0.5)" strokeWidth={1.5} opacity={0.9} />
        )}
      </svg>
    </AbsoluteFill>
  );
}
