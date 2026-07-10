import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT, TEXT_60 } from '../../tokens.js';

export function LocationBug({ treatment }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationS = treatment.tEnd - treatment.tStart;
  const opacity = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  // Sequence frame 0 = tStart; convert to shot-relative time.
  const tNow = treatment.tStart + frame / fps;
  const activeIdx = treatment.locations.reduce((best, loc, i) => (
    loc.tActive <= tNow ? i : best
  ), 0);

  return (
    <div style={{
      position: 'absolute',
      bottom: 195,
      right: '3%',
      opacity,
      zIndex: 13,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 6,
    }}>
      {treatment.locations.map((loc, i) => {
        const isActive = i === activeIdx;
        return (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              fontFamily: 'Source Serif 4, serif',
              fontSize: isActive ? 13 : 11,
              fontWeight: isActive ? 700 : 400,
              letterSpacing: isActive ? 1.5 : 1,
              textTransform: 'uppercase',
              color: isActive ? ACCENT : TEXT_60,
              transition: 'none',
              whiteSpace: 'nowrap',
            }}>{loc.name}</div>
            <div style={{
              width: isActive ? 6 : 4,
              height: isActive ? 6 : 4,
              borderRadius: '50%',
              background: isActive ? ACCENT : TEXT_60,
              flexShrink: 0,
            }} />
          </div>
        );
      })}
    </div>
  );
}
