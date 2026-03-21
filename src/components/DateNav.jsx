import { Sun, Moon } from 'lucide-react';

export default function DateNav({ availableDates, selectedDate, selectedEdition, onSelect }) {
  if (!availableDates.length) return null;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  function label(date) {
    if (date === today) return 'Today';
    if (date === yesterday) return 'Yesterday';
    return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    });
  }

  return (
    <div className="border-b border-[#1a2035] bg-[#0a0d14]">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex gap-1.5 overflow-x-auto py-2.5" style={{ scrollbarWidth: 'none' }}>
          {availableDates.slice(0, 28).flatMap(({ date, editions }) =>
            editions.map(edition => {
              const active = date === selectedDate && edition === selectedEdition;
              return (
                <button
                  key={`${date}-${edition}`}
                  onClick={() => onSelect(date, edition)}
                  className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-[#e8c547] text-[#0a0d14] font-semibold'
                      : 'text-[#6b7a9a] hover:text-[#f0ebe0] hover:bg-[#1a2035]'
                  }`}
                >
                  {edition === 'morning' && <Sun className="w-3 h-3" />}
                  {edition === 'evening' && <Moon className="w-3 h-3" />}
                  {label(date)}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
