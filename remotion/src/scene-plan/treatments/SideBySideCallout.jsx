// SideBySideCallout — two side-by-side stat cards for comparison beats.
// Migrated from the legacy ComparisonOverlay in overlays.jsx.
import { useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT, BORDER_ACTIVE } from '../../tokens.js';

export function SideBySideCallout({ treatment }) {
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity   = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  const { labelA, valueA, labelB, valueB } = treatment;

  return (
    <div style={{
      position: 'absolute',
      bottom: 160,
      left: '50%',
      transform: 'translateX(-50%)',
      opacity,
      zIndex: 14,
      pointerEvents: 'none',
      display: 'flex',
      gap: 12,
    }}>
      {[{ label: labelA, value: valueA }, { label: labelB, value: valueB }].map(({ label, value }) => (
        <div key={label} style={{
          background: 'rgba(10,13,20,0.82)',
          borderRadius: 4,
          padding: '10px 20px',
          borderTop: `2px solid ${BORDER_ACTIVE}`,
          textAlign: 'center',
          minWidth: 160,
        }}>
          <div style={{
            color: 'rgba(240,235,224,0.45)',
            fontFamily: 'Source Serif 4, serif',
            fontSize: 8,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            {label}
          </div>
          <div style={{
            color: ACCENT,
            fontFamily: 'Playfair Display, serif',
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1,
          }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
