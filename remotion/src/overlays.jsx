// remotion/src/overlays.jsx
import { useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from 'remotion';
import { tokenizeWords, getActiveWord, tokenizeSentences, getActiveSentence } from './subtitles.js';
import { arcTokenPosition } from './broadcast-map.js';
import { ACCENT, ACCENT_TEXT, TEXT_60, TEXT_55, CHYRON_UPPER, CHYRON_LOWER, BORDER_ACTIVE } from './tokens.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncateHeadline(headline, maxLen = 72) {
  if (!headline) return '';
  return headline.length <= maxLen ? headline : headline.slice(0, maxLen - 1) + '…';
}

// Linear congruential generator — deterministic pseudo-random from a seed.
function seededRandom(seed) {
  let s = seed | 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── RemotionFilmGrain ─────────────────────────────────────────────────────────

export function RemotionFilmGrain({ opacity = 0.055 }) {
  const frame = useCurrentFrame();
  const canvasRef = useRef(null);
  const sizedRef  = useRef(false);

  // Size the canvas once on mount (full resolution / 4 for coarse grain).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sizedRef.current) return;
    canvas.width  = Math.max(1, Math.ceil(canvas.offsetWidth  / 4));
    canvas.height = Math.max(1, Math.ceil(canvas.offsetHeight / 4));
    sizedRef.current = true;
  }, []);

  // Draw new grain on every Remotion frame — deterministic via seeded RNG.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return;
    const ctx = canvas.getContext('2d');
    const rand = seededRandom(frame * 2654435761 + 1);
    const img  = ctx.createImageData(canvas.width, canvas.height);
    const d    = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (rand() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [frame]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        opacity,
        mixBlendMode: 'overlay',
        imageRendering: 'pixelated',
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Chyron ────────────────────────────────────────────────────────────────────

// Returns the shot active at time t (seconds, already includes pre-roll offset).
function activeShotAt(shots, t, preRollS) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const start = preRollS + shots[i].t;
    const end   = start + shots[i].hold;
    if (t >= start && t < end) return shots[i];
  }
  return null;
}

export function Chyron({ shots, t, preRollS, durationInFrames }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shot = activeShotAt(shots, t, preRollS);

  if (!shot) return null;

  const shotStart = preRollS + shot.t;
  const shotEnd   = shotStart + shot.hold;

  // Fade in over 0.3s, fade out over 0.3s
  const fadeFrames = Math.round(0.3 * fps);
  const startFrame = Math.round(shotStart * fps);
  const endFrame   = Math.round(shotEnd   * fps);

  const opacity = interpolate(
    frame,
    [startFrame, startFrame + fadeFrames, endFrame - fadeFrames, endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity, zIndex: 10 }}>
      {/* Upper bar: label chip + headline */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        background: CHYRON_UPPER,
        borderTop: `2px solid ${BORDER_ACTIVE}`,
        padding: '8px 3%',
      }}>
        <div style={{
          background: ACCENT, color: ACCENT_TEXT,
          fontFamily: 'Source Serif 4, serif',
          fontWeight: 600, fontSize: 10,
          letterSpacing: 2, textTransform: 'uppercase',
          whiteSpace: 'nowrap', padding: '3px 10px',
          flexShrink: 0,
        }}>
          {shot.chyron.label}
        </div>
        <div style={{
          fontFamily: 'Playfair Display, serif',
          fontWeight: 700, fontSize: 20,
          color: 'var(--text-primary)', letterSpacing: 0.3,
        }}>
          {truncateHeadline(shot.chyron.headline)}
        </div>
      </div>
      {/* Lower bar: meta */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: CHYRON_LOWER,
        padding: '5px 3%',
      }}>
        <div style={{ color: TEXT_60, fontSize: 12, letterSpacing: 0.8 }}>
          Meridian Analysis
        </div>
        <div style={{ color: 'var(--accent)', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {shot.chyron.edition ?? ''}
        </div>
      </div>
    </div>
  );
}

// ── Ticker ────────────────────────────────────────────────────────────────────

export function Ticker({ shots }) {
  const tickerText = shots.map(s => truncateHeadline(s.chyron.headline, 80)).join('  ·  THE MERIDIAN  ·  ');
  const text = `THE MERIDIAN  ·  ${tickerText}  ·  THE MERIDIAN  ·  ${tickerText}`;

  return (
    <div style={{
      background: ACCENT, padding: '5px 0', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .remotion-ticker {
          display: inline-block;
          white-space: nowrap;
          animation: ticker-scroll 120s linear infinite;
          color: ${ACCENT_TEXT};
          font-family: 'Source Serif 4', serif;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }
      `}</style>
      <div className="remotion-ticker">{text}</div>
    </div>
  );
}

// ── TopBar (wordmark + date) ──────────────────────────────────────────────────

export function TopBar({ edition, t }) {
  const [dateStr] = formatBroadcastTime(edition, t);
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '2% 3%', zIndex: 10,
    }}>
      <div style={{
        fontFamily: 'Playfair Display, serif', fontWeight: 900,
        color: 'var(--text-primary)', fontSize: 26,
        letterSpacing: 3, textTransform: 'uppercase',
      }}>
        The Meridian
      </div>
      <div style={{ color: TEXT_55, fontSize: 11, letterSpacing: 1, fontFamily: 'Source Serif 4, serif' }}>
        {dateStr}
      </div>
    </div>
  );
}

function formatBroadcastTime(edition, t) {
  // edition format: "YYYY-MM-DD-{morning|evening}"
  const parts = (edition ?? '').split('-');
  const datepart = parts.slice(0, 3).join('-');
  const slot = parts[3] ?? 'evening';
  const baseHour = slot === 'morning' ? 7 : 17;
  const d = new Date(`${datepart}T${String(baseHour).padStart(2, '0')}:00:00`);
  d.setSeconds(d.getSeconds() + Math.floor(t));
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return [dateStr, timeStr];
}

// ── Attribution ───────────────────────────────────────────────────────────────

export function MapAttribution({ aspect = '16:9' }) {
  return (
    <div style={{
      position: 'absolute', bottom: mapAttributionBottom(aspect), left: 10, zIndex: 10,
      color: 'rgba(240,235,224,0.30)', fontSize: 8,
      letterSpacing: 0.4, pointerEvents: 'none',
      fontFamily: 'Source Serif 4, serif',
    }}>
      © Mapbox · © OpenStreetMap
    </div>
  );
}

// ── FadeOverlay (pre-roll / post-roll black) ──────────────────────────────────

export function FadeOverlay({ durationInFrames, preRollS, postRollS }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const preFrames  = Math.round(preRollS  * fps);
  const postStart  = durationInFrames - Math.round(postRollS * fps);

  const opacity = interpolate(
    frame,
    [0, preFrames, postStart, durationInFrames],
    [1,          0,         0,               1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: '#000', opacity, pointerEvents: 'none',
    }} />
  );
}

// ── Aspect-aware helpers ──────────────────────────────────────────────────────

export function subtitleFontSize(aspect) {
  return aspect === '9:16' ? 60 : 40;
}

export function quoteCalloutHorizontal(aspect) {
  return aspect === '9:16'
    ? { left: '50%', transform: 'translateX(-50%)' }
    : { left: '5%' };
}

export function mapAttributionBottom(aspect) {
  return aspect === '9:16' ? 100 : 8;
}

// ── SubtitleBar ───────────────────────────────────────────────────────────────

export function SubtitleBar({ shots, timestamps, t, preRollS = 1, aspect = '16:9' }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find active shot index.
  let activeShotIdx = 0;
  for (let i = 0; i < shots.length; i++) {
    if (shots[i].t + preRollS <= t) activeShotIdx = i;
  }
  const activeShot = shots[activeShotIdx];

  const ts    = timestamps?.[activeShotIdx] ?? null;
  const words = tokenizeWords(ts);
  if (words.length === 0) return null;

  const tInShot   = t - (activeShot.t + preRollS);
  const activeIdx = getActiveWord(words, tInShot);
  if (activeIdx < 0) return null;

  const sentences = tokenizeSentences(words);
  const activeSentenceIdx = getActiveSentence(sentences, activeIdx);
  if (activeSentenceIdx < 0) return null;
  const activeSentence = sentences[activeSentenceIdx];

  // Fade in/out at shot boundary (9 frames).
  const FADE = 9;
  const shotStartFrame = Math.round((preRollS + activeShot.t) * fps);
  const shotEndFrame   = Math.round((preRollS + activeShot.t + activeShot.hold) * fps);
  const opacity = interpolate(
    frame,
    [shotStartFrame, shotStartFrame + FADE, shotEndFrame - FADE, shotEndFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)',
      zIndex: 12, pointerEvents: 'none', opacity,
      background: 'rgba(10,13,20,0.75)', borderRadius: 4, padding: '10px 28px',
      maxWidth: '80%',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'center' }}>
        {activeSentence.words.map((w, wi) => {
          const globalIdx = activeSentence.startWordIdx + wi;
          return (
            <span key={globalIdx} style={{
              fontFamily: 'Source Serif 4, serif',
              fontSize: subtitleFontSize(aspect),
              fontWeight: globalIdx === activeIdx ? 600 : 400,
              color: globalIdx === activeIdx ? ACCENT : 'rgba(240,235,224,0.75)',
            }}>{w.text}</span>
          );
        })}
      </div>
    </div>
  );
}

// ── DataCallout ───────────────────────────────────────────────────────────────

export function dataCalloutOpacity(frame, fromFrame, durationFrames, fadeFrames = 9) {
  return interpolate(
    frame,
    [fromFrame, fromFrame + fadeFrames, fromFrame + durationFrames - fadeFrames, fromFrame + durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
}

export function DataCallout({ text, fromFrame, durationFrames, fadeFrames = 9 }) {
  const frame = useCurrentFrame();

  const opacity = dataCalloutOpacity(frame, fromFrame, durationFrames, fadeFrames);

  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 110,
      left: '50%',
      transform: 'translateX(-50%)',
      opacity,
      zIndex: 15,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(10,13,20,0.82)',
        borderRadius: 6,
        padding: '16px 32px',
        borderTop: `2px solid ${BORDER_ACTIVE}`,
        textAlign: 'center',
      }}>
        <div style={{
          color: ACCENT,
          fontFamily: 'Source Serif 4, serif',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          DATA
        </div>
        <div style={{
          color: ACCENT,
          fontFamily: 'Playfair Display, serif',
          fontSize: 64,
          fontWeight: 900,
          lineHeight: 1,
        }}>
          {text}
        </div>
      </div>
    </div>
  );
}

// ── QuoteCallout ──────────────────────────────────────────────────────────────

export function QuoteCallout({ text, fromFrame, durationFrames, fadeFrames = 9, aspect = '16:9' }) {
  const frame = useCurrentFrame();
  const opacity = dataCalloutOpacity(frame, fromFrame, durationFrames, fadeFrames);
  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      ...quoteCalloutHorizontal(aspect),
      bottom: 140,
      maxWidth: '45%',
      opacity,
      zIndex: 15,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(10,13,20,0.88)',
        borderRadius: 6,
        padding: '20px 28px',
        borderLeft: `3px solid ${ACCENT}`,
      }}>
        <div style={{
          color: ACCENT,
          fontSize: 40,
          fontFamily: 'Playfair Display, serif',
          lineHeight: 1,
          marginBottom: 6,
          opacity: 0.65,
        }}>"</div>
        <div style={{
          color: 'rgba(240,235,224,0.92)',
          fontSize: 18,
          fontFamily: 'Playfair Display, serif',
          fontStyle: 'italic',
          lineHeight: 1.5,
        }}>{text}</div>
      </div>
    </div>
  );
}

// ── SourceCompareBar ──────────────────────────────────────────────────────────

// Deterministic per-source accent colors — ordered by rough political/geographic
// grouping so adjacent segments are visually distinct.
const SOURCE_BAR_COLORS = {
  'AP News':             '#4a9fd4',
  'Reuters':             '#62c4a0',
  'BBC News':            '#c44f4f',
  'Al Jazeera':          '#d4944a',
  'NY Times':            '#8fa8d8',
  'Washington Post':     '#7a9ec0',
  'Wall Street Journal': '#c8a44a',
  'Fox News':            '#d46b4a',
  'New York Post':       '#d48a4a',
  'NBC News':            '#7ab8e8',
  'ABC News':            '#5a9cc8',
  'CBS News':            '#4a8ab8',
  'NPR':                 '#a0c880',
  'The Hill':            '#9090c0',
  'Washington Examiner': '#c08060',
  'Newsweek':            '#a870a0',
  'Newsmax':             '#e07050',
  'National Review':     '#d08050',
  'Politico':            '#8080c0',
  'Epoch Times':         '#c0a060',
  'The Free Press':      '#90b890',
};

const FALLBACK_PALETTE = ['#4a9fd4','#62c4a0','#c44f4f','#d4944a','#8fa8d8','#7a9ec0','#a0c880','#9090c0'];

function sourceBarColor(name, idx) {
  return SOURCE_BAR_COLORS[name] ?? FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

// counts  — object mapping source name → article count, e.g. { 'AP News': 4, 'Reuters': 2 }
export function SourceCompareBar({ counts, fromFrame, durationFrames, fadeFrames = 9, aspect = '16:9' }) {
  const frame   = useCurrentFrame();
  const opacity = dataCalloutOpacity(frame, fromFrame, durationFrames, fadeFrames);
  if (opacity === 0 || !counts) return null;

  const entries = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);  // cap at 10 sources for legibility

  if (entries.length === 0) return null;

  const total = entries.reduce((s, [, n]) => s + n, 0);

  return (
    <div style={{
      position: 'absolute',
      bottom: aspect === '9:16' ? 420 : 160,
      left: '50%',
      transform: 'translateX(-50%)',
      opacity,
      zIndex: 14,
      pointerEvents: 'none',
      width: aspect === '9:16' ? '75%' : '55%',
    }}>
      <div style={{
        background: 'rgba(10,13,20,0.82)',
        borderRadius: 4,
        padding: '10px 16px',
        borderTop: `1px solid rgba(232,197,71,0.30)`,
      }}>
        {/* Label */}
        <div style={{
          color: 'rgba(240,235,224,0.45)',
          fontFamily: 'Source Serif 4, serif',
          fontSize: 8,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          Source Coverage
        </div>
        {/* Stacked bar */}
        <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
          {entries.map(([name, count], i) => (
            <div key={name} style={{
              flexBasis: `${(count / total) * 100}%`,
              background: sourceBarColor(name, i),
              flexShrink: 0,
              flexGrow: 0,
            }} title={name} />
          ))}
        </div>
        {/* Legend — top 5 sources */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 6 }}>
          {entries.slice(0, 5).map(([name, count], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: sourceBarColor(name, i), flexShrink: 0 }} />
              <span style={{
                color: 'rgba(240,235,224,0.60)',
                fontFamily: 'Source Serif 4, serif',
                fontSize: 8,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>{name} ({count})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ArcTokens ────────────────────────────────────────────────────────────────

// Renders animated dots along great-circle arcs in screen space by calling
// mapRef.current.project([lng, lat]) each frame. mapRef must be a React ref
// holding the Mapbox map instance.
//
// arcs          — GeoJSON FeatureCollection of LineString arcs (from buildArcsGeoJSON)
// fromFrame     — absolute frame offset this overlay is active
// durationFrames— how long to show (matches the shot hold duration)
// mapRef        — React ref to the Mapbox map instance (passed from Broadcast.jsx)
export function ArcTokens({ arcs, fromFrame, durationFrames, mapRef }) {
  const frame   = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relFrame = frame - fromFrame;
  if (relFrame < 0 || relFrame >= durationFrames) return null;
  if (!arcs?.features?.length || !mapRef?.current) return null;

  const PERIOD_S    = 2.5;
  const periodFrames = Math.round(PERIOD_S * fps);

  const tokens = arcs.features.map((feat, fi) => {
    const t = (relFrame % periodFrames) / periodFrames;
    const [lng, lat] = arcTokenPosition(feat, t);
    try {
      const pt = mapRef.current.project([lng, lat]);
      return { key: fi, x: pt.x, y: pt.y, valid: true };
    } catch {
      return { key: fi, x: 0, y: 0, valid: false };
    }
  }).filter(tok => tok.valid);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 13 }}>
      {tokens.map(({ key, x, y }) => (
        <div key={key} style={{
          position: 'absolute',
          left: x - 4,
          top:  y - 4,
          width:  8,
          height: 8,
          borderRadius: '50%',
          background: ACCENT,
          boxShadow: `0 0 6px rgba(232,197,71,0.8)`,
        }} />
      ))}
    </AbsoluteFill>
  );
}

// ── Simple intent-category overlays ──────────────────────────────────────────
// Used when the intent classifier emits 'comparison', 'escalation', or 'context'.

export function ComparisonOverlay({ textA, textB, labelA, labelB, fromFrame, durationFrames, fadeFrames = 9 }) {
  const frame   = useCurrentFrame();
  const opacity = dataCalloutOpacity(frame, fromFrame, durationFrames, fadeFrames);
  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 160,
      left: '50%',
      transform: 'translateX(-50%)',
      opacity,
      zIndex: 14,
      pointerEvents: 'none',
      display: 'flex',
      gap: 12,
    }}>
      {[{ label: labelA, text: textA }, { label: labelB, text: textB }].map(({ label, text }) => (
        <div key={label} style={{
          background: 'rgba(10,13,20,0.82)',
          borderRadius: 4,
          padding: '10px 20px',
          borderTop: `2px solid ${BORDER_ACTIVE}`,
          textAlign: 'center',
          minWidth: 160,
        }}>
          <div style={{
            color: 'rgba(240,235,224,0.45)',
            fontFamily: 'Source Serif 4, serif',
            fontSize: 8,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>{label}</div>
          <div style={{
            color: ACCENT,
            fontFamily: 'Playfair Display, serif',
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1,
          }}>{text}</div>
        </div>
      ))}
    </div>
  );
}

export function EscalationOverlay({ text, fromFrame, durationFrames, fadeFrames = 9 }) {
  const frame   = useCurrentFrame();
  const opacity = dataCalloutOpacity(frame, fromFrame, durationFrames, fadeFrames);
  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 160,
      left: '50%',
      transform: 'translateX(-50%)',
      opacity,
      zIndex: 14,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(10,13,20,0.82)',
        borderRadius: 4,
        padding: '10px 24px',
        borderTop: `2px solid rgba(196,79,79,0.70)`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        {/* Upward arrow indicator */}
        <div style={{ color: '#c44f4f', fontSize: 20, lineHeight: 1 }}>▲</div>
        <div style={{
          color: 'rgba(240,235,224,0.85)',
          fontFamily: 'Source Serif 4, serif',
          fontSize: 13,
          letterSpacing: 0.3,
        }}>{text}</div>
      </div>
    </div>
  );
}

export function ContextLabelOverlay({ text, fromFrame, durationFrames, fadeFrames = 9 }) {
  const frame   = useCurrentFrame();
  const opacity = dataCalloutOpacity(frame, fromFrame, durationFrames, fadeFrames);
  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 160,
      left: '4%',
      opacity,
      zIndex: 14,
      pointerEvents: 'none',
      maxWidth: '40%',
    }}>
      <div style={{
        background: 'rgba(10,13,20,0.82)',
        borderRadius: 4,
        padding: '10px 20px',
        borderLeft: `2px solid rgba(232,197,71,0.45)`,
      }}>
        <div style={{
          color: 'rgba(240,235,224,0.45)',
          fontFamily: 'Source Serif 4, serif',
          fontSize: 8,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>Context</div>
        <div style={{
          color: 'rgba(240,235,224,0.80)',
          fontFamily: 'Source Serif 4, serif',
          fontSize: 12,
          lineHeight: 1.5,
        }}>{text}</div>
      </div>
    </div>
  );
}
