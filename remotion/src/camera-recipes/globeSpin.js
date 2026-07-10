// globeSpin — globe-level bearing drift for intro/outro shots.
// Replaces globeSpinPath() from scripts/build-shotlist.js.
import { AMBIENT_ZOOM, AMBIENT_LAT, AMBIENT_LNG, SPIN_DEG_PER_SEC } from './constants.js';

// bearing0: starting bearing (default 0)
export function build({ duration, bearing0 = 0 }) {
  return [
    { tOffset: 0,        lng: AMBIENT_LNG, lat: AMBIENT_LAT, zoom: AMBIENT_ZOOM, pitch: 0, bearing: bearing0 },
    { tOffset: duration, lng: AMBIENT_LNG, lat: AMBIENT_LAT, zoom: AMBIENT_ZOOM, pitch: 0, bearing: bearing0 - duration * SPIN_DEG_PER_SEC },
  ];
}
