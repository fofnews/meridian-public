import { useState, useEffect } from 'react';

// Preset dot positions for each story slot (cycles if more stories than slots)
const DOT_POSITIONS = [
  { x: '50%', y: '40%' }, // Europe
  { x: '58%', y: '48%' }, // Middle East
  { x: '80%', y: '37%' }, // Asia Pacific
  { x: '22%', y: '42%' }, // North America
  { x: '30%', y: '58%' }, // South America
  { x: '53%', y: '56%' }, // Africa
];

const CHYRON_LABELS = ['Breaking', 'Developing', 'Analysis', 'Report', 'Update', 'Exclusive'];

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

export default function BroadcastHero({ stories, selectedIdx, onSelect, reportDate, edition }) {
  const [time, setTime] = useState('');

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
  if (!featured) return null;

  const dot = DOT_POSITIONS[selectedIdx % DOT_POSITIONS.length];
  const chyronSub = buildChyronSub(featured.analysis);
  const chyronLabel = CHYRON_LABELS[selectedIdx % CHYRON_LABELS.length];
  const sourceCount = new Set(featured.articles.map(a => a.source)).size;

  // Build ticker from all story headlines
  const tickerText = stories
    .map(s => truncateHeadline(s.headline, 80))
    .join('  ·  THE MERIDIAN  ·  ');

  const editionLabel = edition === 'morning' ? '☀  Morning Edition'
    : edition === 'evening' ? '🌙  Evening Edition'
    : '';

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: '16/9', maxHeight: '75vh', minHeight: 280 }}
    >
      {/* Map background */}
      <div className="absolute inset-0 opacity-55 map-zoom">
        <svg viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <rect width="960" height="540" fill="#0d1520" />
          {/* Grid lines */}
          <g stroke="#1e2d45" strokeWidth="0.5" fill="none">
            <line x1="0" y1="90" x2="960" y2="90" />
            <line x1="0" y1="180" x2="960" y2="180" />
            <line x1="0" y1="270" x2="960" y2="270" />
            <line x1="0" y1="360" x2="960" y2="360" />
            <line x1="0" y1="450" x2="960" y2="450" />
            <line x1="96" y1="0" x2="96" y2="540" />
            <line x1="192" y1="0" x2="192" y2="540" />
            <line x1="288" y1="0" x2="288" y2="540" />
            <line x1="384" y1="0" x2="384" y2="540" />
            <line x1="480" y1="0" x2="480" y2="540" />
            <line x1="576" y1="0" x2="576" y2="540" />
            <line x1="672" y1="0" x2="672" y2="540" />
            <line x1="768" y1="0" x2="768" y2="540" />
            <line x1="864" y1="0" x2="864" y2="540" />
          </g>
          {/* Landmasses */}
          <g fill="#16283d" stroke="#1e3350" strokeWidth="0.8">
            <path d="M120,140 L160,120 L220,115 L280,125 L320,140 L340,160 L330,185 L300,195 L260,200 L220,195 L180,185 L145,170 Z" />
            <path d="M350,110 L420,95 L500,100 L560,120 L590,145 L580,170 L550,185 L500,190 L440,185 L390,175 L360,155 Z" />
            <path d="M580,130 L650,115 L720,120 L780,140 L810,165 L800,190 L760,205 L700,210 L640,200 L595,180 Z" />
            <path d="M140,230 L200,215 L270,220 L330,240 L360,265 L350,295 L310,315 L260,320 L200,310 L155,290 L135,265 Z" />
            <path d="M380,220 L460,205 L540,215 L600,240 L625,270 L610,305 L565,325 L500,330 L430,315 L385,290 Z" />
            <path d="M620,210 L700,195 L770,205 L830,230 L850,260 L835,295 L790,315 L730,320 L670,305 L630,275 Z" />
            <path d="M200,350 L270,335 L350,345 L410,370 L425,400 L405,430 L355,445 L290,445 L235,430 L200,405 Z" />
            <path d="M440,340 L520,325 L590,340 L640,365 L650,395 L630,420 L585,435 L520,435 L460,415 L435,385 Z" />
            <path d="M140,430 L190,420 L240,430 L270,455 L260,475 L220,480 L175,475 L145,455 Z" />
            <path d="M680,350 L750,340 L810,355 L840,380 L830,405 L795,415 L750,415 L710,400 L688,375 Z" />
          </g>
          {/* Ocean lines */}
          <g stroke="#0e1c2e" strokeWidth="1.5" fill="none">
            <path d="M50,270 Q200,250 350,270 Q500,290 650,265 Q800,240 950,270" />
            <path d="M0,220 Q150,200 300,215 Q450,230 600,210 Q750,190 960,215" />
            <path d="M0,320 Q150,310 300,325 Q450,340 600,320 Q750,300 960,320" />
          </g>
        </svg>
      </div>

      {/* Dark radial overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 52% 48%, rgba(10,13,20,0.3) 0%, rgba(10,13,20,0.75) 100%)' }}
      />

      {/* CRT scanlines */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      {/* Location ring */}
      <div
        className="absolute w-7 h-7 rounded-full border pointer-events-none transition-all duration-700"
        style={{
          left: dot.x, top: dot.y,
          transform: 'translate(-50%, -50%)',
          borderColor: 'rgba(232,197,71,0.45)',
        }}
      />
      {/* Location dot */}
      <div
        className="absolute w-2.5 h-2.5 rounded-full dot-pulse pointer-events-none transition-all duration-700"
        style={{
          left: dot.x, top: dot.y,
          transform: 'translate(-50%, -50%)',
          background: '#e8c547',
        }}
      />

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
          style={{
            background: '#c0392b',
            color: '#fff',
            fontSize: 'clamp(7px, 0.9vw, 11px)',
            padding: '3px 10px',
          }}
        >
          Live
        </div>
        <div style={{ color: 'rgba(240,235,224,0.55)', fontSize: 'clamp(7px, 0.9vw, 11px)', letterSpacing: 1 }}>
          {time}
        </div>
      </div>

      {/* Story selector (right side) */}
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
        {/* Ticker */}
        <div className="overflow-hidden" style={{ background: '#e8c547', padding: '0.5% 0' }}>
          <div
            className="ticker-scroll inline-block whitespace-nowrap"
            style={{
              color: '#0a0d14',
              fontSize: 'clamp(7px, 0.8vw, 10px)',
              fontWeight: 600,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
            }}
          >
            THE MERIDIAN  ·  {tickerText}  ·  THE MERIDIAN  ·  {tickerText}
          </div>
        </div>

        {/* Headline bar */}
        <div
          className="flex items-center gap-4 px-[3%] py-[1.2%]"
          style={{ background: 'rgba(10,13,20,0.92)', borderTop: '2px solid #e8c547' }}
        >
          <div
            className="shrink-0 font-semibold tracking-[2px] uppercase whitespace-nowrap"
            style={{
              background: '#e8c547',
              color: '#0a0d14',
              fontSize: 'clamp(7px, 0.85vw, 10px)',
              padding: '3px 10px',
            }}
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

        {/* Sub bar */}
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
