// Camera helpers shared between the website map and the video stage.
// Pitch / bearing / fly duration policies diverge per surface — the
// constants here cover the website ("ambient mode" + focused at 30°
// pitch); the video stage in BroadcastStage.jsx will use its own
// (45–60° pitch, longer durations, scripted bearing).

const STORY_ZOOM_DESKTOP = 5;
const STORY_ZOOM_MOBILE  = 4;

// Website ambient-mode policy (items 0b + 0c).
// Rotation rate is intentionally slow — anything > ~1°/sec reads as
// motion sickness rather than ambient life. The idle timeout is the
// "show's over, drift back to the globe" fallback for visitors who
// stop interacting.
//
// Rotation is applied to center.longitude (not bearing). On the globe
// projection this gives the classic west-to-east "earth spinning on
// its axis" look; bearing rotation would spin the sphere around the
// screen-perpendicular axis instead, which reads as tilted/wrong.
// Works fine on mercator too — it just scrolls the map sideways.
export const AMBIENT_LONGITUDE_DEG_PER_SEC = 0.5;
export const AMBIENT_IDLE_TIMEOUT_MS = 30_000;
export const AMBIENT_RETURN_DURATION_MS = 3_000;
export const AMBIENT_CENTER = [0, 20];
export const AMBIENT_ZOOM = 1.0;
export const AMBIENT_PITCH = 0;

// Pitch applied when a story is focused on the website. The video
// stage will use a more dramatic 45–60° (item #4).
export const FOCUSED_PITCH_WEBSITE = 30;
export const FOCUSED_FLY_DURATION_MS = 2_000;

export function getStoryZoom() {
  return window.innerWidth < 640 ? STORY_ZOOM_MOBILE : STORY_ZOOM_DESKTOP;
}

export function getMapPadding(containerEl) {
  const w = containerEl?.offsetWidth ?? window.innerWidth;
  if (w < 640) return { top: 20, bottom: 80, left: 0, right: 0 };
  if (w < 900) return { top: 30, bottom: 100, left: 0, right: 100 };
  return { top: 40, bottom: 110, left: 0, right: 160 };
}

// Helper: set the iso filter on both country highlight line layers (item 3).
function setCountryFilter(map, iso) {
  const filter = ['==', 'iso_3166_1', iso];
  ['country-highlight-glow', 'country-highlight-edge'].forEach(id => {
    if (map.getLayer(id)) map.setFilter(id, filter);
  });
}

// Fly to a location, update the marker, and refresh country highlight +
// state-boundary layers. If the map hasn't finished loading yet, queues
// the move until the load event fires.
//
// Caller is responsible for tracking the polygon if it needs to be
// re-applied after a style change (theme switch).
export function flyToLocation(map, marker, loc, { pitch = 0, duration = FOCUSED_FLY_DURATION_MS } = {}) {
  if (!map) return;
  const go = () => {
    map.flyTo({
      center: [loc.lng, loc.lat],
      zoom: loc.zoom ?? getStoryZoom(),
      pitch,
      duration,
      essential: true,
    });
    if (marker) {
      marker.getElement().style.display = '';
      marker.setLngLat([loc.lng, loc.lat]);
    }
    setCountryFilter(map, loc.iso ?? '');
    if (map.getSource('state-boundary')) {
      map.getSource('state-boundary').setData(
        loc.polygon ?? { type: 'FeatureCollection', features: [] }
      );
    }
  };
  if (map.loaded()) go(); else map.once('load', go);
}

// Fly back to the wide globe view and clear the focused-state visuals
// (country highlight, state polygon, pulse marker). Used by the
// website's idle return.
export function returnToAmbient(map, marker) {
  if (!map) return;
  const go = () => {
    map.flyTo({
      center: AMBIENT_CENTER,
      zoom: AMBIENT_ZOOM,
      pitch: AMBIENT_PITCH,
      duration: AMBIENT_RETURN_DURATION_MS,
      essential: true,
    });
    if (marker) {
      marker.getElement().style.display = 'none';
    }
    setCountryFilter(map, '');
    if (map.getSource('state-boundary')) {
      map.getSource('state-boundary').setData({ type: 'FeatureCollection', features: [] });
    }
  };
  if (map.loaded()) go(); else map.once('load', go);
}

// Slow bearing rotation for ambient mode. Returns a controller:
//   setActive(bool) — pause/resume (use false while a story is focused
//                      so rotation doesn't fight the static framing)
//   stop()          — permanently stop, cancel rAF (call on unmount)
// Automatically pauses when document.hidden is true (backgrounded tab).
export function startAmbientRotation(map) {
  let raf = null;
  let lastT = performance.now();
  let active = true;
  let stopped = false;

  const tick = (now) => {
    if (stopped) return;
    if (active && !document.hidden && map && !map._removed) {
      // Cap dt so a long-paused tab doesn't fling the longitude on resume.
      const dt = Math.min((now - lastT) / 1000, 0.1);
      const cur = map.getCenter();
      let nextLng = cur.lng + AMBIENT_LONGITUDE_DEG_PER_SEC * dt;
      // Normalize to [-180, 180] so the value doesn't grow without bound.
      if (nextLng > 180) nextLng -= 360;
      else if (nextLng < -180) nextLng += 360;
      map.setCenter([nextLng, cur.lat]);
    }
    lastT = now;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    setActive(v) {
      active = v;
      // Reset clock so we don't accumulate dt while paused.
      lastT = performance.now();
    },
    stop() {
      stopped = true;
      if (raf != null) cancelAnimationFrame(raf);
    },
  };
}
