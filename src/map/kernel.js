// Map kernel — single source of truth for creating and configuring a
// Meridian-styled Mapbox map. Both the website map and the video stage
// consume this so they share visual identity.
//
// Mapbox is split into its own chunk (~500KB JS + CSS) via dynamic
// import so it doesn't bloat the main bundle. We kick off the download
// eagerly on module parse so it fetches in parallel with the rest of
// the app's initial render.

import { applyMapStyle } from './layers.js';
import { createPulseMarker } from './marker.js';
import { getMapPadding } from './camera.js';

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

// Eager-load so the bundle starts downloading immediately.
loadMapbox().catch(() => {});

// Create a Meridian-styled map in the given container.
// Returns { map, marker, mapboxgl }. Caller manages lifecycle (cleanup,
// theme switches, fly targets).
//
// Projection (item 0c): globe on all viewports. Tested ad hoc on
// mid-range mobile and accepted as the default — globe is the strongest
// brand signal and the "spinning earth" baseline of the ambient mode
// only reads as broadcast on the sphere. If perf becomes an issue
// later, fall back to mercator below a viewport threshold here without
// changing the rest of the kernel — the map style, layers, and marker
// look the same under either projection.
export async function createMap(container, { isDark, broadcast = false }) {
  const mapboxgl = await loadMapbox();

  const map = new mapboxgl.Map({
    container,
    style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
    projection: 'globe',
    center: [0, 20],
    zoom: 1.0,
    interactive: !broadcast,
    attributionControl: false,
    ...(broadcast && {
      preserveDrawingBuffer: true,
      pixelRatio: Math.min(window.devicePixelRatio * 1.5, 3),
    }),
  });

  map.on('load', () => {
    map.resize();
    map.setPadding(getMapPadding(container));
    applyMapStyle(map, isDark);
  });

  const marker = new mapboxgl.Marker({ element: createPulseMarker(isDark), anchor: 'center' })
    .setLngLat([0, 20])
    .addTo(map);

  return { map, marker, mapboxgl };
}
