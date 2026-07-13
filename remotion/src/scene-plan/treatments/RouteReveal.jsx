// RouteReveal — a dashed or solid line that draws from origin to destination
// over revealDuration seconds. mode:'geodesic' (default) follows the great circle
// using mapRef; mode:'straight' draws a direct screen-space line.
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT } from '../../tokens.js';

const DEG = Math.PI / 180;

function greatCirclePoints(from, to, n = 32) {
  const lng1 = from.lng * DEG, lat1 = from.lat * DEG;
  const lng2 = to.lng * DEG,   lat2 = to.lat * DEG;
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2,
  ));
  if (d < 1e-6) return [from, to];
  const sinD = Math.sin(d);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / sinD;
    const B = Math.sin(f * d) / sinD;
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push({
      lng: Math.atan2(y, x) / DEG,
      lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / DEG,
    });
  }
  for (let i = 1; i < pts.length; i++) {
    while (pts[i].lng - pts[i - 1].lng > 180) pts[i].lng -= 360;
    while (pts[i].lng - pts[i - 1].lng < -180) pts[i].lng += 360;
  }
  return pts;
}

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
  const mode           = treatment.mode ?? 'geodesic';
  const tNow           = frame / fps;
  const progress       = Math.min(1, tNow / Math.max(0.001, revealDuration));

  const map   = mapRef?.current ?? null;
  const isGeo = mode === 'geodesic' && map;

  const dashProps = style === 'dashed'
    ? { strokeDasharray: '16 8', strokeDashoffset: -(frame * 0.3) }
    : {};

  if (isGeo) {
    const gcPts      = greatCirclePoints(treatment.from, treatment.to, 32);
    const revealIdx  = Math.floor(progress * (gcPts.length - 1));
    const subProg    = (progress * (gcPts.length - 1)) - revealIdx;
    const visiblePts = gcPts.slice(0, revealIdx + 1);
    if (revealIdx < gcPts.length - 1) {
      const cur  = gcPts[revealIdx];
      const next = gcPts[revealIdx + 1];
      visiblePts.push({
        lng: cur.lng + (next.lng - cur.lng) * subProg,
        lat: cur.lat + (next.lat - cur.lat) * subProg,
      });
    }

    let screenPts;
    try {
      screenPts = visiblePts.map(pt => {
        const p = map.project([pt.lng, pt.lat]);
        return { x: p.x, y: p.y };
      });
    } catch { return null; }

    if (screenPts.length < 2) return null;

    const polyD = screenPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const orig  = screenPts[0];
    const dest  = screenPts[screenPts.length - 1];

    return (
      <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 15, opacity }}>
        <svg style={{ position: 'absolute', inset: 0, overflow: 'visible' }} width={width} height={height}>
          <path d={polyD} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          <path d={polyD} fill="none" stroke={ACCENT} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" {...dashProps} />
          <circle cx={orig.x.toFixed(1)} cy={orig.y.toFixed(1)} r={5} fill={ACCENT} opacity={0.9} />
          {progress >= 0.95 && (
            <circle cx={dest.x.toFixed(1)} cy={dest.y.toFixed(1)} r={6} fill={ACCENT} stroke="rgba(0,0,0,0.5)" strokeWidth={1.5} opacity={0.9} />
          )}
        </svg>
      </AbsoluteFill>
    );
  }

  // Straight mode (or geodesic without mapRef → fall back to straight)
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

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 15, opacity }}>
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1={fromPt.x.toFixed(1)} y1={fromPt.y.toFixed(1)}
          x2={toPt.x.toFixed(1)}   y2={toPt.y.toFixed(1)}
          stroke="rgba(0,0,0,0.55)" strokeWidth={8} strokeLinecap="round"
        />
        <line
          x1={fromPt.x.toFixed(1)} y1={fromPt.y.toFixed(1)}
          x2={toPt.x.toFixed(1)}   y2={toPt.y.toFixed(1)}
          stroke={ACCENT} strokeWidth={4} strokeLinecap="round"
          {...dashProps}
        />
        <circle cx={fromPt.x.toFixed(1)} cy={fromPt.y.toFixed(1)} r={5}
          fill={ACCENT} opacity={0.9} />
        {progress >= 0.95 && (
          <circle cx={toPt.x.toFixed(1)} cy={toPt.y.toFixed(1)} r={6}
            fill={ACCENT} stroke="rgba(0,0,0,0.5)" strokeWidth={1.5} opacity={0.9} />
        )}
      </svg>
    </AbsoluteFill>
  );
}
