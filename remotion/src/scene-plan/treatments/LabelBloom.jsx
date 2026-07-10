// LabelBloom — geo-anchored location name that rises + glows at shot start.
// Provides a cinematic "here's where" reveal above the story location.
// Requires mapRef for geo-projection; returns null if the map is not ready.
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useFadeOpacity } from '../timing.js';
import { ACCENT, TEXT_PRIMARY } from '../../tokens.js';

const RISE_DURATION_S = 1.0;   // entrance rise over 1 second
const RISE_PX         = 20;    // pixels to rise during entrance
const LABEL_OFFSET_Y  = 36;    // pixels above the projected point

export function LabelBloom({ treatment, mapRef }) {
  const frame          = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const durationS      = treatment.tEnd - treatment.tStart;
  const opacity        = useFadeOpacity({ durationS, fps });

  if (opacity === 0) return null;

  const map = mapRef?.current ?? null;
  if (!map) return null;

  let pt;
  try { pt = map.project([treatment.lng, treatment.lat]); } catch { return null; }
  if (!pt) return null;

  const tNow    = frame / fps;
  const riseProgress = interpolate(tNow, [0, RISE_DURATION_S], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const yOffset = (1 - riseProgress) * RISE_PX;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 17, opacity }}>
      <div style={{
        position: 'absolute',
        left:  pt.x,
        top:   pt.y - LABEL_OFFSET_Y - yOffset,
        transform: 'translateX(-50%)',
        textAlign: 'center',
      }}>
        <div style={{
          color:           TEXT_PRIMARY,
          fontFamily:      'Playfair Display, serif',
          fontSize:        16,
          fontWeight:      700,
          letterSpacing:   1.5,
          textTransform:   'uppercase',
          whiteSpace:      'nowrap',
          textShadow:      `0 0 20px ${ACCENT}, 0 0 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)`,
        }}>
          {treatment.text}
        </div>
        <div style={{
          width:      '100%',
          height:     1,
          background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
          marginTop:  3,
          opacity:    0.8,
        }} />
      </div>
    </AbsoluteFill>
  );
}
