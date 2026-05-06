// Mapbox layer + style customizations applied at runtime.
// Static visual properties (land/water color, label styling, admin borders,
// road/POI removal, country-borders) are baked into the Meridian style files
// (public/meridian-dark.style.json, public/meridian-light.style.json).
// This module adds only fog and data-driven layers (highlights, state bounds,
// arcs, graticule, night overlay).

import { GRATICULE_GEOJSON } from './graticule.js';
import { computeNightPolygon } from './terminator.js';
import { buildArcsGeoJSON } from './arcs.js';

// 3-tier highlight palette (item 10). Mapbox GL paint properties don't
// accept CSS custom properties, so hex values are duplicated here.
// CSS vars (--accent-active/secondary/trail) are defined in index.css
// for use in React UI elements.
const PALETTE = {
  dark: {
    active:    '#e8c547',  // gold
    secondary: '#7ab8d8',  // cool pale blue
    trail:     '#8a7840',  // muted gray-gold
  },
  light: {
    active:    '#9A7200',  // brass gold
    secondary: '#1a6090',  // steel blue
    trail:     '#6b5420',  // muted dark gold
  },
};

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
  // Fog — kept in code (not in the style file) for easy value tuning.
  try { map.setFog(isDark ? FOG.dark : FOG.light); } catch {}

  // Night-side terminator overlay (item 8) — low-opacity dark fill over
  // the hemisphere where the sun is below the horizon. Seeded with the
  // current time here; useMeridianMap refreshes it every 60 s.
  try {
    const nightBefore = map.getLayer('country-label') ? 'country-label' : undefined;
    const nightData = computeNightPolygon();
    if (!map.getSource('night-overlay')) {
      map.addSource('night-overlay', { type: 'geojson', data: nightData });
    } else {
      map.getSource('night-overlay').setData(nightData);
    }
    if (!map.getLayer('night-overlay')) {
      map.addLayer({
        id: 'night-overlay',
        type: 'fill',
        source: 'night-overlay',
        paint: {
          'fill-color': '#04081a',
          'fill-opacity': isDark ? 0.38 : 0.30,
        },
      }, nightBefore);
    } else {
      map.setPaintProperty('night-overlay', 'fill-opacity', isDark ? 0.38 : 0.30);
    }
  } catch {}

  // Graticule (item 6) — lat/lon gridlines at 15° intervals.
  try {
    const graticuleBefore = map.getLayer('country-label') ? 'country-label' : undefined;
    if (!map.getSource('graticule')) {
      map.addSource('graticule', { type: 'geojson', data: GRATICULE_GEOJSON });
    }
    if (!map.getLayer('graticule')) {
      map.addLayer({
        id: 'graticule',
        type: 'line',
        source: 'graticule',
        paint: {
          'line-color': isDark ? 'rgba(200,215,240,0.13)' : 'rgba(10,24,40,0.08)',
          'line-width': 0.5,
        },
      }, graticuleBefore);
    } else {
      map.setPaintProperty('graticule', 'line-color', isDark ? 'rgba(200,215,240,0.13)' : 'rgba(10,24,40,0.08)');
    }
  } catch {}

  // Country highlight layers (item 3 + item 10) — data-driven, filtered by iso_3166_1.
  // country-boundaries source is provided by the Meridian style; no addSource needed.
  try {
    const pal = PALETTE[isDark ? 'dark' : 'light'];

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

    if (!map.getLayer('country-highlight-secondary-glow')) {
      map.addLayer({
        id: 'country-highlight-secondary-glow',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['in', 'iso_3166_1', ''],
        paint: {
          'line-color': pal.secondary,
          'line-width': 8,
          'line-blur': 4,
          'line-opacity': isDark ? 0.28 : 0.22,
        },
      });
    } else {
      map.setPaintProperty('country-highlight-secondary-glow', 'line-color', pal.secondary);
      map.setPaintProperty('country-highlight-secondary-glow', 'line-opacity', isDark ? 0.28 : 0.22);
    }

    if (!map.getLayer('country-highlight-secondary-edge')) {
      map.addLayer({
        id: 'country-highlight-secondary-edge',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['in', 'iso_3166_1', ''],
        paint: {
          'line-color': pal.secondary,
          'line-width': 1.2,
          'line-opacity': isDark ? 0.65 : 0.55,
        },
      });
    } else {
      map.setPaintProperty('country-highlight-secondary-edge', 'line-color', pal.secondary);
      map.setPaintProperty('country-highlight-secondary-edge', 'line-opacity', isDark ? 0.65 : 0.55);
    }

    if (!map.getLayer('country-highlight-trail-glow')) {
      map.addLayer({
        id: 'country-highlight-trail-glow',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['==', 'iso_3166_1', ''],
        paint: {
          'line-color': pal.trail,
          'line-width': 8,
          'line-blur': 5,
          'line-opacity': isDark ? 0.18 : 0.14,
        },
      });
    } else {
      map.setPaintProperty('country-highlight-trail-glow', 'line-color', pal.trail);
      map.setPaintProperty('country-highlight-trail-glow', 'line-opacity', isDark ? 0.18 : 0.14);
    }
  } catch {}

  // State/region boundary layers — GeoJSON, same glow+edge treatment as country highlight.
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

  // Source-to-story arc layers (item 9) — empty on init; updateArcs() fills them.
  try {
    const arcsBefore = map.getLayer('country-label') ? 'country-label' : undefined;
    if (!map.getSource('arcs')) {
      map.addSource('arcs', {
        type: 'geojson',
        lineMetrics: true,
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!map.getLayer('arcs-glow')) {
      map.addLayer({
        id: 'arcs-glow',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 5,
          'line-blur': 3,
          'line-opacity': isDark ? 0.28 : 0.22,
        },
      }, arcsBefore);
    } else {
      map.setPaintProperty('arcs-glow', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('arcs-glow', 'line-opacity', isDark ? 0.28 : 0.22);
    }
    if (!map.getLayer('arcs-edge')) {
      map.addLayer({
        id: 'arcs-edge',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 1.2,
          'line-opacity': isDark ? 0.70 : 0.55,
        },
      }, arcsBefore);
    } else {
      map.setPaintProperty('arcs-edge', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('arcs-edge', 'line-opacity', isDark ? 0.70 : 0.55);
    }
  } catch {}
}

// Draw source-to-story arcs for the focused story. Returns a cancel()
// function that aborts the draw-on animation if a new story is selected
// before the animation finishes.
//
// articles  — story.articles array
// storyLoc  — { lat, lng } of the story focus point
export function updateArcs(map, articles, storyLoc) {
  if (!map) return () => {};

  const geojson = buildArcsGeoJSON(articles, storyLoc);
  try { map.getSource('arcs')?.setData(geojson); } catch { return () => {}; }

  // If there are no arcs (no known sources), nothing to animate.
  if (!geojson.features.length) return () => {};

  const DURATION_MS = 1_600;
  const start = performance.now();
  let raf = null;
  let cancelled = false;

  // Reset to hidden before animating.
  try {
    map.setPaintProperty('arcs-glow', 'line-trim-offset', [0, 1]);
    map.setPaintProperty('arcs-edge', 'line-trim-offset', [0, 1]);
  } catch {}

  const tick = (now) => {
    if (cancelled) return;
    const t = Math.min((now - start) / DURATION_MS, 1);
    const eased = 1 - (1 - t) ** 3; // cubic ease-out
    const trimEnd = 1 - eased;
    try {
      map.setPaintProperty('arcs-glow', 'line-trim-offset', [0, trimEnd]);
      map.setPaintProperty('arcs-edge', 'line-trim-offset', [0, trimEnd]);
    } catch {}
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (raf != null) cancelAnimationFrame(raf);
  };
}

// Update secondary and trail highlight filters (item 10).
//   secondary — array of ISO codes for other locations in the current story
//   trail     — ISO code of the previous story's focused location
// The active highlight is managed separately by camera.js / flyToLocation.
export function setHighlightPalette(map, { secondary = [], trail = '' } = {}) {
  try {
    const secFilter = secondary.length
      ? ['in', 'iso_3166_1', ...secondary]
      : ['in', 'iso_3166_1', ''];           // matches nothing
    ['country-highlight-secondary-glow', 'country-highlight-secondary-edge'].forEach(id => {
      if (map.getLayer(id)) map.setFilter(id, secFilter);
    });
  } catch {}
  try {
    if (map.getLayer('country-highlight-trail-glow')) {
      map.setFilter('country-highlight-trail-glow', ['==', 'iso_3166_1', trail]);
    }
  } catch {}
}

// Clear arcs — called by returnToAmbient so arcs disappear with the globe idle return.
export function clearArcs(map) {
  try {
    map.getSource('arcs')?.setData({ type: 'FeatureCollection', features: [] });
    map.setPaintProperty('arcs-glow', 'line-trim-offset', [0, 1]);
    map.setPaintProperty('arcs-edge', 'line-trim-offset', [0, 1]);
  } catch {}
}
