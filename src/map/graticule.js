// Pre-computed graticule GeoJSON — lat/lon gridlines at 15° intervals.
// Built once at module parse time and reused for every map instance.
//
// Meridians span -80° → 80° lat (avoiding singularity at the poles).
// Parallels span -180° → 180° lng with a point every 10° so Mapbox
// renders the small circles as smooth curves on the globe projection.

const STEP = 15;

function buildGraticule() {
  const features = [];

  for (let lng = -180; lng < 180; lng += STEP) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[lng, -80], [lng, 0], [lng, 80]] },
      properties: {},
    });
  }

  for (let lat = -75; lat <= 75; lat += STEP) {
    const coords = [];
    for (let lng = -180; lng <= 180; lng += 10) coords.push([lng, lat]);
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    });
  }

  return { type: 'FeatureCollection', features };
}

export const GRATICULE_GEOJSON = buildGraticule();
