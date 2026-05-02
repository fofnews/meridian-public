// Mapbox layer + style customizations applied at runtime on top of the
// base style. Item #2 will replace the per-property patches with a
// committed `meridian.style.json`; the data-driven highlight layers
// (country-highlight, state-boundary) will remain runtime additions.

// Fog values tuned for broadcast look on globe projection.
// Dark: deep space with visible stars and blue atmospheric glow.
// Light: editorial daylight — warm horizon haze, pale sky, no stars.
const FOG = {
  dark: {
    color: 'rgba(14,18,35,0.85)',
    'high-color': 'rgba(22,40,80,0.90)',
    'horizon-blend': 0.04,
    'space-color': '#04050e',
    'star-intensity': 0.12,
  },
  light: {
    color: 'rgba(240,235,222,0.80)',
    'high-color': 'rgba(185,210,230,0.90)',
    'horizon-blend': 0.04,
    'space-color': '#dde8f0',
    'star-intensity': 0.0,
  },
};

export function applyMapStyle(map, isDark) {
  // Atmospheric fog (item 1) — applied first so the globe gets its
  // atmosphere ring before any layer patches. Silently no-ops on
  // mercator or if setFog isn't available.
  try { map.setFog(isDark ? FOG.dark : FOG.light); } catch {}

  // Land color — warm paper in light, dark navy in dark
  try {
    map.setPaintProperty('land', 'background-color', isDark ? '#222534' : '#F5F2ED');
  } catch {}

  if (isDark) {
    // Dark mode preserves base style's labels, restyled for the broadcast look
    try {
      map.setPaintProperty('country-label', 'text-color', '#ffffff');
      map.setPaintProperty('country-label', 'text-halo-color', 'rgba(0,0,0,0.6)');
      map.setPaintProperty('country-label', 'text-halo-width', 1.5);
      map.setLayoutProperty('country-label', 'text-size', 20);
    } catch {}
    try {
      const style = map.getStyle();
      if (style && style.layers) {
        style.layers.forEach(layer => {
          if (layer.id.startsWith('admin-1')) {
            try {
              map.setLayoutProperty(layer.id, 'visibility', 'visible');
              map.setPaintProperty(layer.id, 'line-color', 'rgba(180,190,220,0.2)');
              map.setPaintProperty(layer.id, 'line-width', 0.5);
              map.setLayerZoomRange(layer.id, 3, 24);
            } catch {}
          }
        });
      }
    } catch {}
  } else {
    // Light mode — editorial monochrome: paint water, restyle admin-1 lines as
    // subtle guides, strip road / POI / transit / natural-feature noise, but
    // keep place labels so the map gives orientation context.
    try { map.setPaintProperty('water', 'fill-color', '#DCE5EC'); } catch {}

    try {
      const style = map.getStyle();
      if (style && style.layers) {
        style.layers.forEach((layer) => {
          const id = layer.id;
          if (id.startsWith('admin-1')) {
            try {
              map.setLayoutProperty(id, 'visibility', 'visible');
              map.setPaintProperty(id, 'line-color', 'rgba(10,24,40,0.15)');
              map.setPaintProperty(id, 'line-width', 0.5);
              map.setLayerZoomRange(id, 3, 24);
            } catch {}
            return;
          }
          if (
            id.startsWith('road') ||
            id.startsWith('bridge') ||
            id.startsWith('tunnel') ||
            id.startsWith('ferry') ||
            id.startsWith('poi') ||
            id.startsWith('natural') ||
            id.startsWith('transit') ||
            id === 'waterway-label' ||
            id === 'water-line-label'
          ) {
            try { map.setLayoutProperty(id, 'visibility', 'none'); } catch {}
          }
        });
      }
    } catch {}

    // Tint country labels to match the navy/paper palette
    try {
      map.setPaintProperty('country-label', 'text-color', '#0A1828');
      map.setPaintProperty('country-label', 'text-halo-color', 'rgba(245,242,237,0.85)');
      map.setPaintProperty('country-label', 'text-halo-width', 1.5);
    } catch {}
  }

  // Country borders + glowing highlight (item 3) — re-added after every
  // style change. Highlight = wide blurred glow + narrow sharp edge, both
  // filtered by iso_3166_1. Flat fill is intentionally removed (the line
  // treatment reads better on broadcast video than a tinted fill).
  try {
    if (!map.getSource('country-boundaries')) {
      map.addSource('country-boundaries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1',
      });
    }

    // World borders
    if (!map.getLayer('country-borders')) {
      map.addLayer({
        id: 'country-borders',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: {
          'line-color': isDark ? 'rgba(180,190,220,0.6)' : '#0A1828',
          'line-width': isDark ? 0.8 : 0.5,
          'line-opacity': isDark ? 0.6 : 0.65,
        },
      });
    } else {
      map.setPaintProperty('country-borders', 'line-color', isDark ? 'rgba(180,190,220,0.6)' : '#0A1828');
      map.setPaintProperty('country-borders', 'line-width', isDark ? 0.8 : 0.5);
      map.setPaintProperty('country-borders', 'line-opacity', isDark ? 0.6 : 0.65);
    }

    // Highlight glow — wide, blurred, low-opacity outer ring
    if (!map.getLayer('country-highlight-glow')) {
      map.addLayer({
        id: 'country-highlight-glow',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['==', 'iso_3166_1', ''],
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 10,
          'line-blur': 4,
          'line-opacity': isDark ? 0.35 : 0.28,
        },
      });
    } else {
      map.setPaintProperty('country-highlight-glow', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('country-highlight-glow', 'line-opacity', isDark ? 0.35 : 0.28);
    }

    // Highlight edge — narrow, crisp inner line
    if (!map.getLayer('country-highlight-edge')) {
      map.addLayer({
        id: 'country-highlight-edge',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['==', 'iso_3166_1', ''],
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 1.5,
          'line-opacity': isDark ? 0.90 : 0.80,
        },
      });
    } else {
      map.setPaintProperty('country-highlight-edge', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('country-highlight-edge', 'line-opacity', isDark ? 0.90 : 0.80);
    }
  } catch {}

  // State/region boundary layers (GeoJSON, data-driven) — same glow+edge
  // treatment as the country highlight, used when a story targets a
  // sub-national region (e.g. a US state).
  try {
    if (!map.getSource('state-boundary')) {
      map.addSource('state-boundary', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!map.getLayer('state-highlight-glow')) {
      map.addLayer({
        id: 'state-highlight-glow',
        type: 'line',
        source: 'state-boundary',
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 10,
          'line-blur': 4,
          'line-opacity': isDark ? 0.35 : 0.28,
        },
      });
    } else {
      map.setPaintProperty('state-highlight-glow', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('state-highlight-glow', 'line-opacity', isDark ? 0.35 : 0.28);
    }
    if (!map.getLayer('state-highlight-edge')) {
      map.addLayer({
        id: 'state-highlight-edge',
        type: 'line',
        source: 'state-boundary',
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 1.5,
          'line-opacity': isDark ? 0.90 : 0.80,
        },
      });
    } else {
      map.setPaintProperty('state-highlight-edge', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('state-highlight-edge', 'line-opacity', isDark ? 0.90 : 0.80);
    }
  } catch {}
}
