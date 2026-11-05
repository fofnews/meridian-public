// Website-side map hero. Sober editorial chrome around the map: a
// status strip with wordmark + edition + date + clock, plus the
// interactive controls (story selector, location buttons, zoom,
// expand/minimize). The chyron, LIVE badge, scrolling ticker, and CRT
// scanlines that this component used to render now live in
// BroadcastStage.jsx (item 0d).

import { useState, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
import { useTheme } from '../ThemeContext.jsx';
import { useIsPhone } from '../useIsPhone.js';
import { useMeridianMap } from '../map/useMeridianMap.js';
import { fetchBoundaryPolygon, geocodeStory } from '../map/geocoding.js';
import { FOCUSED_PITCH_WEBSITE } from '../map/camera.js';
import { decodeText, formatAnalysisTime } from '../utils';
import { phoneMapHeight } from '../phoneLayout.js';

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

function GearButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Settings"
      title="Settings"
      className="cursor-pointer flex items-center justify-center shrink-0"
      style={{ width: 44, height: 44, color: 'var(--text-muted)', background: 'none', border: 'none' }}
    >
      <Settings size={18} />
    </button>
  );
}

export default function MapHero({
  featuredStory,
  edition,
  selectedDate,
  availableEditions = [],
  onEditionSelect,
  fetchedAt,
  isLatest = false,
  mapVisible,
  onMapVisibleChange,
  onOpenSettings,
  storyOpen = false,
  openStoryTitle = '',
  onCloseStory,
}) {
  const { isDark } = useTheme();
  const isPhone = useIsPhone();
  const [activeLocIdx, setActiveLocIdx] = useState(0);
  const [storyHeaderVisible, setStoryHeaderVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [mapEnabled] = useState(() => localStorage.getItem('meridian-map') !== 'false');
  // Latches true the first time the map is shown; gates map creation so a reader
  // who starts with the map hidden never pays for a Mapbox load.
  const [hasBeenShown, setHasBeenShown] = useState(mapVisible);
  useEffect(() => { if (mapVisible) setHasBeenShown(true); }, [mapVisible]);

  const [vh, setVh] = useState(() => window.innerHeight);
  useEffect(() => {
    if (!isPhone) return;
    let lastW = window.innerWidth;
    const handler = () => {
      const w = window.innerWidth;
      if (w !== lastW) { lastW = w; setVh(window.innerHeight); }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [isPhone]);

  const stickyRef = useRef(null);

  const { mapContainer, mapRef, flyToLocation, updateArcs, updateHighlights, applyBoundaryPolygon } = useMeridianMap({
    mapEnabled: mapEnabled && (hasBeenShown || mapVisible),
    isDark,
    focusPitch: FOCUSED_PITCH_WEBSITE,
    gesturesEnabled: !isPhone || expanded,
  });

  // Persist map preferences
  useEffect(() => { localStorage.setItem('meridian-map', mapEnabled); }, [mapEnabled]);

  // Resize map when expanded, visibility, or phone story-open state changes.
  // On phones the height animates over 200ms, so delay past the transition.
  useEffect(() => {
    const delay = isPhone && !expanded ? 220 : 50;
    const id = setTimeout(() => mapRef.current?.resize(), delay);
    return () => clearTimeout(id);
  }, [expanded, mapVisible, storyOpen, isPhone, mapRef]);

  // Escape key to collapse fullscreen
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded]);

  // On phones, swap the strip to show the open story's title once its header
  // scrolls above the sticky strip. Reset to visible whenever story closes.
  useEffect(() => {
    if (!isPhone || !storyOpen) {
      setStoryHeaderVisible(true);
      return;
    }
    const el = document.querySelector('[data-story-open-header]');
    if (!el) return;
    const stripH = stickyRef.current?.offsetHeight ?? 60;
    const observer = new IntersectionObserver(([entry]) => {
      setStoryHeaderVisible(entry.isIntersecting);
    }, { root: null, rootMargin: `-${stripH}px 0px 0px 0px`, threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isPhone, storyOpen]);

  const featured = featuredStory;
  const featuredLocations = featured?.analysis?.locations?.filter(l => l?.lat != null && l?.lng != null) ?? [];

  // Fly to first location when story changes; draw source arcs + update highlight palette.
  // Fly immediately with the coordinates we already have — don't block on the
  // boundary polygon fetch. The polygon is applied via applyBoundaryPolygon once
  // it arrives so the camera moves on every selection without network latency.
  useEffect(() => {
    if (!featured) return;
    setActiveLocIdx(0);
    const secondaryIsos = featuredLocations.slice(1).map(l => l.iso).filter(Boolean);
    if (featuredLocations.length > 0) {
      const loc = featuredLocations[0];
      flyToLocation({ ...loc });
      updateArcs(featured.articles, loc);
      updateHighlights(secondaryIsos);
      fetchBoundaryPolygon(loc.name, loc.iso).then(polygon => {
        applyBoundaryPolygon(polygon);
      });
    } else {
      geocodeStory(featured).then((coords) => {
        flyToLocation(coords);
        updateArcs(featured.articles, coords);
        updateHighlights(secondaryIsos);
      });
    }
  }, [featured?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Publish the sticky container's rendered height as --map-sticky-height so
  // story cards can use scroll-margin-top to land below the pinned map.
  // Depends on !!featured so it (re-)runs once the sticky div is in the DOM.
  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--map-sticky-height', el.offsetHeight + 'px');
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--map-sticky-height');
    };
  }, [!!featured]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!featured) return null;

  // Semi-transparent control colors (kept as inline styles since they
  // depend on CSS RGB vars).
  const btnBg       = `rgba(var(--bg-secondary-rgb), 0.80)`;
  const textAlpha70 = `rgba(var(--text-primary-rgb), 0.70)`;
  const textAlpha60 = `rgba(var(--text-primary-rgb), 0.60)`;
  const overlayGrad = isDark
    ? 'radial-gradient(ellipse at 52% 48%, rgba(10,13,20,0.3) 0%, rgba(10,13,20,0.75) 100%)'
    : 'radial-gradient(ellipse at 52% 48%, rgba(244,240,232,0.1) 0%, rgba(244,240,232,0.45) 100%)';

  const phoneHeight = `${phoneMapHeight(storyOpen, vh)}px`;
  const containerStyle = expanded
    ? { position: 'fixed', inset: 0, zIndex: 50, width: '100vw', height: '100vh' }
    : {
        height: isPhone ? phoneHeight : 'clamp(220px, 45vh, 560px)',
        zIndex: 20,
        transition: isPhone ? 'height 200ms ease' : undefined,
      };

  const analysisTime = formatAnalysisTime(fetchedAt);
  const nextEdition = isLatest ? (edition === 'evening' ? '7:20 AM' : edition === 'morning' ? '5:20 PM' : '') : '';

  // On phones with a story open and header scrolled away: show title + close
  const stripShowsTitle = isPhone && storyOpen && !storyHeaderVisible;

  // Sober status strip — replaces the chyron + ticker + LIVE badge.
  const statusStrip = (
    <div
      className="w-full flex items-center justify-between"
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-primary)',
        borderBottom: '1px solid var(--border-primary)',
        padding: isPhone ? '0px clamp(12px, 3%, 16px)' : '8px clamp(12px, 3%, 24px)',
        minHeight: isPhone ? 44 : undefined,
      }}
    >
      {stripShowsTitle ? (
        <>
          <span
            className="truncate"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, flex: 1, marginRight: 8 }}
          >
            {openStoryTitle}
          </span>
          <button
            onClick={onCloseStory}
            aria-label="Close story"
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
          >
            ×
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="font-display font-black tracking-[3px] uppercase shrink-0"
              style={{ color: 'var(--text-primary)', fontSize: 12 }}
            >
              The Meridian
            </span>
            {!isPhone && edition && edition !== 'manual' && EDITION_LABELS[edition] && (
              <span className={`flex items-center gap-3 shrink-0${availableEditions.length > 1 ? ' hero-edition-tag' : ''}`}>
                <span style={{ color: 'var(--border-dim)' }}>·</span>
                <span
                  className="uppercase"
                  style={{ color: 'var(--accent)', fontSize: 11, letterSpacing: '1.5px', fontWeight: 600 }}
                >
                  {EDITION_LABELS[edition]}
                </span>
              </span>
            )}
            {!isPhone && selectedDate && (
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
                      ...(isPhone ? { height: 32, lineHeight: '32px' } : {}),
                    }}
                  >
                    {EDITION_LABELS[e] ?? e}
                  </button>
                ))}
              </div>
            )}
            {!isPhone && analysisTime && (
              <span
                className="hero-clock"
                style={{ color: 'var(--label)', fontFamily: 'var(--font-label)', fontSize: 11 }}
              >
                Analysis run at {analysisTime}
                {nextEdition && ` · Next edition around ${nextEdition}`}
              </span>
            )}
            <GearButton onClick={onOpenSettings} />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div ref={stickyRef} style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)' }}>
      {!mapVisible && (
        <div
          className="w-full flex items-center justify-between px-4"
          style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--hero-border)', height: 44, zIndex: 20 }}
        >
          <span
            className="font-display font-black tracking-[3px] uppercase"
            style={{ color: 'var(--text-primary)', fontSize: 11 }}
          >
            The Meridian
          </span>
          <div className="flex items-center gap-2">
          <button
            onClick={() => onMapVisibleChange(true)}
            className="cursor-pointer transition-all"
            style={{ color: 'var(--accent)', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', background: 'none', border: 'none', padding: '0 4px' }}
          >
            Show Map ▼
          </button>
          <GearButton onClick={onOpenSettings} />
          </div>
        </div>
      )}

      {/* Map container */}
      <div
        className="relative w-full overflow-hidden hero-aspect-container"
        style={{ ...containerStyle, display: mapVisible ? '' : 'none' }}
      >
        <div ref={mapContainer} className="absolute inset-0" style={{ opacity: 1, width: '100%', height: '100%' }} />

        {!mapEnabled && (
          <div className="absolute inset-0" style={{ background: 'var(--bg-primary)' }} />
        )}

        {mapEnabled && <div className="absolute inset-0 pointer-events-none" style={{ background: overlayGrad }} />}

        {/* On phones the inline map is not interactive — tap anywhere to go fullscreen */}
        {isPhone && !expanded && (
          <div
            className="absolute inset-0"
            style={{ zIndex: 5, cursor: 'pointer' }}
            onClick={() => setExpanded(true)}
            aria-label="Expand map"
            role="button"
          />
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
                  flyToLocation({ ...loc });
                  fetchBoundaryPolygon(loc.name, loc.iso).then(polygon => {
                    applyBoundaryPolygon(polygon);
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
          {!isPhone && ['+', '−'].map((label, i) => (
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
            onClick={() => setExpanded(e => !e)}
            title={expanded ? 'Exit fullscreen' : 'Expand map'}
            className="cursor-pointer transition-all"
            style={{
              background: btnBg,
              border: '1px solid var(--hero-border)',
              color: textAlpha70,
              fontSize: isPhone ? 17 : 'clamp(12px, 1.3vw, 17px)',
              width: isPhone ? 44 : 'clamp(28px, 3vw, 40px)',
              height: isPhone ? 44 : 'clamp(28px, 3vw, 40px)',
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
