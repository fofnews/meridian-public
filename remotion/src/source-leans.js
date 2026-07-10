// Political lean per source: 'left' | 'center' | 'right'
// Ratings based on AllSides Media Bias Ratings (allsides.com/media-bias/ratings).
// Keep in sync with lean fields in my-news-analyzer-pipeline/server/rss.js.
export const SOURCE_LEANS = {
  // Left
  'CNN':               'left',
  'NPR':               'left',
  'ABC News':          'left',
  'CBS News':          'left',
  'NY Times':          'left',
  'NBC News':          'left',
  'Washington Post':   'left',
  'Newsweek':          'left',
  'Politico':          'left',
  // Center
  'BBC News':          'center',
  'Al Jazeera':        'center',
  'Reuters':           'center',
  'AP News':           'center',
  'The Hill':          'center',
  'The Free Press':    'center',
  // Right
  'Wall Street Journal': 'right',
  'Fox News':          'right',
  'New York Post':     'right',
  'Washington Examiner': 'right',
  'National Review':   'right',
  'Newsmax':           'right',
  'Epoch Times':       'right',
};
