// Builds great-circle arc GeoJSON for source-to-story lines (item 9).

import { SOURCE_COORDS } from './sources.js';

const DEG = Math.PI / 180;

// Spherical linear interpolation — generates N+1 evenly-spaced points
// along the great circle between p1 and p2 ([lng, lat] in degrees).
// Consecutive longitudes are kept within 180° of each other so arcs
// that cross the antimeridian render as smooth curves, not jumps.
function greatCircleArc(p1, p2, n = 64) {
  const lng1 = p1[0] * DEG, lat1 = p1[1] * DEG;
  const lng2 = p2[0] * DEG, lat2 = p2[1] * DEG;

  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
  ));

  if (d < 1e-6) return [p1.slice(), p2.slice()];

  const sinD = Math.sin(d);
  const coords = [];

  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / sinD;
    const B = Math.sin(f * d) / sinD;
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    coords.push([
      Math.atan2(y, x) / DEG,
      Math.atan2(z, Math.sqrt(x * x + y * y)) / DEG,
    ]);
  }

  // Unwrap longitude so consecutive points never jump more than 180°
  // (handles antimeridian crossings cleanly on the globe projection).
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1][0];
    let curr = coords[i][0];
    while (curr - prev >  180) curr -= 360;
    while (prev - curr >  180) curr += 360;
    coords[i][0] = curr;
  }

  return coords;
}

// Returns a GeoJSON FeatureCollection of arcs from each known source HQ
// to the story location. Deduplicates sources; skips any without a known
// HQ. storyLoc is { lat, lng }.
export function buildArcsGeoJSON(articles, storyLoc) {
  if (!storyLoc || storyLoc.lat == null || storyLoc.lng == null) {
    return { type: 'FeatureCollection', features: [] };
  }

  const seen = new Set();
  const features = [];
  const dest = [storyLoc.lng, storyLoc.lat];

  for (const article of articles) {
    const name = article.source;
    if (seen.has(name)) continue;
    seen.add(name);

    const hq = SOURCE_COORDS[name];
    if (!hq) continue;

    const coords = greatCircleArc([hq.lng, hq.lat], dest);
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { source: name },
    });
  }

  return { type: 'FeatureCollection', features };
}
