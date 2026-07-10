// orbit — slow bearing sweep around a story location.
// Gives a "satellite pass" feel. Not in the default rule table — available for
// manual override via shot.recipeOverride.
import { PITCH, BEARING } from './constants.js';

// loc: { lng, lat, zoom, highlight? }
// bearingSpan: total degrees swept (negative = clockwise)
export function build(loc, { duration, bearingSpan = 60 }) {
  const zoom = loc.zoom ?? 5;
  const hl   = loc.highlight ? { highlight: loc.highlight } : {};
  const b0   = BEARING;
  const b1   = BEARING - bearingSpan * 0.5;
  const b2   = BEARING - bearingSpan;
  return [
    { tOffset: 0,            ...hl, lng: loc.lng, lat: loc.lat, zoom, pitch: PITCH, bearing: b0 },
    { tOffset: duration / 2, ...hl, lng: loc.lng, lat: loc.lat, zoom, pitch: PITCH, bearing: b1 },
    { tOffset: duration,     ...hl, lng: loc.lng, lat: loc.lat, zoom, pitch: PITCH, bearing: b2 },
  ];
}
