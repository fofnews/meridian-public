import fs from 'fs';
import path from 'path';

const ARTICLES_DIR = path.join(process.cwd(), 'articles');

const CATEGORIES = ['Politics', 'International', 'Business', 'Crime', 'Health', 'Environment', 'Tech', 'Sports', 'Entertainment'];
const CATEGORY_KEYWORDS = {
  Sports: [
    'nfl', 'nba', 'mlb', 'nhl', 'ncaa', 'fifa', 'nascar', 'ufc', 'espn',
    'football', 'basketball', 'baseball', 'hockey', 'soccer', 'tennis', 'golf',
    'olympic', 'athlete', 'championship', 'tournament', 'playoff', 'league',
    'coach', 'roster', 'draft', 'trade', 'score', 'game', 'match', 'stadium',
    'march madness', 'sweet 16', 'final four', 'opening day', 'world series',
    'super bowl', 'nba finals', 'stanley cup', 'transfer portal', 'sportsbook',
    'betting odds', 'picks', 'mets', 'yankees', 'knicks', 'lakers', 'patriots',
    'pirates', 'braves', 'cubs', 'dodgers', 'celtics', 'warriors', 'nets',
    'mvp', 'all-star', 'inning', 'pitcher', 'quarterback', 'touchdown',
    'three-pointer', 'overtime', 'standings', 'bracket', 'seed', 'bout',
  ],
  Entertainment: [
    'movie', 'film', 'music', 'album', 'song', 'celebrity', 'actor', 'actress',
    'director', 'hollywood', 'netflix', 'disney', 'hbo', 'emmy', 'grammy',
    'oscar', 'concert', 'tour', 'streaming', 'box office', 'tv show', 'series',
    'podcast', 'youtube', 'tiktok', 'influencer', 'fashion', 'award',
  ],
  Tech: [
    'ai', 'artificial intelligence', 'software', 'app', 'startup', 'google',
    'apple', 'microsoft', 'meta', 'amazon', 'openai', 'tesla', 'spacex',
    'cyber', 'hack', 'data breach', 'privacy', 'algorithm', 'robot', 'quantum',
    'semiconductor', 'chip', 'silicon valley', 'cryptocurrency', 'bitcoin',
    'blockchain', 'tech', 'gadget', 'iphone', 'android',
  ],
  International: [
    'ukraine', 'russia', 'china', 'iran', 'israel', 'gaza', 'nato', 'europe',
    'european union', 'middle east', 'africa', 'asia', 'latin america',
    'united nations', 'un ', 'foreign', 'diplomat', 'sanctions', 'treaty',
    'taiwan', 'north korea', 'india', 'pakistan', 'syria', 'iraq', 'war',
    'ceasefire', 'airstrike', 'missile', 'refugee',
  ],
  Business: [
    'stock', 'market', 'wall street', 'nasdaq', 's&p', 'dow jones', 'fed ',
    'federal reserve', 'interest rate', 'inflation', 'recession', 'gdp',
    'earnings', 'revenue', 'profit', 'ipo', 'merger', 'acquisition', 'trade war',
    'tariff', 'economy', 'economic', 'unemployment', 'jobs report', 'retail',
    'bank', 'finance', 'investment', 'hedge fund', 'ceo', 'layoff',
  ],
  Crime: [
    'murder', 'killed', 'shooting', 'stabbing', 'arrested', 'charged', 'indicted',
    'verdict', 'trial', 'prison', 'sentence', 'conviction', 'acquitted', 'suspect',
    'police', 'fbi investigation', 'crime', 'fraud', 'theft', 'robbery', 'assault',
    'kidnap', 'missing', 'homicide', 'detective', 'prosecutor', 'defendant',
  ],
  Health: [
    'fda', 'cdc', 'who ', 'vaccine', 'disease', 'virus', 'pandemic', 'outbreak',
    'cancer', 'drug', 'treatment', 'hospital', 'health care', 'healthcare',
    'medicare', 'medicaid', 'opioid', 'mental health', 'surgery', 'clinical trial',
    'study finds', 'research shows', 'scientists', 'medical', 'patient', 'doctor',
  ],
  Environment: [
    'climate', 'wildfire', 'hurricane', 'tornado', 'flood', 'drought', 'earthquake',
    'emissions', 'carbon', 'epa', 'fossil fuel', 'renewable', 'solar', 'wind energy',
    'deforestation', 'species', 'ocean', 'glacier', 'temperature record',
    'extreme weather', 'natural disaster', 'pollution', 'plastic',
  ],
  Politics: [
    'congress', 'senate', 'house', 'president', 'election', 'vote', 'democrat',
    'republican', 'legislation', 'bill passed', 'white house', 'federal',
    'supreme court', 'justice', 'trump', 'biden', 'harris', 'gop', 'campaign',
    'governor', 'mayor', 'policy', 'administration', 'cabinet', 'doj', 'fbi',
    'cia', 'pentagon', 'budget', 'tax', 'immigration', 'border',
  ],
};

const URL_PATH_CATEGORIES = {
  Sports:        ['sports', 'nba', 'nfl', 'mlb', 'nhl', 'ncaa', 'soccer', 'golf', 'tennis', 'mma', 'boxing', 'olympics'],
  Entertainment: ['entertainment', 'movies', 'music', 'celebrity', 'arts', 'culture', 'tv', 'film', 'gaming'],
  Tech:          ['tech', 'technology', 'science', 'space', 'gadgets', 'ai', 'cybersecurity'],
  Business:      ['business', 'finance', 'economy', 'markets', 'money', 'real-estate'],
  Crime:         ['crime', 'legal', 'justice', 'law'],
  Health:        ['health', 'medical', 'wellness', 'fitness'],
  Environment:   ['environment', 'climate', 'energy', 'weather'],
  Politics:      ['politics', 'government', 'elections', 'policy', 'congress', 'white-house'],
  International: ['world', 'international', 'global', 'foreign'],
};

function categorize(title, article = {}) {
  for (const cat of CATEGORIES) {
    const catLower = cat.toLowerCase();
    if ((article.categories || []).some(c =>
      c.includes(catLower) || CATEGORY_KEYWORDS[cat].some(k => c.includes(k))
    )) return cat;
  }
  const urlPath = (article.link || '').toLowerCase();
  for (const [cat, slugs] of Object.entries(URL_PATH_CATEGORIES)) {
    if (slugs.some(s => urlPath.includes(`/${s}/`) || urlPath.includes(`/${s}-`))) return cat;
  }
  const t = title.toLowerCase();
  for (const cat of CATEGORIES) {
    if (CATEGORY_KEYWORDS[cat].some(k => t.includes(k))) return cat;
  }
  return 'Other';
}

export default function handler(req, res) {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  const articles = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, `${date}.json`), 'utf8')); }
    catch { return null; }
  })();
  if (!articles) return res.status(404).json({ error: 'No articles for this date' });

  const grouped = {};
  for (const article of articles) {
    const cat = categorize(article.title || '', article);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(article);
  }
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => new Date(b.pubDate || b.collectedAt) - new Date(a.pubDate || a.collectedAt));
  }

  res.json({ date, categories: grouped, total: articles.length });
}
