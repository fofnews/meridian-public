// Mapbox layer + style customizations applied at runtime on top of the
// base style. Item #2 will replace the per-property patches with a
// committed `meridian.style.json`; the data-driven highlight layers
// (country-highlight, state-boundary) will remain runtime additions.

export function applyMapStyle(map, isDark) {
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

  // Atmospheric fog — gives the globe a horizon and space backdrop (item #1).
  // Runs on every style change so theme switches re-apply the right palette.
  try {
    if (isDark) {
      map.setFog({
        color: '#0a1828',          // near-horizon haze (matches dark land)
        'high-color': '#1a2a4a',   // upper atmosphere — cool blue
        'horizon-blend': 0.04,     // narrow band — crisp edge reads well on video
        'space-color': '#000814',  // deep space
        'star-intensity': 0.6,
      });
    } else {
      map.setFog({
        color: '#c8ddf0',          // hazy daylight atmosphere at horizon
        'high-color': '#a0c4e0',   // upper sky
        'horizon-blend': 0.06,
        'space-color': '#7aafc8',  // clear sky — distinct from pale land (#f5f2ed)
        'star-intensity': 0,
      });
    }
  } catch {}

  // Country highlight + border layers (re-added after every style change)
  try {
    if (!map.getSource('country-boundaries')) {
      map.addSource('country-boundaries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1',
      });
    }
    if (!map.getLayer('country-highlight')) {
      map.addLayer({
        id: 'country-highlight',
        type: 'fill',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['==', 'iso_3166_1', ''],
        paint: {
          'fill-color': isDark ? '#e8c547' : '#9A7200',
          'fill-opacity': isDark ? 0.18 : 0.13,
        },
      });
    } else {
      map.setPaintProperty('country-highlight', 'fill-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('country-highlight', 'fill-opacity', isDark ? 0.18 : 0.13);
    }
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
    if (!map.getSource('state-boundary')) {
      map.addSource('state-boundary', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!map.getLayer('state-highlight')) {
      map.addLayer({
        id: 'state-highlight',
        type: 'fill',
        source: 'state-boundary',
        paint: {
          'fill-color': isDark ? '#e8c547' : '#9A7200',
          'fill-opacity': isDark ? 0.18 : 0.13,
        },
      });
    } else {
      map.setPaintProperty('state-highlight', 'fill-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('state-highlight', 'fill-opacity', isDark ? 0.18 : 0.13);
    }
    if (!map.getLayer('state-border')) {
      map.addLayer({
        id: 'state-border',
        type: 'line',
        source: 'state-boundary',
        paint: {
          'line-color': isDark ? 'rgba(232,197,71,0.7)' : '#9A7200',
          'line-width': 1,
          'line-opacity': isDark ? 0.7 : 0.65,
        },
      });
    } else {
      map.setPaintProperty('state-border', 'line-color', isDark ? 'rgba(232,197,71,0.7)' : '#9A7200');
      map.setPaintProperty('state-border', 'line-width', 1);
      map.setPaintProperty('state-border', 'line-opacity', isDark ? 0.7 : 0.65);
    }
  } catch {}
}
