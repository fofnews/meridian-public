// Website-side map hero. Sober editorial chrome around the map: a
// status strip with wordmark + edition + date + clock, plus the
// interactive controls (story selector, location buttons, zoom,
// expand/minimize). The chyron, LIVE badge, scrolling ticker, and CRT
// scanlines that this component used to render now live in
// BroadcastStage.jsx (item 0d).

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext.jsx';
import { useMeridianMap } from '../map/useMeridianMap.js';
import { fetchBoundaryPolygon, geocodeStory } from '../map/geocoding.js';
import { FOCUSED_PITCH_WEBSITE } from '../map/camera.js';
import { decodeText } from '../utils';

const EDITION_LABELS = { morning: 'Morning', evening: 'Evening' };

function truncateHeadline(headline, maxLen = 40) {
  const decoded = decodeText(headline);
  return decoded.length <= maxLen ? decoded : decoded.slice(0, maxLen - 1) + '…';
}

function formatReportDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function MapHero({
  stories,
  selectedIdx,
  onSelect,
  edition,
  selectedDate,
  availableEditions = [],
  onEditionSelect,
}) {
  const { isDark } = useTheme();
  const [time, setTime] = useState('');
  const [activeLocIdx, setActiveLocIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [mapEnabled] = useState(() => localStorage.getItem('meridian-map') !== 'false');
  const [mapVisible, setMapVisible] = useState(() => localStorage.getItem('meridian-map-visible') !== 'false');

  const { mapContainer, mapRef, flyToLocation } = useMeridianMap({
    mapEnabled,
    isDark,
    focusPitch: FOCUSED_PITCH_WEBSITE,
  });

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setTime(t);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  // Persist map preferences
  useEffect(() => { localStorage.setItem('meridian-map', mapEnabled); }, [mapEnabled]);
  useEffect(() => { localStorage.setItem('meridian-map-visible', mapVisible); }, [mapVisible]);

  // Resize map when expanded or visibility changes
  useEffect(() => {
    const id = setTimeout(() => mapRef.current?.resize(), 50);
    return () => clearTimeout(id);
  }, [expanded, mapVisible, mapRef]);

  // Escape key to collapse fullscreen
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded]);

  const featured = stories[selectedIdx] ?? stories[0];
  const featuredLocations = featured?.analysis?.locations?.filter(l => l?.lat != null && l?.lng != null) ?? [];

  // Fly to first location when story changes.
  useEffect(() => {
    if (!featured) return;
    setActiveLocIdx(0);
    if (featuredLocations.length > 0) {
      const loc = featuredLocations[0];
      fetchBoundaryPolygon(loc.name, loc.iso).then(polygon => {
        flyToLocation({ ...loc, polygon });
      });
    } else {
      geocodeStory(featured).then((coords) => flyToLocation(coords));
    }
  }, [selectedIdx]);

  if (!featured) return null;

  // Semi-transparent control colors (kept as inline styles since they
  // depend on CSS RGB vars).
  const btnBg       = `rgba(var(--bg-secondary-rgb), 0.80)`;
  const textAlpha70 = `rgba(var(--text-primary-rgb), 0.70)`;
  const textAlpha60 = `rgba(var(--text-primary-rgb), 0.60)`;
  const overlayGrad = isDark
    ? 'radial-gradient(ellipse at 52% 48%, rgba(10,13,20,0.3) 0%, rgba(10,13,20,0.75) 100%)'
    : 'radial-gradient(ellipse at 52% 48%, rgba(244,240,232,0.1) 0%, rgba(244,240,232,0.45) 100%)';

  const containerStyle = expanded
    ? { position: 'fixed', inset: 0, zIndex: 50, width: '100vw', height: '100vh' }
    : { height: 'clamp(220px, 45vh, 560px)', zIndex: 20 };

  // Sober status strip — replaces the chyron + ticker + LIVE badge.
  const statusStrip = (
    <div
      className="w-full flex items-center justify-between"
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-primary)',
        borderBottom: '1px solid var(--border-primary)',
        padding: '8px clamp(12px, 3%, 24px)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="font-display font-black tracking-[3px] uppercase shrink-0"
          style={{ color: 'var(--text-primary)', fontSize: 12 }}
        >
          The Meridian
        </span>
        {edition && edition !== 'manual' && EDITION_LABELS[edition] && (
          <>
            <span style={{ color: 'var(--border-dim)' }}>·</span>
            <span
              className="shrink-0 uppercase"
              style={{ color: 'var(--accent)', fontSize: 11, letterSpacing: '1.5px', fontWeight: 600 }}
            >
              {EDITION_LABELS[edition]}
            </span>
          </>
        )}
        {selectedDate && (
          <>
            <span style={{ color: 'var(--border-dim)' }}>·</span>
            <span className="truncate" style={{ color: textAlpha60, fontSize: 11, letterSpacing: '0.5px' }}>
              {formatReportDate(selectedDate)}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {availableEditions.length > 1 && (
          <div className="flex gap-1.5">
            {availableEditions.filter(e => e !== 'manual').map(e => (
              <button
                key={e}
                onClick={() => onEditionSelect(e)}
                className="cursor-pointer transition-all"
                style={{
                  background: edition === e ? 'rgba(232,197,71,0.12)' : 'transparent',
                  border: `1px solid ${edition === e ? 'var(--hero-border-active)' : 'var(--hero-border)'}`,
                  color: edition === e ? 'var(--accent)' : textAlpha60,
                  fontSize: 10,
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
        <span
          className="hero-clock font-mono"
          style={{ color: textAlpha60, fontSize: 11, letterSpacing: '0.5px' }}
        >
          {time}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
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

      {/* Map container */}
      <div
        className="relative w-full overflow-hidden hero-aspect-container"
        style={{ ...containerStyle, display: mapVisible ? '' : 'none' }}
      >
        <div ref={mapContainer} className="absolute inset-0" style={{ opacity: 1.8, width: '100%', height: '100%' }} />

        {!mapEnabled && (
          <div className="absolute inset-0" style={{ background: 'var(--bg-primary)' }} />
        )}

        {mapEnabled && <div className="absolute inset-0 pointer-events-none" style={{ background: overlayGrad }} />}

        {/* Story selector */}
        {stories.length > 1 && (
          <div className="absolute story-selector" style={{ zIndex: 10 }}>
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
                {truncateHeadline(story.headline)}
              </button>
            ))}
          </div>
        )}

        {/* Location buttons */}
        {featuredLocations.length > 1 && (
          <div
            className="absolute flex gap-2 flex-wrap justify-end"
            style={{ bottom: 8, right: 8, zIndex: 10 }}
          >
            {featuredLocations.map((loc, i) => (
              <button
                key={loc.name}
                onClick={() => {
                  setActiveLocIdx(i);
                  fetchBoundaryPolygon(loc.name, loc.iso).then(polygon => {
                    flyToLocation({ ...loc, polygon });
                  });
                }}
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

        {/* Zoom + map controls */}
        <div
          className="absolute flex flex-col gap-1.5"
          style={{ top: '50%', transform: 'translateY(-50%)', right: 8, zIndex: 10 }}
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
            onClick={() => setExpanded(e => !e)}
            title={expanded ? 'Exit fullscreen' : 'Expand map'}
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
      </div>

      {/* Sober status strip below the map (replaces the chyron + ticker) */}
      {mapVisible && !expanded && statusStrip}
    </div>
  );
}
