// remotion/src/scene-plan/treatments/ConnectionArc.jsx
// Geo-anchored SVG arc between two projected points. Returns null when ProjectFnContext is null (deferred).
import { useVideoConfig, AbsoluteFill } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { useProject } from '../projection.jsx';
import { ACCENT } from '../../tokens.js';

export function ConnectionArc({ treatment }) {
  const project = useProject();
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity = useFadeOpacity({ durationS, fps });

  if (!project || opacity === 0) return null;

  const from = project({ lat: treatment.fromLat, lng: treatment.fromLng });
  const to   = project({ lat: treatment.toLat,   lng: treatment.toLng   });

  const midX  = (from.x + to.x) / 2;
  const midY  = (from.y + to.y) / 2;
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  const cx    = midX;
  const cy    = midY - chord * 0.25;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 17, opacity }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <path
          d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2}
          strokeDasharray="6 4"
          opacity={0.75}
        />
        <circle cx={from.x} cy={from.y} r={4} fill={ACCENT} />
        <circle cx={to.x}   cy={to.y}   r={4} fill={ACCENT} />
      </svg>
    </AbsoluteFill>
  );
}
