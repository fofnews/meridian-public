import { useEffect, useRef } from 'react';
import { useIsPhone } from '../useIsPhone.js';

export default function DateNav({ availableDates, selectedDate, onSelect }) {
  if (!availableDates.length) return null;

  const dates = availableDates.slice(0, 7);
  const count = dates.length;
  const isPhone = useIsPhone();
  const selectedRef = useRef(null);
  const containerRef = useRef(null);

  // Scroll selected pill into view when it changes or on first render
  useEffect(() => {
    if (!isPhone || !selectedRef.current || !containerRef.current) return;
    const pill = selectedRef.current;
    const container = containerRef.current;
    const pillLeft = pill.offsetLeft;
    const pillRight = pillLeft + pill.offsetWidth;
    const visibleLeft = container.scrollLeft;
    const visibleRight = visibleLeft + container.offsetWidth;
    if (pillLeft < visibleLeft || pillRight > visibleRight) {
      container.scrollTo({ left: pillLeft - 8, behavior: 'smooth' });
    }
  }, [selectedDate, isPhone]);

  function desktopLabel(date) {
    return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function phoneLabel(date) {
    const d = new Date(`${date}T12:00:00`);
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const num = d.getDate();
    return `${day} ${num}`;
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
      <div
        ref={isPhone ? containerRef : null}
        className={isPhone ? 'flex px-2' : 'max-w-5xl mx-auto px-4'}
        style={isPhone
          ? { overflowX: 'auto', scrollbarWidth: 'none', gap: 6, paddingTop: 8, paddingBottom: 8 }
          : undefined}
      >
        <div
          className={isPhone ? 'flex' : 'flex py-2.5'}
          style={isPhone ? { gap: 6 } : { gap: `${Math.max(4, 12 - count)}px` }}
        >
          {dates.map(({ date, editions }) => {
            const active = date === selectedDate;
            const bestEdition = editions.includes('evening') ? 'evening'
              : editions.includes('morning') ? 'morning'
              : editions.includes('articles-only') ? 'articles-only' : 'manual';
            return (
              <button
                key={date}
                ref={active && isPhone ? selectedRef : null}
                onClick={() => onSelect(date, bestEdition)}
                className="rounded-full font-medium transition-all cursor-pointer text-center"
                style={isPhone ? {
                  width: 70,
                  height: 36,
                  flexShrink: 0,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  ...(active ? {
                    background: 'var(--accent)',
                    color: 'var(--accent-text)',
                    fontWeight: 600,
                  } : {
                    color: 'var(--text-muted)',
                  }),
                } : {
                  flex: '1 1 0',
                  minWidth: 0,
                  fontSize: 'clamp(9px, 1.1vw, 12px)',
                  padding: 'clamp(4px, 0.6vw, 6px) clamp(4px, 0.8vw, 12px)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  ...(active ? {
                    background: 'var(--accent)',
                    color: 'var(--accent-text)',
                    fontWeight: 600,
                  } : {
                    color: 'var(--text-muted)',
                  }),
                }}
                onMouseEnter={e => { if (!active && !isPhone) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-card)'; } }}
                onMouseLeave={e => { if (!active && !isPhone) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = ''; } }}
              >
                {isPhone ? phoneLabel(date) : desktopLabel(date)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
