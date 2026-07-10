// sweepBetween — multi-location tour: visit each location with a hold+fly pattern.
// Replaces buildCameraPath() from scripts/build-shotlist.js.
// locs: array of { lng, lat, zoom, pitch?, bearing?, highlight? }
// pitch and bearing default to broadcast constants if omitted.

import { PITCH, BEARING } from './constants.js';

const DEFAULT_FLY_BETWEEN_S = 2.5;
const MIN_HOLD_PER_LOC      = 2;

function normLoc(loc) {
  return {
    pitch:   PITCH,
    bearing: BEARING,
    ...loc,
  };
}

export function build(locs, { duration, flyBetweenS = DEFAULT_FLY_BETWEEN_S }) {
  if (locs.length === 0) return [];
  if (locs.length === 1) {
    const loc = normLoc(locs[0]);
    return [
      { tOffset: 0,        ...loc },
      { tOffset: duration, ...loc },
    ];
  }

  const N            = locs.length;
  const totalFlyTime = (N - 1) * flyBetweenS;
  const holdPerLoc   = Math.max(MIN_HOLD_PER_LOC, (duration - totalFlyTime) / N);

  const waypoints = [];
  let t = 0;

  for (let i = 0; i < N; i++) {
    const loc = normLoc(locs[i]);
    // Arrival at this location.
    waypoints.push({ tOffset: round1(t), ...loc });
    t += holdPerLoc;
    if (i < N - 1) {
      // Hold waypoint — marks start of the outgoing fly transition.
      waypoints.push({ tOffset: round1(t), ...loc });
      t += flyBetweenS;
    }
  }

  // Explicit terminal so last tOffset === duration.
  const last = normLoc(locs[N - 1]);
  if (waypoints[waypoints.length - 1].tOffset !== duration) {
    waypoints.push({ tOffset: duration, ...last });
  }

  return waypoints;
}

function round1(n) { return Math.round(n * 10) / 10; }
