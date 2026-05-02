// Video-side map component. Renders the full broadcast costume —
// chyron (upper + lower bars), red LIVE badge, scrolling gold ticker,
// CRT scanlines — over the kernel-managed map. Item 0d moved this
// chrome here from the website-facing MapHero; the website now uses a
// sober status strip instead.
//
// Item #11 will route ?mode=broadcast to this component and hide the
// surrounding app shell. Item #12 will replace the CRT scanlines with
// a subtle film-grain overlay (scanlines moiré under YouTube/TikTok
// re-encode). Item #4 will push the focus pitch from 30° to 45-60°.
// Until then this component is functionally complete but unrouted.

import { useState, useEffect, useRef } from 'react';
import { decodeText } from '../utils';
import { useTheme } from '../ThemeContext.jsx';
import { useMeridianMap } from '../map/useMeridianMap.js';
import { fetchBoundaryPolygon, geocodeStory } from '../map/geocoding.js';
import { FOCUSED_PITCH_BROADCAST } from '../map/camera.js';

const CHYRON_LABELS = ['Breaking', 'Developing', 'Analysis', 'Report', 'Update', 'Exclusive'];

function buildChyronSub(analysis) {
  if (!analysis) return 'Analysis pending';
  const agreements = analysis.agreements?.length ?? 0;
  const disagreements = analysis.disagreements?.length ?? 0;
  const facts = analysis.facts?.length ?? 0;
  if (facts > 0) return `${facts} reported facts extracted`;
  const parts = [];
  if (agreements > 0) parts.push(`${agreements} source agreement${agreements !== 1 ? 's' : ''}`);
  if (disagreements > 0) parts.push(`${disagreements} disagreement${disagreements !== 1 ? 's' : ''}`);
  return parts.length ? parts.join('  ·  ') : 'Multi-source coverage';
}

function truncateHeadline(headline, maxLen = 72) {
  const decoded = decodeText(headline);
  return decoded.length <= maxLen ? decoded : decoded.slice(0, maxLen - 1) + '…';
}

export default function BroadcastStage({
  stories,
  selectedIdx,
  onSelect,
  edition,
  availableEditions = [],
  onEditionSelect,
}) {
  const { isDark } = useTheme();
  const EDITION_LABELS = { morning: '☀  Morning', evening: '🌙  Evening' };
  const [time, setTime] = useState('');
  const [activeLocIdx, setActiveLocIdx] = useState(0);
  const [mapEnabled] = useState(true); // broadcast always renders the map

  const { mapContainer, mapRef, flyToLocation } = useMeridianMap({
    mapEnabled,
    isDark,
    focusPitch: FOCUSED_PITCH_BROADCAST,
    cinematic: true,
  });

  // Clock — 1s tick so the LIVE chyron clock animates seconds.
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

  const featured = stories[selectedIdx] ?? stories[0];
  const featuredLocations = featured?.analysis?.locations?.filter(l => l?.lat != null && l?.lng != null) ?? [];

  // Fly to first location when story changes. Will be replaced by a
  // shotlist-driven timeline in item #15.
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

  const tickerRef = useRef(null);
  const [tickerDuration, setTickerDuration] = useState(null);
  const TICKER_SPEED_PX_PER_S = 120;

  const tickerText = stories.map(s => truncateHeadline(s.headline, 80)).join('  ·  THE MERIDIAN  ·  ');

  useEffect(() => {
    if (!tickerRef.current) return;
    const el = tickerRef.current;
    const totalDistance = window.innerWidth + el.offsetWidth;
    setTickerDuration(totalDistance / TICKER_SPEED_PX_PER_S);
  }, [tickerText]);

  if (!featured) return null;

  const chyronSub = buildChyronSub(featured.analysis);
  const chyronLabel = CHYRON_LABELS[selectedIdx % CHYRON_LABELS.length];
  const sourceCount = new Set(featured.articles.map(a => a.source)).size;

  // Semi-transparent color helpers
  const btnBg       = `rgba(var(--bg-secondary-rgb), 0.80)`;
  const chyronUpper = `rgba(var(--bg-secondary-rgb), 0.92)`;
  const chyronLower = `rgba(var(--bg-chyron-rgb), 0.96)`;
  const textAlpha35 = `rgba(var(--text-primary-rgb), 0.35)`;
  const textAlpha45 = `rgba(var(--text-primary-rgb), 0.45)`;
  const textAlpha55 = `rgba(var(--text-primary-rgb), 0.55)`;
  const textAlpha60 = `rgba(var(--text-primary-rgb), 0.60)`;
  const overlayGrad = isDark
    ? 'radial-gradient(ellipse at 52% 48%, rgba(10,13,20,0.3) 0%, rgba(10,13,20,0.75) 100%)'
    : 'radial-gradient(ellipse at 52% 48%, rgba(244,240,232,0.1) 0%, rgba(244,240,232,0.45) 100%)';

  // Chyron: upper headline bar + lower meta bar. Both sit beneath the map.
  const chyronContent = (
    <>
      <div
        className="flex items-center gap-4"
        style={{ background: chyronUpper, borderTop: '2px solid var(--hero-border-active)', padding: 'clamp(4px, 1.2%, 10px) 3%' }}
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
        style={{ background: chyronLower, padding: 'clamp(3px, 0.8%, 7px) 3%' }}
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
                onClick={() => onEditionSelect?.(e)}
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
    </>
  );

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
      <div
        className="relative w-full overflow-hidden hero-aspect-container"
        style={{ height: 'clamp(220px, 45vh, 560px)', zIndex: 20 }}
      >
        {/* Mapbox map */}
        <div ref={mapContainer} className="absolute inset-0" style={{ opacity: 1.8, width: '100%', height: '100%' }} />

        {/* Radial overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: overlayGrad }} />

        {/* CRT scanlines — item #12 will replace these with subtle grain
             (scanlines moiré under YouTube/TikTok re-encode). */}
        <div className="absolute inset-0 scanlines pointer-events-none" />

        {/* Top bar: wordmark + LIVE badge + clock */}
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

        {/* Story selector — broadcast mode lets the operator scrub between
             stories during recording; item #15's shotlist will drive this
             automatically and the buttons can disappear under #11. */}
        {stories.length > 1 && (
          <div className="absolute story-selector" style={{ zIndex: 10 }}>
            {stories.slice(0, 6).map((story, i) => (
              <button
                key={story.id}
                onClick={() => onSelect?.(i)}
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
      </div>

      {/* Ticker (gold scrolling band) + chyron (headline + meta bars) */}
      <div>
        <div className="overflow-hidden w-full" style={{ background: 'var(--accent)', padding: '5px 0' }}>
          <div
            ref={tickerRef}
            className="ticker-scroll inline-block whitespace-nowrap"
            style={{ color: 'var(--accent-text)', fontSize: 'clamp(9px, 1vw, 13px)', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', ...(tickerDuration ? { animationDuration: `${tickerDuration}s` } : {}) }}
          >
            THE MERIDIAN  ·  {tickerText}  ·  THE MERIDIAN  ·  {tickerText}
          </div>
        </div>
        {chyronContent}
      </div>
    </div>
  );
}
