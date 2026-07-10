// ContextStrip — left-anchored context blurb for 'reveal' beats.
// Migrated from the legacy ContextLabelOverlay in overlays.jsx.
import { useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';

export function ContextStrip({ treatment }) {
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity   = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 160,
      left: '4%',
      opacity,
      zIndex: 14,
      pointerEvents: 'none',
      maxWidth: '40%',
    }}>
      <div style={{
        background: 'rgba(10,13,20,0.82)',
        borderRadius: 4,
        padding: '10px 20px',
        borderLeft: '2px solid rgba(232,197,71,0.45)',
      }}>
        <div style={{
          color: 'rgba(240,235,224,0.45)',
          fontFamily: 'Source Serif 4, serif',
          fontSize: 8,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>
          Context
        </div>
        <div style={{
          color: 'rgba(240,235,224,0.80)',
          fontFamily: 'Source Serif 4, serif',
          fontSize: 12,
          lineHeight: 1.5,
        }}>
          {treatment.text}
        </div>
      </div>
    </div>
  );
}
