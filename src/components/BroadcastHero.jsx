import { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { decodeText } from '../utils';
import { useTheme } from '../ThemeContext.jsx';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const CHYRON_LABELS = ['Breaking', 'Developing', 'Analysis', 'Report', 'Update', 'Exclusive'];

const geocodeCache = {};

// Extract likely place names from a headline (capitalized words, skipping common non-place words)
const SKIP_WORDS = new Set([
  'The','His','Her','Its','Their','This','That','These','Those','After','Before',
  'During','Former','New','Possible','National','Federal','State','Supreme','Top',
  'First','Last','Multiple','Several','Key','Major','High','Low','Big','Old',
  'North','South','East','West','Central','United','House','Senate','White','Black',
]);

function extractLocationQuery(headline) {
  const words = headline.split(/[\s,;:()\-–—]+/).filter(Boolean);
  const places = words.filter(w =>
    /^[A-Z][a-z]{2,}/.test(w) &&
    !SKIP_WORDS.has(w) &&
    !/^(FBI|CIA|TSA|DHS|NATO|GOP|UN|EU)$/.test(w)
  ).map(w => w.replace(/[''s]+$/, '')); // strip possessives
  return places.slice(0, 2).join(' ') || null;
}

async function geocodeStory(story) {
  if (geocodeCache[story.id]) return geocodeCache[story.id];

  const fallback = { lng: 0, lat: 20, zoom: 1.0 };
  const locationQuery = extractLocationQuery(story.headline);
  if (!locationQuery) {
    geocodeCache[story.id] = fallback;
    return fallback;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'TheMeridian/1.0' } });
    const data = await res.json();
    if (data.length) {
      const result = { lng: parseFloat(data[0].lon), lat: parseFloat(data[0].lat), zoom: 6 };
      geocodeCache[story.id] = result;
      return result;
    }
  } catch (e) {
    console.warn('Geocoding failed:', e);
  }

  geocodeCache[story.id] = fallback;
  return fallback;
}

function buildChyronSub(analysis) {
  if (!analysis) return 'Analysis pending';
  const agreements = analysis.agreements?.length ?? 0;
  const disagreements = analysis.disagreements?.length ?? 0;
  const facts = analysis.facts?.length ?? 0;
  if (facts > 0) return `${facts} confirmed facts extracted`;
  const parts = [];
  if (agreements > 0) parts.push(`${agreements} source agreement${agreements !== 1 ? 's' : ''}`);
  if (disagreements > 0) parts.push(`${disagreements} disagreement${disagreements !== 1 ? 's' : ''}`);
  return parts.length ? parts.join('  ·  ') : 'Multi-source coverage';
}

function truncateHeadline(headline, maxLen = 72) {
  const decoded = decodeText(headline);
  return decoded.length <= maxLen ? decoded : decoded.slice(0, maxLen - 1) + '…';
}

function createMarkerElement(isDark) {
  const dotColor = isDark ? '#e8c547' : '#1a3a5c';
  const ringColor = isDark ? 'rgba(232,197,71,0.45)' : 'rgba(26,58,92,0.45)';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position: relative; width: 10px; height: 10px;';

  const ring = document.createElement('div');
  ring.className = 'marker-ring';
  ring.style.cssText = `
    position: absolute;
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 1px solid ${ringColor};
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  `;

  const dot = document.createElement('div');
  dot.className = isDark ? 'dot-pulse' : 'dot-pulse-light';
  dot.style.cssText = `width: 10px; height: 10px; border-radius: 50%; background: ${dotColor};`;

  wrapper.appendChild(ring);
  wrapper.appendChild(dot);
  return wrapper;
}

function getMapPadding(containerEl) {
  const w = containerEl?.offsetWidth ?? window.innerWidth;
  if (w < 640) return { top: 20, bottom: 80, left: 0, right: 0 };
  if (w < 900) return { top: 30, bottom: 100, left: 0, right: 100 };
  return { top: 40, bottom: 110, left: 0, right: 160 };
}

function applyMapStyle(map, isDark) {
  // Land color (dark-v11 only — not present in light-v11)
  try { map.setPaintProperty('land', 'background-color', isDark ? '#222534' : '#e8e4d8'); } catch {}

  // Country labels
  try {
    map.setPaintProperty('country-label', 'text-color', isDark ? '#ffffff' : '#1a1a2e');
    map.setPaintProperty('country-label', 'text-halo-color', isDark ? 'rgba(0,0,0,0.6)' : 'rgba(244,240,232,0.8)');
    map.setPaintProperty('country-label', 'text-halo-width', 1.5);
    map.setLayoutProperty('country-label', 'text-size', 20);
  } catch {}

  // Country highlight + border layers (re-add after style change)
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
        paint: { 'fill-color': '#e8c547', 'fill-opacity': 0.18 },
      });
    }
    if (!map.getLayer('country-borders')) {
      map.addLayer({
        id: 'country-borders',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: {
          'line-color': isDark ? 'rgba(180,190,220,0.6)' : '#1a0e00',
          'line-width': isDark ? 0.8 : 1.8,
          'line-opacity': isDark ? 0.6 : 0.85,
        },
      });
    } else {
      map.setPaintProperty('country-borders', 'line-color', isDark ? 'rgba(180,190,220,0.6)' : '#1a0e00');
      map.setPaintProperty('country-borders', 'line-width', isDark ? 0.8 : 1.8);
      map.setPaintProperty('country-borders', 'line-opacity', isDark ? 0.6 : 0.85);
    }
  } catch {}
}

export default function BroadcastHero({ stories, selectedIdx, onSelect, edition, availableEditions = [], onEditionSelect }) {
  const { isDark } = useTheme();
  const EDITION_LABELS = { morning: '☀  Morning', evening: '🌙  Evening' };
  const [time, setTime] = useState('');
  const [activeLocIdx, setActiveLocIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [mapEnabled, setMapEnabled] = useState(() => localStorage.getItem('meridian-map') !== 'false');
  const [mapVisible, setMapVisible] = useState(() => localStorage.getItem('meridian-map-visible') !== 'false');
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const styleLoadCallbackRef = useRef(null);
  const pendingIsDarkRef = useRef(isDark);

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      const d = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
      setTime(`${d}  ·  ${t} ET`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // Initialize map (skipped entirely when disabled)
  useEffect(() => {
    if (!mapEnabled) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    if (!mapContainer.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/outdoors-v12',
      center: [0, 20],
      zoom: 1.0,
      interactive: true,
      attributionControl: false,
    });

    map.on('load', () => {
      map.resize();
      map.setPadding(getMapPadding(mapContainer.current));
      applyMapStyle(map, isDark);
    });

    const marker = new mapboxgl.Marker({ element: createMarkerElement(isDark), anchor: 'center' })
      .setLngLat([0, 20])
      .addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [mapEnabled]);

  // Persist map preferences
  useEffect(() => { localStorage.setItem('meridian-map', mapEnabled); }, [mapEnabled]);
  useEffect(() => { localStorage.setItem('meridian-map-visible', mapVisible); }, [mapVisible]);

  // Resize map when expanded or visibility changes
  useEffect(() => {
    const id = setTimeout(() => mapRef.current?.resize(), 50);
    return () => clearTimeout(id);
  }, [expanded, mapVisible]);

  // Update map padding when container resizes (orientation changes, expand/collapse)
  useEffect(() => {
    if (!mapContainer.current) return;
    const ro = new ResizeObserver(() => {
      if (!mapRef.current) return;
      mapRef.current.resize();
      mapRef.current.setPadding(getMapPadding(mapContainer.current));
    });
    ro.observe(mapContainer.current);
    return () => ro.disconnect();
  }, []);

  // Escape key to collapse
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded]);

  // Switch map style when theme changes
  useEffect(() => {
    pendingIsDarkRef.current = isDark;

    if (!mapRef.current) return;
    const map = mapRef.current;

    // Cancel any stale style.load listener from a previous rapid toggle
    if (styleLoadCallbackRef.current) {
      map.off('style.load', styleLoadCallbackRef.current);
      styleLoadCallbackRef.current = null;
    }

    const newStyle = isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/outdoors-v12';
    map.setStyle(newStyle);

    const onStyleLoad = () => {
      styleLoadCallbackRef.current = null;
      applyMapStyle(map, pendingIsDarkRef.current);
    };
    styleLoadCallbackRef.current = onStyleLoad;
    map.once('style.load', onStyleLoad);

    // Update marker colors to match new theme
    if (markerRef.current) {
      const dotColor = isDark ? '#e8c547' : '#1a3a5c';
      const ringColor = isDark ? 'rgba(232,197,71,0.45)' : 'rgba(26,58,92,0.45)';
      const el = markerRef.current.getElement();
      const dot = el.querySelector('.dot-pulse, .dot-pulse-light');
      const ring = el.querySelector('.marker-ring');
      if (dot) {
        dot.style.background = dotColor;
        dot.className = isDark ? 'dot-pulse' : 'dot-pulse-light';
      }
      if (ring) ring.style.borderColor = ringColor;
    }
  }, [isDark]);

  const featured = stories[selectedIdx] ?? stories[0];
  const featuredLocations = featured?.analysis?.locations?.filter(l => l?.lat != null && l?.lng != null) ?? [];

  const flyToLocation = (loc) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const go = () => {
      map.flyTo({ center: [loc.lng, loc.lat], zoom: 5, duration: 2000, essential: true });
      markerRef.current?.setLngLat([loc.lng, loc.lat]);
      if (map.getLayer('country-highlight')) {
        map.setFilter('country-highlight', ['==', 'iso_3166_1', loc.iso ?? '']);
      }
    };
    if (map.loaded()) go(); else map.once('load', go);
  };

  // Fly to first location when story changes
  useEffect(() => {
    if (!mapRef.current || !featured) return;
    setActiveLocIdx(0);
    if (featuredLocations.length > 0) {
      flyToLocation(featuredLocations[0]);
    } else {
      geocodeStory(featured).then(({ lng, lat, zoom }) => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        const go = () => {
          map.flyTo({ center: [lng, lat], zoom, duration: 2000, essential: true });
          markerRef.current?.setLngLat([lng, lat]);
          if (map.getLayer('country-highlight')) {
            map.setFilter('country-highlight', ['==', 'iso_3166_1', '']);
          }
        };
        if (map.loaded()) go(); else map.once('load', go);
      });
    }
  }, [selectedIdx]);

  if (!featured) return null;

  const chyronSub = buildChyronSub(featured.analysis);
  const chyronLabel = CHYRON_LABELS[selectedIdx % CHYRON_LABELS.length];
  const sourceCount = new Set(featured.articles.map(a => a.source)).size;
  const tickerText = stories.map(s => truncateHeadline(s.headline, 80)).join('  ·  THE MERIDIAN  ·  ');

  // Semi-transparent color helpers using CSS RGB vars (works in inline styles)
  const btnBg    = `rgba(var(--bg-secondary-rgb), 0.80)`;
  const chyronUpper = `rgba(var(--bg-secondary-rgb), 0.92)`;
  const chyronLower = `rgba(var(--bg-chyron-rgb), 0.96)`;
  const textAlpha55 = `rgba(var(--text-primary-rgb), 0.55)`;
  const textAlpha60 = `rgba(var(--text-primary-rgb), 0.60)`;
  const textAlpha35 = `rgba(var(--text-primary-rgb), 0.35)`;
  const textAlpha45 = `rgba(var(--text-primary-rgb), 0.45)`;
  const textAlpha70 = `rgba(var(--text-primary-rgb), 0.70)`;
  const overlayGrad = isDark
    ? 'radial-gradient(ellipse at 52% 48%, rgba(10,13,20,0.3) 0%, rgba(10,13,20,0.75) 100%)'
    : 'radial-gradient(ellipse at 52% 48%, rgba(244,240,232,0.1) 0%, rgba(244,240,232,0.45) 100%)';

  const containerStyle = expanded
    ? { position: 'fixed', inset: 0, zIndex: 50, width: '100vw', height: '100vh' }
    : { aspectRatio: '16/9', maxHeight: '75vh', minHeight: 280, position: 'sticky', top: 0, zIndex: 20 };

  return (
    <>
      {!mapVisible && (
        <div
          className="w-full flex items-center justify-between px-4"
          style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--hero-border)', height: 36, zIndex: 20 }}
        >
          <span
            className="font-display font-black tracking-[3px] uppercase"
            style={{ color: 'var(--text-primary)', fontSize: 11 }}
          >
            The Meridian
          </span>
          <button
            onClick={() => setMapVisible(true)}
            className="cursor-pointer transition-all"
            style={{ color: 'var(--accent)', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', background: 'none', border: 'none', padding: '0 4px' }}
          >
            Show Map ▼
          </button>
        </div>
      )}
      <div
        className="relative w-full overflow-hidden hero-aspect-container"
        style={{ ...containerStyle, display: mapVisible ? '' : 'none' }}
      >
      {/* Mapbox map */}
      <div ref={mapContainer} className="absolute inset-0" style={{ opacity: 1.8, width: '100%', height: '100%' }} />

      {/* Fallback background when map is disabled */}
      {!mapEnabled && (
        <div className="absolute inset-0" style={{ background: 'var(--bg-primary)' }} />
      )}

      {/* Radial overlay */}
      {mapEnabled && <div className="absolute inset-0 pointer-events-none" style={{ background: overlayGrad }} />}

      {/* CRT scanlines */}
      {mapEnabled && <div className="absolute inset-0 scanlines pointer-events-none" />}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-[3%] py-[2%]" style={{ zIndex: 10 }}>
        <div
          className="font-display font-black tracking-[3px] uppercase"
          style={{ color: 'var(--text-primary)', fontSize: 'clamp(13px, 2.2vw, 26px)' }}
        >
          The Meridian
        </div>
        <div
          className="font-semibold tracking-[2px] uppercase"
          style={{ background: '#c0392b', color: '#fff', fontSize: 'clamp(7px, 0.9vw, 11px)', padding: '3px 10px' }}
        >
          Live
        </div>
        <div className="hero-clock" style={{ color: textAlpha55, fontSize: 'clamp(7px, 0.9vw, 11px)', letterSpacing: 1 }}>
          {time}
        </div>
      </div>

      {/* Story selector */}
      {stories.length > 1 && (
        <div
          className="absolute story-selector"
          style={{ zIndex: 10 }}
        >
          {stories.slice(0, 6).map((story, i) => (
            <button
              key={story.id}
              onClick={() => onSelect(i)}
              className="text-left transition-all cursor-pointer story-selector-btn"
              style={{
                background: selectedIdx === i ? 'rgba(232,197,71,0.15)' : btnBg,
                border: `0.5px solid ${selectedIdx === i ? 'var(--hero-border-active)' : 'var(--hero-border)'}`,
                color: selectedIdx === i ? 'var(--accent)' : 'var(--text-secondary)',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                padding: '5px 10px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {truncateHeadline(story.headline, 40)}
            </button>
          ))}
        </div>
      )}

      {/* Location buttons */}
      {featuredLocations.length > 1 && (
        <div
          className="absolute flex gap-2 flex-wrap"
          style={{ bottom: 'calc(var(--chyron-h) + 4px)', left: '3%', zIndex: 10 }}
        >
          {featuredLocations.map((loc, i) => (
            <button
              key={loc.name}
              onClick={() => { setActiveLocIdx(i); flyToLocation(loc); }}
              className="cursor-pointer transition-all"
              style={{
                background: activeLocIdx === i ? 'rgba(232,197,71,0.2)' : btnBg,
                border: `1px solid ${activeLocIdx === i ? 'var(--hero-border-active)' : 'var(--hero-border)'}`,
                color: activeLocIdx === i ? 'var(--accent)' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 'clamp(7px, 0.8vw, 10px)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                padding: '3px 10px',
              }}
            >
              {loc.name}
            </button>
          ))}
        </div>
      )}

      {/* Zoom + expand controls */}
      <div
        className="absolute flex flex-row gap-1.5"
        style={{ bottom: 'calc(var(--chyron-h) + 60px)', right: '3%', zIndex: 10 }}
      >
        {['+', '−'].map((label, i) => (
          <button
            key={label}
            onClick={() => i === 0 ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut()}
            className="cursor-pointer transition-all"
            style={{
              background: btnBg,
              border: '1px solid var(--hero-border)',
              color: textAlpha70,
              fontSize: 'clamp(14px, 1.5vw, 20px)',
              width: 'clamp(28px, 3vw, 40px)',
              height: 'clamp(28px, 3vw, 40px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setMapVisible(false)}
          title="Minimize map"
          className="cursor-pointer transition-all"
          style={{
            background: btnBg,
            border: '1px solid var(--hero-border)',
            color: textAlpha70,
            fontSize: 'clamp(10px, 1.1vw, 14px)',
            width: 'clamp(28px, 3vw, 40px)',
            height: 'clamp(28px, 3vw, 40px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          ▲
        </button>
        <button
          onClick={() => setMapEnabled(e => !e)}
          title={mapEnabled ? 'Disable map (improve performance)' : 'Enable map'}
          className="cursor-pointer transition-all"
          style={{
            background: mapEnabled ? btnBg : 'rgba(232,197,71,0.15)',
            border: `1px solid ${mapEnabled ? 'var(--hero-border)' : 'var(--hero-border-active)'}`,
            color: mapEnabled ? textAlpha70 : 'var(--accent)',
            fontSize: 'clamp(12px, 1.3vw, 17px)',
            width: 'clamp(28px, 3vw, 40px)',
            height: 'clamp(28px, 3vw, 40px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          ⊕
        </button>
        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Minimize map' : 'Expand map'}
          className="cursor-pointer transition-all"
          style={{
            background: btnBg,
            border: '1px solid var(--hero-border)',
            color: textAlpha70,
            fontSize: 'clamp(12px, 1.3vw, 17px)',
            width: 'clamp(28px, 3vw, 40px)',
            height: 'clamp(28px, 3vw, 40px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {expanded ? '⊠' : '⊡'}
        </button>
      </div>

      {/* Chyron */}
      <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 10 }}>
        <div className="overflow-hidden" style={{ background: 'var(--accent)', padding: '0.5% 0' }}>
          <div
            className="ticker-scroll inline-block whitespace-nowrap"
            style={{ color: 'var(--accent-text)', fontSize: 'clamp(9px, 1vw, 13px)', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}
          >
            THE MERIDIAN  ·  {tickerText}  ·  THE MERIDIAN  ·  {tickerText}
          </div>
        </div>

        <div
          className="flex items-center gap-4"
          style={{ background: chyronUpper, borderTop: '2px solid var(--hero-border-active)', padding: 'max(4px, 1.2%) 3%' }}
        >
          <div
            className="shrink-0 font-semibold tracking-[2px] uppercase whitespace-nowrap"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)', fontSize: 'clamp(7px, 0.85vw, 10px)', padding: '3px 10px' }}
          >
            {chyronLabel}
          </div>
          <div
            className="font-display font-bold"
            style={{ color: 'var(--text-primary)', fontSize: 'clamp(11px, 1.75vw, 20px)', letterSpacing: '0.3px' }}
          >
            {truncateHeadline(featured.headline, window.innerWidth < 640 ? 45 : 72)}
          </div>
        </div>

        <div
          className="flex items-center justify-between"
          style={{ background: chyronLower, padding: 'max(3px, 0.8%) 3%' }}
        >
          <div style={{ color: textAlpha60, fontSize: 'clamp(7px, 1vw, 12px)', letterSpacing: '0.8px' }}>
            {chyronSub}
            {sourceCount > 0 && (
              <span style={{ color: textAlpha35, marginLeft: 12 }}>
                {sourceCount} source{sourceCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {availableEditions.length > 1 && (
            <div className="flex gap-1.5 shrink-0">
              {availableEditions.filter(e => e !== 'manual').map(e => (
                <button
                  key={e}
                  onClick={() => onEditionSelect(e)}
                  className="cursor-pointer transition-all"
                  style={{
                    background: edition === e ? 'rgba(232,197,71,0.15)' : 'transparent',
                    border: `1px solid ${edition === e ? 'var(--hero-border-active)' : 'var(--hero-border)'}`,
                    color: edition === e ? 'var(--accent)' : textAlpha45,
                    fontSize: 'clamp(7px, 0.85vw, 10px)',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                  }}
                >
                  {EDITION_LABELS[e] ?? e}
                </button>
              ))}
            </div>
          )}
          {availableEditions.length <= 1 && edition && edition !== 'manual' && (
            <div style={{ color: 'var(--accent)', fontSize: 'clamp(7px, 0.85vw, 11px)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              {EDITION_LABELS[edition] ?? edition}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
