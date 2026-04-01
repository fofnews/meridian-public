import { useEffect, useState } from 'react';

const CATEGORY_ORDER = ['Politics', 'International', 'Business', 'Crime', 'Health', 'Environment', 'Tech', 'Sports', 'Entertainment', 'Other'];

// Subcategory definitions: keywords checked against title (lowercase), link, and RSS categories
const SUBCATEGORIES = {
  Sports: [
    { label: 'NFL',     keywords: ['nfl', 'super bowl', 'monday night football', 'thursday night football', 'national football league'] },
    { label: 'NBA',     keywords: ['nba', 'nba finals', 'nba draft'] },
    { label: 'MLB',     keywords: ['mlb', 'baseball', 'world series', 'opening day', 'spring training'] },
    { label: 'NHL',     keywords: ['nhl', 'hockey', 'stanley cup'] },
    { label: 'College', keywords: ['ncaa', 'march madness', 'sweet 16', 'final four', 'transfer portal', 'college football', 'college basketball', 'college sports', 'cfp', 'division i'] },
    { label: 'Soccer',  keywords: ['soccer', 'fifa', 'mls', 'premier league', 'champions league', 'world cup', 'la liga', 'bundesliga'] },
    { label: 'Golf',    keywords: ['golf', 'pga', 'masters tournament', 'lpga'] },
    { label: 'Tennis',  keywords: ['tennis', 'wimbledon', 'french open', 'australian open'] },
    { label: 'MMA',     keywords: ['ufc', 'mma', 'boxing', 'heavyweight bout', 'title fight', 'fight night'] },
    { label: 'Olympics',keywords: ['olympic', 'olympics'] },
  ],
  International: [
    { label: 'Middle East', keywords: ['israel', 'gaza', 'iran', 'iraq', 'syria', 'saudi', 'palestine', 'lebanon', 'yemen', 'jordan', 'qatar', 'west bank', 'hezbollah', 'hamas', 'houthi'] },
    { label: 'Europe',      keywords: ['ukraine', 'russia', 'nato', 'european union', 'france', 'germany', 'britain', 'united kingdom', 'poland', 'hungary', 'spain', 'italy', 'brussels', 'kremlin', 'zelensky', 'putin'] },
    { label: 'Asia',        keywords: ['china', 'taiwan', 'north korea', 'south korea', 'japan', 'india', 'pakistan', 'afghanistan', 'myanmar', 'philippines', 'indonesia', 'vietnam', 'beijing', 'xi jinping'] },
    { label: 'Latin America', keywords: ['mexico', 'brazil', 'colombia', 'venezuela', 'cuba', 'argentina', 'chile', 'peru', 'haiti', 'nicaragua', 'guatemala', 'el salvador'] },
    { label: 'Africa',      keywords: ['nigeria', 'kenya', 'south africa', 'ethiopia', 'sudan', 'congo', 'somalia', 'ghana', 'africa', 'sahel'] },
  ],
  Entertainment: [
    { label: 'Movies & TV', keywords: ['movie', 'film', 'netflix', 'disney', 'hbo', 'tv show', 'series', 'oscar', 'emmy', 'box office', 'director', 'actor', 'actress', 'hollywood', 'streaming', 'hulu', 'paramount', 'prime video'] },
    { label: 'Music',       keywords: ['music', 'album', 'song', 'grammy', 'concert', 'tour', 'rapper', 'singer', 'band', 'record label', 'music video', 'debut album'] },
    { label: 'Celebrity',   keywords: ['celebrity', 'kardashian', 'divorce', 'wedding', 'dating', 'pregnant', 'feud', 'scandal', 'red carpet', 'influencer'] },
  ],
  Tech: [
    { label: 'AI',           keywords: ['artificial intelligence', ' ai ', 'openai', 'chatgpt', 'machine learning', 'large language model', 'generative ai', 'llm', 'claude', 'gemini', 'grok', 'ai model', 'ai tool', 'deepseek'] },
    { label: 'Cybersecurity',keywords: ['cyber', 'hack', 'data breach', 'privacy', 'ransomware', 'malware', 'phishing', 'zero day', 'vulnerability', 'scam'] },
    { label: 'Space',        keywords: ['nasa', 'spacex', 'rocket launch', 'satellite', 'mars', ' moon ', 'asteroid', 'space station', 'james webb', 'orbit', 'astronaut'] },
    { label: 'Companies',    keywords: ['apple', 'google', 'microsoft', 'meta', 'amazon', 'tesla', 'startup', 'antitrust', 'silicon valley', 'big tech', 'tech layoff', 'ipo'] },
  ],
  Business: [
    { label: 'Markets',  keywords: ['stock', 'nasdaq', 's&p', 'dow jones', 'wall street', 'earnings', 'trading', 'hedge fund', 'investment', 'ipo', 'shares', 'rally', 'selloff'] },
    { label: 'Economy',  keywords: ['inflation', 'interest rate', 'federal reserve', 'recession', 'gdp', 'unemployment', 'tariff', 'jobs report', 'cost of living', 'consumer price', 'trade war', 'economic growth'] },
    { label: 'Companies',keywords: ['merger', 'acquisition', 'ceo', 'layoff', 'revenue', 'profit', 'quarterly', 'earnings report', 'bankruptcy', 'deal worth'] },
  ],
};

function getSubcategory(article, category) {
  const subs = SUBCATEGORIES[category];
  if (!subs) return null;
  const haystack = [
    (article.title || '').toLowerCase(),
    (article.link || '').toLowerCase(),
    ...(article.categories || []),
  ].join(' ');
  for (const sub of subs) {
    if (sub.keywords.some(k => haystack.includes(k))) return sub.label;
  }
  return 'Other';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ArticleRow({ article }) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 py-2.5 transition-colors group"
      style={{ borderBottom: '1px solid var(--border-primary)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-sm leading-snug line-clamp-2 transition-colors"
          style={{ color: 'var(--text-primary)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
        >
          {article.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{article.source}</span>
          <span className="text-xs" style={{ color: 'var(--border-dim)' }}>·</span>
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{timeAgo(article.pubDate || article.collectedAt)}</span>
        </div>
      </div>
    </a>
  );
}

export default function ArticlesView({ selectedDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeSubcategory, setActiveSubcategory] = useState('All');

  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/articles/${selectedDate}`)
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error)))
      .then(d => {
        setData(d);
        setActiveCategory(null);
        setActiveSubcategory('All');
        setLoading(false);
      })
      .catch(e => { setError(e?.message || String(e) || 'Failed to load articles'); setLoading(false); });
  }, [selectedDate]);

  // Reset subcategory when switching categories
  function handleCategoryChange(cat) {
    setActiveCategory(cat);
    setActiveSubcategory('All');
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--text-faint)' }}>Loading articles...</div>
  );
  if (error) return (
    <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--text-faint)' }}>{error}</div>
  );
  if (!data) return null;

  const availableCategories = CATEGORY_ORDER.filter(c => data.categories?.[c]?.length > 0);
  const allArticles = CATEGORY_ORDER.flatMap(c => data.categories?.[c] || []);
  const categoryArticles = activeCategory ? (data.categories?.[activeCategory] || []) : allArticles;
  const subcategoryDefs = SUBCATEGORIES[activeCategory];

  // Build subcategory counts if this category supports them
  let subcategoryCounts = null;
  if (subcategoryDefs) {
    subcategoryCounts = { All: categoryArticles.length };
    for (const article of categoryArticles) {
      const sub = getSubcategory(article, activeCategory);
      subcategoryCounts[sub] = (subcategoryCounts[sub] || 0) + 1;
    }
  }

  // Filter articles by active subcategory
  const articles = subcategoryDefs && activeSubcategory !== 'All'
    ? categoryArticles.filter(a => getSubcategory(a, activeCategory) === activeSubcategory)
    : categoryArticles;

  // Build ordered subcategory tabs: defined order first, then Other if it has articles
  const subcategoryTabs = subcategoryDefs
    ? [
        'All',
        ...subcategoryDefs.map(s => s.label).filter(l => subcategoryCounts[l] > 0),
        ...(subcategoryCounts['Other'] > 0 ? ['Other'] : []),
      ]
    : [];

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold tracking-wide uppercase" style={{ letterSpacing: '2px', color: 'var(--text-primary)' }}>
          Articles
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{data.total} collected</span>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap mb-3">
        <button
          key="all"
          onClick={() => handleCategoryChange(null)}
          className="cursor-pointer transition-all text-xs font-semibold uppercase px-3 py-1.5 rounded-full"
          style={{
            letterSpacing: '1px',
            background: activeCategory === null ? 'var(--accent)' : 'var(--bg-card)',
            color: activeCategory === null ? 'var(--accent-text)' : 'var(--text-muted)',
            border: `1px solid ${activeCategory === null ? 'var(--accent)' : 'var(--border-primary)'}`,
          }}
        >
          All
          <span className="ml-1.5 opacity-60">{data.total}</span>
        </button>
        {availableCategories.map(cat => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className="cursor-pointer transition-all text-xs font-semibold uppercase px-3 py-1.5 rounded-full"
            style={{
              letterSpacing: '1px',
              background: activeCategory === cat ? 'var(--accent)' : 'var(--bg-card)',
              color: activeCategory === cat ? 'var(--accent-text)' : 'var(--text-muted)',
              border: `1px solid ${activeCategory === cat ? 'var(--accent)' : 'var(--border-primary)'}`,
            }}
          >
            {cat}
            <span className="ml-1.5 opacity-60">{data.categories[cat].length}</span>
          </button>
        ))}
      </div>

      {/* Subcategory tabs */}
      {subcategoryTabs.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5 pt-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
          {subcategoryTabs.map(sub => (
            <button
              key={sub}
              onClick={() => setActiveSubcategory(sub)}
              className="cursor-pointer transition-all text-xs px-3 py-1 rounded-full"
              style={{
                background: activeSubcategory === sub ? 'var(--bg-card)' : 'transparent',
                color: activeSubcategory === sub ? 'var(--accent)' : 'var(--text-faint)',
                border: `1px solid ${activeSubcategory === sub ? 'var(--accent)' : 'var(--border-primary)'}`,
              }}
            >
              {sub}
              <span className="ml-1 opacity-60">{subcategoryCounts[sub]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Article list */}
      <div className="rounded-lg overflow-hidden px-4" style={{ border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
        {articles.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--text-faint)' }}>No articles in this category.</p>
        ) : (
          articles.map((a, i) => <ArticleRow key={i} article={a} />)
        )}
      </div>
    </div>
  );
}
