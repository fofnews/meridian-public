// EscalationWarning — red-bordered warning strip for escalating situations.
// Migrated from the legacy EscalationOverlay in overlays.jsx.
import { useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';

export function EscalationWarning({ treatment }) {
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity   = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 160,
      left: '50%',
      transform: 'translateX(-50%)',
      opacity,
      zIndex: 14,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(10,13,20,0.82)',
        borderRadius: 4,
        padding: '10px 24px',
        borderTop: '2px solid rgba(196,79,79,0.70)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{ color: '#c44f4f', fontSize: 20, lineHeight: 1 }}>▲</div>
        <div style={{
          color: 'rgba(240,235,224,0.85)',
          fontFamily: 'Source Serif 4, serif',
          fontSize: 13,
          letterSpacing: 0.3,
        }}>
          {treatment.text}
        </div>
      </div>
    </div>
  );
}
