// Shared map kernel — creates the Mapbox Map instance used by both the
// website surface (MapHero) and the video surface (BroadcastStage).
// Only construction-time options live here; visual theming is in layers.js.

let mapboxPromise = null;

export function loadMapbox() {
  if (!mapboxPromise) {
    mapboxPromise = Promise.all([
      import('mapbox-gl'),
      import('mapbox-gl/dist/mapbox-gl.css'),
    ]).then(([mod]) => {
      const mapboxgl = mod.default;
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
      return mapboxgl;
    });
  }
  return mapboxPromise;
}

// Kick off the download eagerly so it fetches in parallel with app boot.
loadMapbox().catch(() => {});

function getProjection() {
  // Globe projection requires extra WebGL work during rotation;
  // fall back to mercator on narrow viewports where GPU headroom is limited.
  // Threshold: 600px covers most phones in portrait. Adjust if perf testing
  // on mid-range Android (Pixel 6a class) shows unacceptable jitter below ~500px.
  return window.innerWidth < 600 ? 'mercator' : 'globe';
}

/**
 * createMap(container, { isDark, onLoad })
 *
 * Creates and returns a Mapbox Map. Calls onLoad(map, mapboxgl) once the
 * map's 'load' event fires. Returns { map, mapboxgl } synchronously after
 * the Map constructor runs (map is not yet loaded at that point).
 *
 * The caller is responsible for calling map.remove() on cleanup.
 */
export async function createMap(container, { isDark, onLoad } = {}) {
  const mapboxgl = await loadMapbox();

  const map = new mapboxgl.Map({
    container,
    style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
    projection: getProjection(),
    center: [0, 20],
    zoom: 1.0,
    interactive: true,
    attributionControl: false,
  });

  map.on('load', () => {
    onLoad?.(map, mapboxgl);
  });

  return { map, mapboxgl };
}
