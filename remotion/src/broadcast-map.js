// Broadcast-only Mapbox helpers — wraps the shared src/map/ kernel without
// modifying it. All add/cleanup functions return a no-op cleanup by default
// so callers can always call the returned function safely.

// ── Choropleth fill ────────────────────────────────────────────────────────────

// Adds (or updates) a broadcast-only fill layer on the country-boundaries
// vector source. The fill-opacity encodes coverage ratio so more-covered
// countries render darker. Returns a cleanup that clears the filter.
//
// isoCode  — two-letter ISO 3166-1 code (e.g. 'US', 'FR'). Pass '' to clear.
// ratio    — 0..1, proportion of known outlets covering this story.
export function applyBroadcastChoropleth({ map, isoCode, ratio }) {
  if (!map) return () => {};
  const opacity = isoCode ? 0.08 + Math.max(0, Math.min(1, ratio ?? 0)) * 0.30 : 0;
  const filter  = isoCode ? ['==', 'iso_3166_1', isoCode] : ['==', 'iso_3166_1', ''];
  try {
    if (!map.getLayer('broadcast-choropleth-fill')) {
      map.addLayer({
        id: 'broadcast-choropleth-fill',
        type: 'fill',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter,
        paint: { 'fill-color': '#e8c547', 'fill-opacity': opacity },
      });
    } else {
      map.setFilter('broadcast-choropleth-fill', filter);
      map.setPaintProperty('broadcast-choropleth-fill', 'fill-opacity', opacity);
    }
  } catch {}
  return () => {
    try {
      if (map.getLayer('broadcast-choropleth-fill')) {
        map.setFilter('broadcast-choropleth-fill', ['==', 'iso_3166_1', '']);
        map.setPaintProperty('broadcast-choropleth-fill', 'fill-opacity', 0);
      }
    } catch {}
  };
}

// ── Heatmap layer ─────────────────────────────────────────────────────────────

// Adds (or replaces data in) a broadcast-only heatmap layer driven by an
// array of [lng, lat] points. Returns a cleanup that removes the layer+source.
//
// points — [[lng, lat], ...]
export function addBroadcastHeatmap({ map, points }) {
  if (!map || !points?.length) return () => {};
  const data = {
    type: 'FeatureCollection',
    features: points.map(([lng, lat]) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {},
    })),
  };
  try {
    if (!map.getSource('broadcast-heatmap-src')) {
      map.addSource('broadcast-heatmap-src', { type: 'geojson', data });
    } else {
      map.getSource('broadcast-heatmap-src').setData(data);
    }
    if (!map.getLayer('broadcast-heatmap-layer')) {
      map.addLayer({
        id: 'broadcast-heatmap-layer',
        type: 'heatmap',
        source: 'broadcast-heatmap-src',
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 4, 1.2],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(0,0,0,0)',
            0.2, 'rgba(232,197,71,0.15)',
            0.5, 'rgba(232,197,71,0.45)',
            1.0, 'rgba(232,197,71,0.85)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 30, 4, 50],
          'heatmap-opacity': 0.70,
        },
      });
    }
  } catch {}
  return () => {
    try {
      if (map.getLayer('broadcast-heatmap-layer')) map.removeLayer('broadcast-heatmap-layer');
    } catch {}
    try {
      if (map.getSource('broadcast-heatmap-src')) map.removeSource('broadcast-heatmap-src');
    } catch {}
  };
}

// ── Arc token position ────────────────────────────────────────────────────────

// Given a GeoJSON Feature (LineString) and a normalized t in [0,1], returns
// the [lng, lat] at that fractional position along the arc by linear
// interpolation between the nearest pre-sampled coordinate pair.
// Used by ArcTokens to drive animated dots without calling map.project().
export function arcTokenPosition(arc, t) {
  const coords = arc?.geometry?.coordinates;
  if (!coords || coords.length < 2) return [0, 0];
  const clamped = Math.max(0, Math.min(1, t));
  const raw = clamped * (coords.length - 1);
  const lo  = Math.floor(raw);
  const hi  = Math.min(lo + 1, coords.length - 1);
  if (lo === hi) return coords[lo].slice(0, 2);
  const f = raw - lo;
  return [
    coords[lo][0] + f * (coords[hi][0] - coords[lo][0]),
    coords[lo][1] + f * (coords[hi][1] - coords[lo][1]),
  ];
}
