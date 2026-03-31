export default function DateNav({ availableDates, selectedDate, onSelect }) {
  if (!availableDates.length) return null;

  function label(date) {
    return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex gap-1.5 overflow-x-auto py-2.5" style={{ scrollbarWidth: 'none' }}>
          {availableDates.slice(0, 28).map(({ date, editions }) => {
            const active = date === selectedDate;
            const bestEdition = editions.includes('evening') ? 'evening'
              : editions.includes('morning') ? 'morning' : 'manual';
            return (
              <button
                key={date}
                onClick={() => onSelect(date, bestEdition)}
                className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
                style={active ? {
                  background: 'var(--accent)',
                  color: 'var(--accent-text)',
                  fontWeight: 600,
                } : {
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--border-primary)'; } }}
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
