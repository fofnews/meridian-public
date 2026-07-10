// ParticleTrail — animated dots streaming along a polyline.
// Used for multi-location 'stakes' beats to show causal flow between places.
// Reuses trimPolyline from FlowArrow for path interpolation.
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { trimPolyline } from './FlowArrow.jsx';
import { ACCENT } from '../../tokens.js';

function mercY(lat) {
  const r = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}

function makeBBoxProjection(path, width, height) {
  const lngs = path.map(p => p.lng);
  const lats  = path.map(p => p.lat);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats),  maxLat = Math.max(...lats);
  const minMY  = mercY(minLat), maxMY = mercY(maxLat);
  const spanLng = (maxLng - minLng) || 1;
  const spanMY  = (maxMY  - minMY)  || 1;
  const scale  = Math.min((width * 0.65) / spanLng, (height * 0.65) / spanMY);
  const cLng   = (minLng + maxLng) / 2;
  const cMY    = (minMY  + maxMY)  / 2;
  return ([lng, lat]) => ({
    x: width  / 2 + (lng        - cLng) * scale,
    y: height / 2 - (mercY(lat) - cMY)  * scale,
  });
}

export function ParticleTrail({ treatment, mapRef }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity   = useFadeOpacity({ durationS, fps });
  if (opacity === 0) return null;

  const path          = treatment.path ?? [];
  if (path.length < 2) return null;

  const particleCount = treatment.particleCount ?? 5;
  const speed         = treatment.speed ?? 0.3;
  const color         = treatment.color ?? ACCENT;
  const PERIOD_S      = 1 / speed;

  const map = mapRef?.current ?? null;
  const project = map
    ? ([lng, lat]) => { try { const p = map.project([lng, lat]); return { x: p.x, y: p.y }; } catch { return null; } }
    : makeBBoxProjection(path, width, height);

  const geoCoords = path.map(p => [p.lng, p.lat]);
  const tNow      = frame / fps;

  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const phaseOffset = i / particleCount;
    const progress    = ((tNow / PERIOD_S + phaseOffset) % 1 + 1) % 1;
    const trimmed     = trimPolyline(geoCoords, progress);
    const last        = trimmed[trimmed.length - 1];
    if (!last) continue;
    const pt = project(last);
    if (!pt) continue;
    const alpha = 0.4 + 0.6 * Math.sin(progress * Math.PI);
    particles.push({ key: i, x: pt.x, y: pt.y, alpha });
  }

  if (particles.length === 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 15, opacity }}>
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <filter id="pt-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {particles.map(({ key, x, y, alpha }) => (
          <circle key={key}
            cx={x.toFixed(1)} cy={y.toFixed(1)}
            r={5} fill={color} opacity={alpha}
            filter="url(#pt-glow)"
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
}
