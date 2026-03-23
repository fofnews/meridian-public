import { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const CHYRON_LABELS = ['Breaking', 'Developing', 'Analysis', 'Report', 'Update', 'Exclusive'];

const geocodeCache = {};

async function geocodeStory(story) {
  if (geocodeCache[story.id]) return geocodeCache[story.id];

  const query = encodeURIComponent(story.headline.slice(0, 100));
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'TheMeridian/1.0' } });
    const data = await res.json();
    if (data.length) {
      const result = { lng: parseFloat(data[0].lon), lat: parseFloat(data[0].lat), zoom: 4 };
      geocodeCache[story.id] = result;
      return result;
    }
  } catch (e) {
    console.warn('Geocoding failed:', e);
  }

  const fallback = { lng: 0, lat: 20, zoom: 1.5 };
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
  return headline.length <= maxLen ? headline : headline.slice(0, maxLen - 1) + '…';
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

export default function BroadcastHero({ stories, selectedIdx, onSelect, edition }) {
  const [time, setTime] = useState('');
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
      interactive: false,
      attributionControl: false,
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

  // Fly to story location when selection changes
  const featured = stories[selectedIdx] ?? stories[0];
  useEffect(() => {
    if (!mapRef.current || !featured) return;
    geocodeStory(featured).then(({ lng, lat, zoom }) => {
      mapRef.current.flyTo({ center: [lng, lat], zoom, duration: 2000, essential: true });
      markerRef.current?.setLngLat([lng, lat]);
    });
  }, [featured]);

  if (!featured) return null;

  const chyronSub = buildChyronSub(featured.analysis);
  const chyronLabel = CHYRON_LABELS[selectedIdx % CHYRON_LABELS.length];
  const sourceCount = new Set(featured.articles.map(a => a.source)).size;
  const tickerText = stories.map(s => truncateHeadline(s.headline, 80)).join('  ·  THE MERIDIAN  ·  ');
  const editionLabel = edition === 'morning' ? '☀  Morning Edition'
    : edition === 'evening' ? '🌙  Evening Edition' : '';

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: '16/9', maxHeight: '75vh', minHeight: 280 }}
    >
      {/* Mapbox map */}
      <div ref={mapContainer} className="absolute inset-0" style={{ opacity: 0.6 }} />

      {/* Dark radial overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 52% 48%, rgba(10,13,20,0.3) 0%, rgba(10,13,20,0.75) 100%)' }}
      />

      {/* CRT scanlines */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-[3%] py-[2%]">
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
          style={{ top: '50%', right: '3%', transform: 'translateY(-50%)' }}
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

      {/* Chyron */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="overflow-hidden" style={{ background: '#e8c547', padding: '0.5% 0' }}>
          <div
            className="ticker-scroll inline-block whitespace-nowrap"
            style={{ color: '#0a0d14', fontSize: 'clamp(7px, 0.8vw, 10px)', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}
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
          {editionLabel && (
            <div style={{ color: '#e8c547', fontSize: 'clamp(7px, 0.85vw, 11px)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              {editionLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
