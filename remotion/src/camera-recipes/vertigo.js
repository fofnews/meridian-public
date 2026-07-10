// vertigo — dolly-zoom: zoom and pitch move in opposite directions.
// direction 'in': zoom out + pitch up → subject feels smaller/more exposed.
// direction 'out': zoom in + pitch down → subject feels closer/more oppressive.
// Not in the default rule table — manual override for major escalation moments.
import { PITCH, BEARING } from './constants.js';

const ZOOM_DELTA  = 2;
const PITCH_DELTA = 20;

// loc: { lng, lat, zoom, highlight? }
export function build(loc, { duration, direction = 'in' }) {
  const zoom = loc.zoom ?? 5;
  const hl   = loc.highlight ? { highlight: loc.highlight } : {};
  const [z0, z1] = direction === 'in'
    ? [zoom, Math.max(1, zoom - ZOOM_DELTA)]
    : [Math.max(1, zoom - ZOOM_DELTA), zoom];
  const [p0, p1] = direction === 'in'
    ? [PITCH, Math.min(75, PITCH + PITCH_DELTA)]
    : [Math.min(75, PITCH + PITCH_DELTA), PITCH];
  return [
    { tOffset: 0,            ...hl, lng: loc.lng, lat: loc.lat, zoom: z0,               pitch: p0,               bearing: BEARING },
    { tOffset: duration / 2, ...hl, lng: loc.lng, lat: loc.lat, zoom: (z0 + z1) / 2,    pitch: (p0 + p1) / 2,    bearing: BEARING },
    { tOffset: duration,     ...hl, lng: loc.lng, lat: loc.lat, zoom: z1,               pitch: p1,               bearing: BEARING },
  ];
}
