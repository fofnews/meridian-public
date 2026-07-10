// hover — static hold at story location with slow bearing drift.
// Subtle motion keeps the globe "live." Bearing drifts at SPIN_DEG_PER_SEC,
// capped at MAX_HOVER_DRIFT so long shots don't spin too far.
import { PITCH, BEARING, SPIN_DEG_PER_SEC, MAX_HOVER_DRIFT } from './constants.js';

// loc: { lng, lat, zoom, highlight? }
export function build(loc, { duration }) {
  const zoom  = loc.zoom ?? 5;
  const hl    = loc.highlight ? { highlight: loc.highlight } : {};
  const drift = Math.min(MAX_HOVER_DRIFT, duration * SPIN_DEG_PER_SEC);
  return [
    { tOffset: 0,        ...hl, lng: loc.lng, lat: loc.lat, zoom, pitch: PITCH, bearing: BEARING         },
    { tOffset: duration, ...hl, lng: loc.lng, lat: loc.lat, zoom, pitch: PITCH, bearing: BEARING - drift },
  ];
}
