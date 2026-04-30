// Camera helpers shared between the website map and the video stage.
// Pitch / bearing / fly duration policies will diverge per surface in
// future items; for now this matches the original BroadcastHero behavior.

const STORY_ZOOM_DESKTOP = 5;
const STORY_ZOOM_MOBILE  = 4;

export function getStoryZoom() {
  return window.innerWidth < 640 ? STORY_ZOOM_MOBILE : STORY_ZOOM_DESKTOP;
}

export function getMapPadding(containerEl) {
  const w = containerEl?.offsetWidth ?? window.innerWidth;
  if (w < 640) return { top: 20, bottom: 80, left: 0, right: 0 };
  if (w < 900) return { top: 30, bottom: 100, left: 0, right: 100 };
  return { top: 40, bottom: 110, left: 0, right: 160 };
}

// Fly to a location, update the marker, and refresh country-highlight +
// state-boundary layers. If the map hasn't finished loading yet, queues
// the move until the load event fires.
//
// Caller is responsible for tracking the polygon if it needs to be
// re-applied after a style change (theme switch).
export function flyToLocation(map, marker, loc) {
  if (!map) return;
  const go = () => {
    map.flyTo({
      center: [loc.lng, loc.lat],
      zoom: loc.zoom ?? getStoryZoom(),
      duration: 2000,
      essential: true,
    });
    marker?.setLngLat([loc.lng, loc.lat]);
    if (map.getLayer('country-highlight')) {
      map.setFilter('country-highlight', ['==', 'iso_3166_1', loc.iso ?? '']);
    }
    if (map.getSource('state-boundary')) {
      map.getSource('state-boundary').setData(
        loc.polygon ?? { type: 'FeatureCollection', features: [] }
      );
    }
  };
  if (map.loaded()) go(); else map.once('load', go);
}
