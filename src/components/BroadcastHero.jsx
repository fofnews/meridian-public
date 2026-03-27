import { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { decodeText } from '../utils';

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

  const fallback = { lng: 0, lat: 20, zoom: 1.5 };
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

function createMarkerElement() {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position: relative; width: 10px; height: 10px;';

  const ring = document.createElement('div');
  ring.style.cssText = `
    position: absolute;
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 1px solid rgba(232,197,71,0.45);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  `;

  const dot = document.createElement('div');
  dot.className = 'dot-pulse';
  dot.style.cssText = 'width: 10px; height: 10px; border-radius: 50%; background: #e8c547;';

  wrapper.appendChild(ring);
  wrapper.appendChild(dot);
  return wrapper;
}

export default function BroadcastHero({ stories, selectedIdx, onSelect, edition, availableEditions = [], onEditionSelect }) {
  const EDITION_LABELS = { morning: '☀  Morning', evening: '🌙  Evening' };
  const [time, setTime] = useState('');
  const [activeLocIdx, setActiveLocIdx] = useState(0);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

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

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [0, 20],
      zoom: 1.5,
      interactive: true,
      attributionControl: false,
    });

    map.on('load', () => {
      map.resize();
      // Offset center to compensate for chyron (bottom) and story selector (right) overlays
      map.setPadding({ top: 40, bottom: 110, left: 0, right: 160 });
      // Land brightness
      map.setPaintProperty('land', 'background-color', '#222534');

      // Brighten and enlarge country label text
      map.setPaintProperty('country-label', 'text-color', '#ffffff');
      map.setPaintProperty('country-label', 'text-halo-color', 'rgba(0,0,0,0.6)');
      map.setPaintProperty('country-label', 'text-halo-width', 1.5);
      map.setLayoutProperty('country-label', 'text-size', 20);

      // Country highlight layer
      map.addSource('country-boundaries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1',
      });
      map.addLayer({
        id: 'country-highlight',
        type: 'fill',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['==', 'iso_3166_1', ''],
        paint: {
          'fill-color': '#e8c547',
          'fill-opacity': 0.18,
        },
      });
    });

    const marker = new mapboxgl.Marker({ element: createMarkerElement(), anchor: 'center' })
      .setLngLat([0, 20])
      .addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const featured = stories[selectedIdx] ?? stories[0];
  const featuredLocations = featured?.analysis?.locations?.filter(l => l?.lat != null && l?.lng != null) ?? [];

  const flyToLocation = (loc) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const go = () => {
      map.flyTo({ center: [loc.lng, loc.lat], zoom: 6, duration: 2000, essential: true });
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

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: '16/9', maxHeight: '75vh', minHeight: 280, position: 'sticky', top: 0, zIndex: 20 }}
    >
      {/* Mapbox map */}
      <div ref={mapContainer} className="absolute inset-0" style={{ opacity: 1.8, width: '100%', height: '100%' }} />

      {/* Dark radial overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 52% 48%, rgba(10,13,20,0.3) 0%, rgba(10,13,20,0.75) 100%)' }}
      />

      {/* CRT scanlines */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-[3%] py-[2%]" style={{ zIndex: 10 }}>
        <div
          className="font-display font-black tracking-[3px] uppercase"
          style={{ color: '#f0ebe0', fontSize: 'clamp(13px, 2.2vw, 26px)' }}
        >
          The Meridian
        </div>
        <div
          className="font-semibold tracking-[2px] uppercase"
          style={{ background: '#c0392b', color: '#fff', fontSize: 'clamp(7px, 0.9vw, 11px)', padding: '3px 10px' }}
        >
          Live
        </div>
        <div style={{ color: 'rgba(240,235,224,0.55)', fontSize: 'clamp(7px, 0.9vw, 11px)', letterSpacing: 1 }}>
          {time}
        </div>
      </div>

      {/* Story selector */}
      {stories.length > 1 && (
        <div
          className="absolute flex flex-col gap-1.5"
          style={{ top: '50%', right: '3%', transform: 'translateY(-50%)', zIndex: 10 }}
        >
          {stories.slice(0, 6).map((story, i) => (
            <button
              key={story.id}
              onClick={() => onSelect(i)}
              className="text-left transition-all cursor-pointer"
              style={{
                background: selectedIdx === i ? 'rgba(232,197,71,0.15)' : 'rgba(10,13,20,0.75)',
                border: `0.5px solid ${selectedIdx === i ? 'rgba(232,197,71,0.7)' : 'rgba(232,197,71,0.2)'}`,
                color: selectedIdx === i ? '#e8c547' : 'rgba(240,235,224,0.6)',
                fontSize: 'clamp(6px, 0.8vw, 10px)',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                padding: '5px 10px',
                maxWidth: '20vw',
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
          style={{ bottom: 'calc(12% + 4px)', left: '3%', zIndex: 10 }}
        >
          {featuredLocations.map((loc, i) => (
            <button
              key={loc.name}
              onClick={() => { setActiveLocIdx(i); flyToLocation(loc); }}
              className="cursor-pointer transition-all"
              style={{
                background: activeLocIdx === i ? 'rgba(232,197,71,0.2)' : 'rgba(10,13,20,0.75)',
                border: `1px solid ${activeLocIdx === i ? '#e8c547' : 'rgba(232,197,71,0.3)'}`,
                color: activeLocIdx === i ? '#e8c547' : '#f0ebe0',
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

      {/* Zoom controls */}
      <div
        className="absolute flex flex-col gap-1"
        style={{ top: '50%', left: '3%', transform: 'translateY(-50%)', zIndex: 10 }}
      >
        {['+', '−'].map((label, i) => (
          <button
            key={label}
            onClick={() => i === 0 ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut()}
            className="cursor-pointer transition-all"
            style={{
              background: 'rgba(10,13,20,0.75)',
              border: '1px solid rgba(232,197,71,0.3)',
              color: 'rgba(240,235,224,0.7)',
              fontSize: 'clamp(10px, 1.1vw, 14px)',
              width: 'clamp(18px, 2vw, 26px)',
              height: 'clamp(18px, 2vw, 26px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chyron */}
      <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 10 }}>
        <div className="overflow-hidden" style={{ background: '#e8c547', padding: '0.5% 0' }}>
          <div
            className="ticker-scroll inline-block whitespace-nowrap"
            style={{ color: '#0a0d14', fontSize: 'clamp(9px, 1vw, 13px)', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}
          >
            THE MERIDIAN  ·  {tickerText}  ·  THE MERIDIAN  ·  {tickerText}
          </div>
        </div>

        <div
          className="flex items-center gap-4 px-[3%] py-[1.2%]"
          style={{ background: 'rgba(10,13,20,0.92)', borderTop: '2px solid #e8c547' }}
        >
          <div
            className="shrink-0 font-semibold tracking-[2px] uppercase whitespace-nowrap"
            style={{ background: '#e8c547', color: '#0a0d14', fontSize: 'clamp(7px, 0.85vw, 10px)', padding: '3px 10px' }}
          >
            {chyronLabel}
          </div>
          <div
            className="font-display font-bold"
            style={{ color: '#f0ebe0', fontSize: 'clamp(11px, 1.75vw, 20px)', letterSpacing: '0.3px' }}
          >
            {truncateHeadline(featured.headline)}
          </div>
        </div>

        <div
          className="flex items-center justify-between px-[3%] py-[0.8%]"
          style={{ background: 'rgba(18,22,36,0.96)' }}
        >
          <div style={{ color: 'rgba(240,235,224,0.6)', fontSize: 'clamp(7px, 1vw, 12px)', letterSpacing: '0.8px' }}>
            {chyronSub}
            {sourceCount > 0 && (
              <span style={{ color: 'rgba(240,235,224,0.35)', marginLeft: 12 }}>
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
                    border: `1px solid ${edition === e ? '#e8c547' : 'rgba(232,197,71,0.3)'}`,
                    color: edition === e ? '#e8c547' : 'rgba(240,235,224,0.45)',
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
            <div style={{ color: '#e8c547', fontSize: 'clamp(7px, 0.85vw, 11px)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              {EDITION_LABELS[edition] ?? edition}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
