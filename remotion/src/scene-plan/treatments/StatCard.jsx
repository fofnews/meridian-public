// remotion/src/scene-plan/treatments/StatCard.jsx
import { useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT, BG_OVERLAY, BORDER_ACTIVE } from '../../tokens.js';

export function StatCard({ treatment }) {
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 270,
      left: '50%',
      transform: 'translateX(-50%)',
      opacity,
      zIndex: 15,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: BG_OVERLAY,
        borderRadius: 6,
        padding: '16px 32px',
        borderTop: `2px solid ${BORDER_ACTIVE}`,
        textAlign: 'center',
      }}>
        {treatment.label && (
          <div style={{
            color: ACCENT,
            fontFamily: 'Source Serif 4, serif',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>{treatment.label}</div>
        )}
        <div style={{
          color: ACCENT,
          fontFamily: 'Playfair Display, serif',
          fontSize: 64,
          fontWeight: 900,
          lineHeight: 1,
        }}>{treatment.value}</div>
      </div>
    </div>
  );
}
