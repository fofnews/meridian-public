// remotion/src/scene-plan/treatments/MapAnnotation.jsx
// Geo-anchored pin label. Returns null when ProjectFnContext is null (deferred).
import { useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { useProject } from '../projection.jsx';
import { ACCENT, BG_OVERLAY } from '../../tokens.js';

export function MapAnnotation({ treatment }) {
  const project = useProject();
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity = useFadeOpacity({ durationS, fps });

  if (!project || opacity === 0) return null;

  const { x, y } = project({ lat: treatment.lat, lng: treatment.lng });

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, -100%)',
      opacity,
      zIndex: 17,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: BG_OVERLAY,
        borderRadius: 3,
        padding: '4px 10px',
        borderBottom: `2px solid ${ACCENT}`,
        whiteSpace: 'nowrap',
        color: ACCENT,
        fontFamily: 'Source Serif 4, serif',
        fontSize: 11,
        letterSpacing: 0.5,
      }}>{treatment.text}</div>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: ACCENT,
        margin: '2px auto 0',
      }} />
    </div>
  );
}
