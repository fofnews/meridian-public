// remotion/src/scene-plan/treatments/FlowArrow.jsx
// Renders animated flow arrows as an SVG overlay.
// Default style: bold solid line with a triangular arrowhead at the terminus.
// 'march' style: dashed marching animation with a circle terminus.
// When mapRef.current is available, uses map.project() for geo-accurate positioning.
// When not (no-map preview), falls back to a Mercator projection fitted to the
// bounding box of all flow paths — arrows are visible regardless of map state.
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';

const DEFAULT_COLOR = '#e8c84a';

function segDist(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Return the first `progress` (0–1) fraction of a coordinate array.
export function trimPolyline(coords, progress) {
  if (coords.length < 2 || progress <= 0) return [coords[0], coords[0]];
  if (progress >= 1) return coords;

  let total = 0;
  const segs = [];
  for (let i = 1; i < coords.length; i++) {
    const d = segDist(coords[i - 1], coords[i]);
    segs.push(d);
    total += d;
  }

  if (total === 0) return coords.slice(0, 2);

  const target = total * progress;
  let acc = 0;
  const result = [coords[0]];

  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const t = segs[i] > 0 ? (target - acc) / segs[i] : 0;
      result.push([
        coords[i][0] + t * (coords[i + 1][0] - coords[i][0]),
        coords[i][1] + t * (coords[i + 1][1] - coords[i][1]),
      ]);
      return result;
    }
    acc += segs[i];
    result.push(coords[i + 1]);
  }
  return result;
}

// Convert an array of {x,y} screen points to a smooth SVG path string
// using Catmull-Rom → cubic bezier conversion.
// tension controls how tightly the curve follows the polyline (0.3–0.5 works well).
function smoothPath(pts, tension = 0.55) {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
  }
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

// Web Mercator Y for a latitude in degrees.
function mercY(lat) {
  const r = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}

// Projection fitted to the bounding box of all flow paths (no-map fallback).
function makeBBoxProjection(flows, width, height) {
  const coords = flows.flatMap(f => f.path.map(p => [p.lng, p.lat]));
  const lngs   = coords.map(c => c[0]);
  const lats   = coords.map(c => c[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats),  maxLat = Math.max(...lats);

  const minMY  = mercY(minLat), maxMY = mercY(maxLat);
  const spanLng = (maxLng - minLng) || 1;
  const spanMY  = (maxMY  - minMY)  || 1;

  const scale = Math.min((width * 0.65) / spanLng, (height * 0.65) / spanMY);
  const cLng  = (minLng + maxLng) / 2;
  const cMY   = (minMY  + maxMY)  / 2;

  return ([lng, lat]) => ({
    x: width  / 2 + (lng        - cLng) * scale,
    y: height / 2 - (mercY(lat) - cMY)  * scale,
  });
}

// SVG arrowhead marker definition. Uses userSpaceOnUse so size is in viewport px.
function ArrowMarker({ id, color, w }) {
  const aw = w * 68; // arrowhead length along path
  const ah = w * 40; // arrowhead spread perpendicular to path
  const pts = `0,0 ${aw},${ah / 2} 0,${ah}`;
  return (
    <marker
      id={id}
      markerWidth={aw}
      markerHeight={ah}
      refX={aw * 0.85}
      refY={ah / 2}
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      <polygon points={pts} fill={color} />
    </marker>
  );
}

function ArrowMarkerCasing({ id, color, w }) {
  const aw = w * 68 + 5;
  const ah = w * 40 + 5;
  const pts = `0,0 ${aw},${ah / 2} 0,${ah}`;
  return (
    <marker
      id={id}
      markerWidth={aw}
      markerHeight={ah}
      refX={aw * 0.85}
      refY={ah / 2}
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      <polygon points={pts} fill={color} />
    </marker>
  );
}

export function FlowArrow({ treatment, mapRef }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity   = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  const tNow   = frame / fps;
  const map    = mapRef?.current ?? null;
  const style  = treatment.style ?? 'arrow';

  const project = map
    ? ([lng, lat]) => {
        try { const p = map.project([lng, lat]); return { x: p.x, y: p.y }; } catch { return null; }
      }
    : makeBBoxProjection(treatment.flows, width, height);

  // Unique marker IDs per flow (each may have a different color/weight).
  const markerIds = treatment.flows.map((f, i) => ({
    arrow:  `fa-arr-${i}`,
    casing: `fa-cas-${i}`,
  }));

  const defs    = [];
  const casings = [];
  const lines   = [];
  const dots    = [];

  for (let fi = 0; fi < treatment.flows.length; fi++) {
    const flow        = treatment.flows[fi];
    const revealDelay = flow.revealDelay    ?? 0;
    const revealDur   = flow.revealDuration ?? 1.5;
    const progress    = Math.max(0, Math.min(1, (tNow - revealDelay) / revealDur));
    if (progress <= 0) continue;

    const geoCoords = flow.path.map(p => [p.lng, p.lat]);
    const trimmed   = trimPolyline(geoCoords, progress);
    const color     = flow.color  ?? DEFAULT_COLOR;
    const w         = flow.weight ?? 1;

    const pts = trimmed.map(project).filter(Boolean);
    if (pts.length < 2) continue;

    const d        = smoothPath(pts);
    const terminus = pts[pts.length - 1];
    const { arrow: arrowId, casing: casingId } = markerIds[fi];

    if (style === 'arrow') {
      defs.push(<ArrowMarker        key={arrowId}  id={arrowId}  color={color}            w={w} />);
      defs.push(<ArrowMarkerCasing  key={casingId} id={casingId} color="rgba(0,0,0,0.65)" w={w} />);

      casings.push(
        <path
          key={fi}
          d={d}
          fill="none"
          stroke="rgba(0,0,0,0.65)"
          strokeWidth={w * 54}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          strokeMiterlimit={4}
          markerEnd={`url(#${casingId})`}
        />
      );
      lines.push(
        <path
          key={fi}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={w * 30}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          strokeMiterlimit={4}
          markerEnd={`url(#${arrowId})`}
        />
      );
    } else {
      // 'march': dashed animation with circle at terminus
      const dashOffset = -(frame * 0.5);
      casings.push(
        <path key={`cas-${fi}`} d={smoothPath(pts)} fill="none" stroke="rgba(0,0,0,0.65)"
          strokeWidth={w * 14} strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit={4} />
      );
      lines.push(
        <path key={`ln-${fi}`} d={d} fill="none" stroke={color}
          strokeWidth={w * 8} strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit={4}
          strokeDasharray="18 10" strokeDashoffset={dashOffset} />
      );
      dots.push(
        <circle key={fi} cx={terminus.x.toFixed(1)} cy={terminus.y.toFixed(1)}
          r={w * 6} fill={color} stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
      );
    }
  }

  if (casings.length === 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 15, opacity }}>
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>{defs}</defs>
        {casings}
        {lines}
        {dots}
      </svg>
    </AbsoluteFill>
  );
}
