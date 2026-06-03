// remotion/src/overlays.jsx
import { useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from 'remotion';
import { tokenizeWords, getActiveWord } from './subtitles.js';

// ── Color constants (dark theme) ──────────────────────────────────────────────
const ACCENT         = '#e8c547';
const ACCENT_TEXT    = '#0a0d14';
const TEXT_60        = 'rgba(240,235,224,0.60)';
const TEXT_55        = 'rgba(240,235,224,0.55)';
const CHYRON_UPPER   = 'rgba(10,13,20,0.92)';
const CHYRON_LOWER   = 'rgba(18,22,36,0.96)';
const BORDER_ACTIVE  = 'rgba(232,197,71,0.70)';

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

// ── TopBar (wordmark + LIVE badge + clock) ────────────────────────────────────

export function TopBar({ edition, t }) {
  // Derive a broadcast time from edition string + elapsed seconds.
  const [dateStr, timeStr] = formatBroadcastTime(edition, t);
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
      <div style={{
        background: '#c0392b', color: '#fff',
        fontFamily: 'Source Serif 4, serif',
        fontWeight: 600, fontSize: 11,
        letterSpacing: 2, textTransform: 'uppercase',
        padding: '3px 10px',
      }}>
        Live
      </div>
      <div style={{ color: TEXT_55, fontSize: 11, letterSpacing: 1, fontFamily: 'Source Serif 4, serif' }}>
        {dateStr}  ·  {timeStr} ET
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

export function MapAttribution() {
  return (
    <div style={{
      position: 'absolute', bottom: 8, left: 10, zIndex: 10,
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

// ── SubtitleBar ───────────────────────────────────────────────────────────────

export function SubtitleBar({ shots, timestamps, t, preRollS = 1 }) {
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

  // Show a window of up to 7 words centred on the current word.
  const winStart = Math.max(0, activeIdx - 3);
  const winEnd   = Math.min(words.length - 1, activeIdx + 3);
  const window   = words.slice(winStart, winEnd + 1);
  const curInWin = activeIdx - winStart;

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
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 12, pointerEvents: 'none', opacity,
      background: 'rgba(10,13,20,0.75)', borderRadius: 4, padding: '8px 20px',
      maxWidth: '80%',
    }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'center' }}>
        {window.map((w, wi) => (
          <span key={winStart + wi} style={{
            fontFamily: 'Source Serif 4, serif',
            fontSize: 20,
            fontWeight: wi === curInWin ? 600 : 400,
            color: wi === curInWin ? ACCENT : 'rgba(240,235,224,0.75)',
          }}>{w.text}</span>
        ))}
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

export function QuoteCallout({ text, fromFrame, durationFrames, fadeFrames = 9 }) {
  const frame = useCurrentFrame();
  const opacity = dataCalloutOpacity(frame, fromFrame, durationFrames, fadeFrames);
  if (opacity === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      left: '5%',
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
