// pushIn — close hold + push in tighter.
// Creates urgency/pressure. Pairs with ripple-expand overlay.
import { PITCH, BEARING } from './constants.js';

const ZOOM_DELTA  = 1.5;
const PITCH_DELTA = 15;

// loc: { lng, lat, zoom, highlight? }
export function build(loc, { duration }) {
  const zoom = loc.zoom ?? 5;
  const hl   = loc.highlight ? { highlight: loc.highlight } : {};
  return [
    { tOffset: 0,        ...hl, lng: loc.lng, lat: loc.lat, zoom: Math.max(1,  zoom - ZOOM_DELTA), pitch: PITCH,              bearing: BEARING },
    { tOffset: duration, ...hl, lng: loc.lng, lat: loc.lat, zoom: Math.min(22, zoom + ZOOM_DELTA), pitch: Math.min(75, PITCH + PITCH_DELTA), bearing: BEARING },
  ];
}
