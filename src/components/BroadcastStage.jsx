// Video-side map component. Renders the full broadcast costume —
// chyron (upper + lower bars), red LIVE badge, scrolling gold ticker,
// CRT scanlines — over the kernel-managed map. Item 0d moved this
// chrome here from the website-facing MapHero; the website now uses a
// sober status strip instead.
//
// broadcastMode=true (set by App.jsx when ?mode=broadcast): fills the
// full viewport, disables map interaction, enables preserveDrawingBuffer
// and higher pixelRatio for headless capture (item #16), and enforces
// title-safe camera padding (marker in upper 60%, chyron in bottom 20%).
// Item #12 will replace the CRT scanlines with a subtle film-grain overlay.

import { useState, useEffect, useRef } from 'react';
import { decodeText } from '../utils';
import { useTheme } from '../ThemeContext.jsx';
import { useMeridianMap } from '../map/useMeridianMap.js';
import { fetchBoundaryPolygon, geocodeStory } from '../map/geocoding.js';
import { FOCUSED_PITCH_BROADCAST } from '../map/camera.js';
import FilmGrain from './FilmGrain.jsx';

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

const PRE_ROLL_MS  = 1000;
const POST_ROLL_MS = 1000;

export default function BroadcastStage({
  stories,
  selectedIdx,
  onSelect,
  edition,
  availableEditions = [],
  onEditionSelect,
  broadcastMode = false,
  shotlistUrl = null,
}) {
  const { isDark } = useTheme();
  const EDITION_LABELS = { morning: '☀  Morning', evening: '🌙  Evening' };
  const [time, setTime] = useState('');
  const [activeLocIdx, setActiveLocIdx] = useState(0);
  const [mapEnabled] = useState(true); // broadcast always renders the map

  // Shotlist-driven render state (item 15).
  // activeShot overrides chyron label/headline when a shotlist is running.
  // overlayOpacity drives the pre-roll black frame (1) → visible (0) →
  // post-roll fade-to-black (1) sequence.
  const [shotlist, setShotlist]         = useState(null);
  const [activeShot, setActiveShot]     = useState(null);
  const [overlayOpacity, setOverlayOpacity] = useState(
    broadcastMode && shotlistUrl ? 1 : 0
  );

  const { mapContainer, mapRef, flyToLocation, updateArcs, updateHighlights } = useMeridianMap({
    mapEnabled,
    isDark,
    focusPitch: FOCUSED_PITCH_BROADCAST,
    cinematic: true,
    broadcast: broadcastMode,
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

  // Fetch shotlist when URL is provided.
  useEffect(() => {
    if (!shotlistUrl) return;
    fetch(shotlistUrl)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(setShotlist)
      .catch(err => console.error('Shotlist fetch failed:', err));
  }, [shotlistUrl]);

  // Timeline scheduler — fires once the shotlist is loaded.
  // Each shot's t (seconds) maps to an absolute setTimeout delay relative
  // to a shared epoch so shots can't drift relative to each other.
  useEffect(() => {
    if (!shotlist || !broadcastMode) return;

    const ids = [];

    // Pre-roll: fade in after a short grace period for first paint.
    ids.push(setTimeout(() => setOverlayOpacity(0), 50));

    shotlist.shots.forEach(shot => {
      ids.push(setTimeout(() => {
        setActiveShot(shot);

        // Camera: fly to the shot's specified position.
        const loc = {
          lng:  shot.camera.lng,
          lat:  shot.camera.lat,
          zoom: shot.camera.zoom,
          iso:  '',  // no country-highlight in shotlist mode
        };
        flyToLocation(loc);

        // Arcs: match story by headline to get article sources.
        const story = stories.find(s => s.headline === shot.chyron.headline);
        if (story) {
          const locs = story.analysis?.locations?.filter(l => l?.lat != null) ?? [];
          updateArcs(story.articles, loc);
          updateHighlights(locs.slice(1).map(l => l.iso).filter(Boolean));
        }
      }, PRE_ROLL_MS + shot.t * 1000));
    });

    // Post-roll: fade to black, then signal the recorder.
    const endMs = PRE_ROLL_MS + shotlist.duration * 1000;
    ids.push(setTimeout(() => setOverlayOpacity(1), endMs));
    ids.push(setTimeout(() => { window.__meridianClipDone = true; }, endMs + POST_ROLL_MS));

    return () => ids.forEach(clearTimeout);
  }, [shotlist, broadcastMode]);

  const featured = stories[selectedIdx] ?? stories[0];
  const featuredLocations = featured?.analysis?.locations?.filter(l => l?.lat != null && l?.lng != null) ?? [];

  // Fly to first location when story changes. Will be replaced by
  // shotlist-driven timeline in item #15.
  //
  // In broadcastMode the headline geocoder fallback is intentionally
  // skipped: a wrong guess reads as a factual error on video. If
  // analysis.locations is empty the map stays at the ambient globe view.
  useEffect(() => {
    if (!featured) return;
    setActiveLocIdx(0);
    const secondaryIsos = featuredLocations.slice(1).map(l => l.iso).filter(Boolean);
    if (featuredLocations.length > 0) {
      const loc = featuredLocations[0];
      fetchBoundaryPolygon(loc.name, loc.iso).then(polygon => {
        flyToLocation({ ...loc, polygon });
        updateArcs(featured.articles, loc);
        updateHighlights(secondaryIsos);
      });
    } else if (!broadcastMode) {
      geocodeStory(featured).then((coords) => {
        flyToLocation(coords);
        updateArcs(featured.articles, coords);
        updateHighlights(secondaryIsos);
      });
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

  const chyronSub   = buildChyronSub(featured.analysis);
  // Shotlist overrides label/headline so DOM matches camera state each frame.
  const chyronLabel   = activeShot?.chyron.label   ?? CHYRON_LABELS[selectedIdx % CHYRON_LABELS.length].toUpperCase();
  const chyronHeadline = activeShot?.chyron.headline ?? featured.headline;
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
          {truncateHeadline(chyronHeadline, window.innerWidth < 640 ? 45 : 72)}
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

  const outerStyle = broadcastMode
    ? { position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }
    : { position: 'sticky', top: 0, zIndex: 30 };

  const mapHeight = broadcastMode ? 'calc(100vh - 110px)' : 'clamp(220px, 45vh, 560px)';

  return (
    <div style={outerStyle}>
      <div
        className="relative w-full overflow-hidden hero-aspect-container"
        style={{ height: mapHeight, zIndex: 20, flex: broadcastMode ? '1 1 auto' : undefined }}
      >
        {/* Mapbox map */}
        <div ref={mapContainer} className="absolute inset-0" style={{ opacity: 1.8, width: '100%', height: '100%' }} />

        {/* Radial overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: overlayGrad }} />

        {/* Film grain (item 12) — animated canvas noise at 1/4 resolution,
             overlay-blended at low opacity. Coarser than 1px so it survives
             H.264 re-encode; non-periodic so it can't moiré. */}
        <FilmGrain opacity={0.055} />

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

        {/* Story selector — hidden in broadcastMode; item #15's shotlist
             drives the transition automatically. Visible in preview mode
             (broadcastMode=false) so operators can scrub manually. */}
        {stories.length > 1 && !broadcastMode && (
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

        {/* Mapbox attribution — required for recorded video output (item 13).
             Positioned bottom-left, outside the title-safe chyron band. */}
        {broadcastMode && (
          <div
            style={{
              position: 'absolute', bottom: 8, left: 10, zIndex: 10,
              color: 'rgba(240,235,224,0.30)',
              fontSize: 'clamp(5px, 0.55vw, 8px)',
              letterSpacing: '0.4px',
              pointerEvents: 'none',
            }}
          >
            © Mapbox · © OpenStreetMap
          </div>
        )}

        {/* Location buttons — hidden in broadcastMode; camera is driven
             by story data, not operator clicks. */}
        {featuredLocations.length > 1 && !broadcastMode && (
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

      {/* Pre-roll / post-roll black overlay (item 15).
           Starts opaque, fades out at first shot, fades back in after the
           last shot so encoders don't clip the first/last beat.
           transition-duration switches: 0.6 s fade-in, 0.9 s fade-out. */}
      {broadcastMode && overlayOpacity > 0 && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 200,
            background: '#000',
            opacity: overlayOpacity,
            transition: `opacity ${overlayOpacity < 1 ? '0.6s' : '0.9s'} ease`,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
