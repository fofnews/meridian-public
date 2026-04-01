// Political spectrum source styles
// Center sources use CSS variables so they adapt to light/dark theme
const SOURCE_STYLES = {
  // Left — blues
  'NY Times':            'bg-[#1a4e8c] text-white',
  'Washington Post':     'bg-[#1a4e8c] text-white',
  'NPR':                 'bg-[#2563a8] text-white',
  'CNN':                 'bg-[#2563a8] text-white',
  'ABC News':            'bg-[#2d72c4] text-white',
  'CBS News':            'bg-[#2d72c4] text-white',
  'NBC News':            'bg-[#3b82d4] text-white',
  'BBC News':            'bg-[#3b82d4] text-white',
  'Newsweek':            'bg-[#5b9fd4] text-white',
  // Center-Right
  'Wall Street Journal': 'bg-[#5c2020] text-[#f5c5c5]',
  // Right — reds
  'Newsmax':             'bg-[#e05555] text-white',
  'National Review':     'bg-[#cc2828] text-white',
  'Washington Examiner': 'bg-[#b81818] text-white',
  'New York Post':       'bg-[#a00808] text-white',
  'Fox News':            'bg-[#820000] text-white',
  'Epoch Times':         'bg-[#550000] text-white',
};

// Center sources that should adapt to theme
const CENTER_SOURCES = new Set(['Al Jazeera', 'Reuters', 'AP News', 'The Hill', 'Politico', 'The Free Press']);

export default function SourceBadge({ source }) {
  if (CENTER_SOURCES.has(source)) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        style={{
          background: 'var(--source-center-bg)',
          border: '1px solid var(--source-center-border)',
          color: 'var(--source-center-text)',
        }}
      >
        {source}
      </span>
    );
  }

  const styles = SOURCE_STYLES[source];
  if (!styles) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        style={{
          background: 'var(--source-center-bg)',
          border: '1px solid var(--source-center-border)',
          color: 'var(--source-center-text)',
        }}
      >
        {source}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles}`}>
      {source}
    </span>
  );
}
