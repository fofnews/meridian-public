// Pure camera interpolation — no side effects.
// Given a shotlist and the current playback time t (seconds),
// returns the Mapbox camera state { lng, lat, zoom, pitch, bearing }.
//
// Each shot may have a cameraPath: [{tOffset, lng, lat, zoom, pitch, bearing}, ...]
// array of waypoints. The camera walks the path during the shot, then eases
// to the next shot's first waypoint over FLY_DURATION_S at the shot boundary.
//
// Legacy shots (no cameraPath, only camera) are treated as a single static
// waypoint — same behavior as before, so old shotlists remain compatible.

const FLY_DURATION_S = 0.8;

function easeInOut(t) {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerpCamera(a, b, progress) {
  const e = easeInOut(Math.max(0, Math.min(1, progress)));
  return {
    lng:     a.lng     + (b.lng     - a.lng)     * e,
    lat:     a.lat     + (b.lat     - a.lat)     * e,
    zoom:    a.zoom    + (b.zoom    - a.zoom)    * e,
    pitch:   a.pitch   + (b.pitch   - a.pitch)   * e,
    bearing: a.bearing + (b.bearing - a.bearing) * e,
  };
}

// Return the camera position at a given tInShot offset within a shot.
function evalCameraPath(shot, tInShot) {
  const path = shot.cameraPath;
  if (!path || path.length === 0) {
    // Legacy: bare camera object
    return { ...shot.camera };
  }
  if (path.length === 1) return { ...path[0] };

  if (tInShot <= 0) return { ...path[0] };
  if (tInShot >= path[path.length - 1].tOffset) return { ...path[path.length - 1] };

  for (let j = path.length - 2; j >= 0; j--) {
    if (tInShot >= path[j].tOffset) {
      const segDur = path[j + 1].tOffset - path[j].tOffset;
      const progress = segDur > 0 ? (tInShot - path[j].tOffset) / segDur : 1;
      return lerpCamera(path[j], path[j + 1], progress);
    }
  }
  return { ...path[0] };
}

// Return the camera state at the beginning of a shot (tInShot = 0).
function firstWaypoint(shot) {
  if (shot.cameraPath && shot.cameraPath.length > 0) return { ...shot.cameraPath[0] };
  return { ...shot.camera };
}

/**
 * Returns the interpolated Mapbox camera state at time t.
 *
 * Camera motion model:
 *   - Within a shot: camera walks the shot's cameraPath waypoints.
 *   - At shot boundaries: 2-second ease-in-out fly from end of previous shot
 *     to first waypoint of next shot (occupies the first 2 s of the new shot).
 *
 * @param {Array}  shots    - shotlist.shots array
 * @param {number} t        - current time in seconds (includes pre-roll)
 * @param {number} preRollS - pre-roll duration in seconds (default 1)
 */
export function interpolateCameraOnPath(shots, t, preRollS = 1) {
  if (!shots || shots.length === 0) return { lng: 0, lat: 20, zoom: 1.5, pitch: 0, bearing: 0 };
  if (t <= shots[0].t + preRollS) return firstWaypoint(shots[0]);

  for (let i = shots.length - 1; i >= 0; i--) {
    const shotStart = shots[i].t + preRollS;
    if (t >= shotStart) {
      const tInShot = t - shotStart;
      const prev = shots[i - 1];

      // Incoming cross-shot fly: ease from end of previous shot into this shot's first waypoint.
      if (prev && tInShot < FLY_DURATION_S) {
        const fromCam = evalCameraPath(prev, prev.hold);
        const toCam   = firstWaypoint(shots[i]);
        return lerpCamera(fromCam, toCam, tInShot / FLY_DURATION_S);
      }

      return evalCameraPath(shots[i], tInShot);
    }
  }
  return firstWaypoint(shots[0]);
}

// Legacy alias — kept for any external callers referencing the old name.
export const interpolateCamera = interpolateCameraOnPath;

/**
 * Returns the discrete lat/lng the camera is currently "at" — the most recent
 * waypoint reached in the active shot's cameraPath. Used to position the
 * story-location marker (snaps to waypoints rather than interpolating, so the
 * marker sits on the named place rather than mid-flight).
 *
 * Returns null for special/placeholder locations (iso=XX or near the origin).
 *
 * @param {Array}  shots    - shotlist.shots array
 * @param {number} t        - current time in seconds (includes pre-roll)
 * @param {number} preRollS - pre-roll duration in seconds (default 1)
 * @returns {{ lng: number, lat: number } | null}
 */
export function getActiveLocation(shots, t, preRollS = 1) {
  if (!shots || shots.length === 0) return null;

  // Find the active shot.
  let activeShot = shots[0];
  for (const shot of shots) {
    if (shot.t + preRollS <= t) activeShot = shot;
  }

  const tInShot = t - (activeShot.t + preRollS);

  let wp = null;
  if (activeShot.cameraPath && activeShot.cameraPath.length > 0) {
    // Largest tOffset that has been reached.
    wp = activeShot.cameraPath[0];
    for (const waypoint of activeShot.cameraPath) {
      if (waypoint.tOffset <= Math.max(0, tInShot)) wp = waypoint;
    }
  } else if (activeShot.camera) {
    wp = activeShot.camera;
  }

  if (!wp) return null;

  // Suppress marker for non-Earth / placeholder positions and globe-level shots.
  if (Math.abs(wp.lat) < 0.5 && Math.abs(wp.lng) < 0.5) return null;
  if ((wp.zoom ?? 5) <= 2) return null;

  return { lng: wp.lng, lat: wp.lat };
}
