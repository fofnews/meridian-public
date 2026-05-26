// Pure camera interpolation — no side effects.
// Given a shotlist and the current playback time t (seconds),
// returns the Mapbox camera state { lng, lat, zoom, pitch, bearing }
// using cubic-in-out easing for the fly between shots.

const FLY_DURATION_S = 2;

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

function shotCamera(shot) {
  return { ...shot.camera };
}

/**
 * Returns the interpolated Mapbox camera state at time t.
 * @param {Array} shots  - shotlist.shots array
 * @param {number} t     - current time in seconds (includes pre-roll)
 * @param {number} preRollS - pre-roll duration in seconds (default 1)
 */
export function interpolateCamera(shots, t, preRollS = 1) {
  if (!shots || shots.length === 0) return { lng: 0, lat: 20, zoom: 1.5, pitch: 0, bearing: 0 };

  // Before the first shot: hold its camera.
  if (t <= shots[0].t + preRollS) return shotCamera(shots[0]);

  for (let i = shots.length - 1; i >= 0; i--) {
    const shotStart = shots[i].t + preRollS;
    if (t >= shotStart) {
      const next = shots[i + 1];
      if (!next) return shotCamera(shots[i]);  // last shot: hold
      const progress = (t - shotStart) / FLY_DURATION_S;
      return lerpCamera(shotCamera(shots[i]), shotCamera(next), progress);
    }
  }
  return shotCamera(shots[0]);
}
