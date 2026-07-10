// pullback — close → globe-level reveal of geographic scope.
import { AMBIENT_ZOOM, PITCH, BEARING } from './constants.js';

// loc: { lng, lat, zoom, highlight? }
export function build(loc, { duration }) {
  const zoom = loc.zoom ?? 5;
  const hl   = loc.highlight ? { highlight: loc.highlight } : {};
  return [
    { tOffset: 0,        ...hl, lng: loc.lng, lat: loc.lat, zoom,           pitch: PITCH, bearing: BEARING },
    { tOffset: duration,        lng: loc.lng, lat: loc.lat, zoom: AMBIENT_ZOOM, pitch: 0, bearing: 0       },
  ];
}
