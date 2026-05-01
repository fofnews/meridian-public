// Layer management — applies Meridian's visual theme to a Mapbox map instance.
// Called on initial load and whenever the dark/light theme changes.

export function applyTheme(map, isDark) {
  try {
    map.setPaintProperty('land', 'background-color', isDark ? '#222534' : '#F5F2ED');
  } catch {}

  if (isDark) {
    try {
      map.setPaintProperty('country-label', 'text-color', '#ffffff');
      map.setPaintProperty('country-label', 'text-halo-color', 'rgba(0,0,0,0.6)');
      map.setPaintProperty('country-label', 'text-halo-width', 1.5);
      map.setLayoutProperty('country-label', 'text-size', 20);
    } catch {}
    try {
      const style = map.getStyle();
      if (style?.layers) {
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
    try { map.setPaintProperty('water', 'fill-color', '#DCE5EC'); } catch {}
    try {
      const style = map.getStyle();
      if (style?.layers) {
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
            id.startsWith('road') || id.startsWith('bridge') ||
            id.startsWith('tunnel') || id.startsWith('ferry') ||
            id.startsWith('poi') || id.startsWith('natural') ||
            id.startsWith('transit') ||
            id === 'waterway-label' || id === 'water-line-label'
          ) {
            try { map.setLayoutProperty(id, 'visibility', 'none'); } catch {}
          }
        });
      }
    } catch {}
    try {
      map.setPaintProperty('country-label', 'text-color', '#0A1828');
      map.setPaintProperty('country-label', 'text-halo-color', 'rgba(245,242,237,0.85)');
      map.setPaintProperty('country-label', 'text-halo-width', 1.5);
    } catch {}
  }

  addHighlightLayers(map, isDark);
}

export function addHighlightLayers(map, isDark) {
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
