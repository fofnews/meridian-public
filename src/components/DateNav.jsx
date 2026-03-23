export default function DateNav({ availableDates, selectedDate, onSelect }) {
  if (!availableDates.length) return null;

  function label(date) {
    return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  return (
    <div className="border-b border-[#1a2035] bg-[#0a0d14]">
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
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-[#e8c547] text-[#0a0d14] font-semibold'
                    : 'text-[#6b7a9a] hover:text-[#f0ebe0] hover:bg-[#1a2035]'
                }`}
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
