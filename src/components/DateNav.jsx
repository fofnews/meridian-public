export default function DateNav({ availableDates, selectedDate, onSelect }) {
  if (!availableDates.length) return null;

  const dates = availableDates.slice(0, 7);
  const count = dates.length;

  function label(date) {
    return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex py-2.5" style={{ gap: `${Math.max(4, 12 - count)}px` }}>
          {dates.map(({ date, editions }) => {
            const active = date === selectedDate;
            const bestEdition = editions.includes('evening') ? 'evening'
              : editions.includes('morning') ? 'morning'
              : editions.includes('articles-only') ? 'articles-only' : 'manual';
            return (
              <button
                key={date}
                onClick={() => onSelect(date, bestEdition)}
                className="rounded-full font-medium transition-all cursor-pointer text-center"
                style={{
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
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-card)'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = ''; } }}
              >
                {label(date)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
