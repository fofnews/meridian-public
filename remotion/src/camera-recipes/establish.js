// establish — wide globe → dive to story location.
// Creates a "spotting this story on the globe" arrival shot.
// First waypoint is globe-level (no highlight active), second is landed at story zoom.
import { AMBIENT_ZOOM, PITCH, BEARING } from './constants.js';

// loc: { lng, lat, zoom, highlight? }
export function build(loc, { duration }) {
  const zoom = loc.zoom ?? 5;
  const hl = loc.highlight ? { highlight: loc.highlight } : {};
  return [
    { tOffset: 0,        lng: loc.lng, lat: loc.lat, zoom: AMBIENT_ZOOM, pitch: 0,     bearing: 0       },
    { tOffset: duration, lng: loc.lng, lat: loc.lat, zoom,               pitch: PITCH, bearing: BEARING, ...hl },
  ];
}
