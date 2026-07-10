// remotion/src/scene-plan/treatments/LowerThird.jsx
import { useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { BG_OVERLAY, BORDER_ACTIVE, TEXT_PRIMARY } from '../../tokens.js';

export function LowerThird({ treatment }) {
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 195,
      left: '4%',
      maxWidth: '45%',
      opacity,
      zIndex: 16,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: BG_OVERLAY,
        borderRadius: 4,
        padding: '10px 20px',
        borderLeft: `2px solid ${BORDER_ACTIVE}`,
      }}>
        {treatment.label && (
          <div style={{
            color: 'rgba(240,235,224,0.45)',
            fontFamily: 'Source Serif 4, serif',
            fontSize: 8,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>{treatment.label}</div>
        )}
        <div style={{
          color: TEXT_PRIMARY,
          fontFamily: 'Playfair Display, serif',
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1.3,
        }}>{treatment.headline}</div>
      </div>
    </div>
  );
}
