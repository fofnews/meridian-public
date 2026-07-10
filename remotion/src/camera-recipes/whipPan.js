// whipPan — fast cut between two locations (contrast beats).
// Single-location variant: swings bearing to suggest "looking around."
// Two-location variant: holds at A, whips to B in 0.4 s, holds at B.
import { PITCH, BEARING } from './constants.js';

const SWING_DEG = 30;   // bearing swing for single-loc variant
const FLY_S     = 0.4;  // whip duration in seconds

// locs: [locA] or [locA, locB] where each is { lng, lat, zoom, highlight? }
export function build(locs, { duration }) {
  if (locs.length === 0) return [];

  if (locs.length === 1) {
    const loc  = locs[0];
    const zoom = loc.zoom ?? 5;
    const hl   = loc.highlight ? { highlight: loc.highlight } : {};
    return [
      { tOffset: 0,              ...hl, lng: loc.lng, lat: loc.lat, zoom, pitch: PITCH, bearing: BEARING            },
      { tOffset: duration * 0.4, ...hl, lng: loc.lng, lat: loc.lat, zoom, pitch: PITCH, bearing: BEARING + SWING_DEG },
      { tOffset: duration,       ...hl, lng: loc.lng, lat: loc.lat, zoom, pitch: PITCH, bearing: BEARING            },
    ];
  }

  const [a, b]  = locs;
  const hlA     = a.highlight ? { highlight: a.highlight } : {};
  const hlB     = b.highlight ? { highlight: b.highlight } : {};
  const holdAt0 = Math.max(1, duration * 0.2);
  return [
    { tOffset: 0,              ...hlA, lng: a.lng, lat: a.lat, zoom: a.zoom ?? 5, pitch: PITCH, bearing: BEARING },
    { tOffset: holdAt0,        ...hlA, lng: a.lng, lat: a.lat, zoom: a.zoom ?? 5, pitch: PITCH, bearing: BEARING },
    { tOffset: holdAt0 + FLY_S,...hlB, lng: b.lng, lat: b.lat, zoom: b.zoom ?? 5, pitch: PITCH, bearing: BEARING },
    { tOffset: duration,       ...hlB, lng: b.lng, lat: b.lat, zoom: b.zoom ?? 5, pitch: PITCH, bearing: BEARING },
  ];
}
