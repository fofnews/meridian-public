// HatchedZone — projects a GeoJSON Polygon/MultiPolygon onto the screen and
// fills it with a diagonal hatch pattern. Used for 'contrast' beats showing
// contested or exclusion zones. Requires mapRef for geo-projection.
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';

const COLORS = {
  contested: { fill: 'rgba(196,79,79,0.12)', border: '#c44f4f', hatch: '#c44f4f' },
  exclusion: { fill: 'rgba(196,79,79,0.20)', border: '#c44f4f', hatch: '#c44f4f' },
};

function projectRing(ring, project) {
  return ring
    .map(([lng, lat]) => { try { const p = project([lng, lat]); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; } catch { return null; } })
    .filter(Boolean)
    .join(' ');
}

export function HatchedZone({ treatment, mapRef }) {
  const { fps, width, height } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity   = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  const map = mapRef?.current ?? null;
  if (!map) return null;

  const project = ([lng, lat]) => { try { return map.project([lng, lat]); } catch { return null; } };
  const pattern = treatment.pattern ?? 'contested';
  const colors  = COLORS[pattern] ?? COLORS.contested;

  const geo = treatment.polygon?.geometry ?? treatment.polygon;
  if (!geo) return null;

  let rings = [];
  if (geo.type === 'Polygon') {
    rings = [geo.coordinates[0]];
  } else if (geo.type === 'MultiPolygon') {
    rings = geo.coordinates.map(poly => poly[0]);
  } else {
    return null;
  }

  const hatchId = `hz-${pattern}`;

  const polygonEls = rings.map((ring, ri) => {
    const pts = projectRing(ring, project);
    if (!pts) return null;
    return (
      <g key={ri}>
        <polygon points={pts} fill={colors.fill} stroke={colors.border} strokeWidth={1.5} strokeOpacity={0.65} />
        <polygon points={pts} fill={`url(#${hatchId})`} />
      </g>
    );
  }).filter(Boolean);

  if (polygonEls.length === 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 13, opacity }}>
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <pattern
            id={hatchId}
            patternUnits="userSpaceOnUse"
            width={10} height={10}
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={5} x2={10} y2={5}
              stroke={colors.hatch} strokeWidth={1.5} strokeOpacity={0.45} />
          </pattern>
        </defs>
        {polygonEls}
      </svg>
    </AbsoluteFill>
  );
}
