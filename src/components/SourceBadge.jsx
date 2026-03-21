// On the dark broadcast background, white-bordered sources get a dark treatment
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
  // Center — dark surface with border on dark bg
  'Al Jazeera':          'bg-[#1e2535] border border-[#3a4560] text-[#c8c0b0]',
  'Reuters':             'bg-[#1e2535] border border-[#3a4560] text-[#c8c0b0]',
  'AP News':             'bg-[#1e2535] border border-[#3a4560] text-[#c8c0b0]',
  'The Hill':            'bg-[#1e2535] border border-[#3a4560] text-[#c8c0b0]',
  'Politico':            'bg-[#1e2535] border border-[#3a4560] text-[#c8c0b0]',
  'The Free Press':      'bg-[#1e2535] border border-[#3a4560] text-[#c8c0b0]',
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

export default function SourceBadge({ source }) {
  const styles = SOURCE_STYLES[source] || 'bg-[#2a3040] text-[#c8c0b0]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles}`}>
      {source}
    </span>
  );
}
