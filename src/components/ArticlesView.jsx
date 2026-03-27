import { useEffect, useState } from 'react';

const CATEGORY_ORDER = ['Politics', 'International', 'Business', 'Crime', 'Health', 'Environment', 'Tech', 'Sports', 'Entertainment', 'Other'];

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
      className="flex items-start gap-3 py-2.5 border-b border-[#1a2035] hover:bg-[#111827] transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[#f0ebe0] text-sm leading-snug group-hover:text-[#e8c547] transition-colors line-clamp-2">
          {article.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[#4a5568] text-xs">{article.source}</span>
          <span className="text-[#2d3748] text-xs">·</span>
          <span className="text-[#4a5568] text-xs">{timeAgo(article.pubDate || article.collectedAt)}</span>
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

  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/articles/${selectedDate}`)
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error)))
      .then(d => {
        setData(d);
        const firstCat = CATEGORY_ORDER.find(c => d.categories?.[c]?.length > 0);
        setActiveCategory(firstCat || null);
        setLoading(false);
      })
      .catch(e => { setError(e?.message || String(e) || 'Failed to load articles'); setLoading(false); });
  }, [selectedDate]);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-[#4a5568] text-sm">Loading articles...</div>
  );
  if (error) return (
    <div className="flex items-center justify-center py-20 text-[#4a5568] text-sm">{error}</div>
  );
  if (!data) return null;

  const availableCategories = CATEGORY_ORDER.filter(c => data.categories?.[c]?.length > 0);
  const articles = activeCategory ? (data.categories?.[activeCategory] || []) : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[#f0ebe0] text-lg font-bold tracking-wide uppercase" style={{ letterSpacing: '2px' }}>
          Articles
        </h2>
        <span className="text-[#4a5568] text-xs">{data.total} collected</span>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {availableCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="cursor-pointer transition-all text-xs font-semibold uppercase px-3 py-1.5 rounded-full"
            style={{
              letterSpacing: '1px',
              background: activeCategory === cat ? '#e8c547' : 'rgba(26,32,53,0.8)',
              color: activeCategory === cat ? '#0a0d14' : '#6b7a9a',
              border: `1px solid ${activeCategory === cat ? '#e8c547' : '#1a2035'}`,
            }}
          >
            {cat}
            <span className="ml-1.5 opacity-60">{data.categories[cat].length}</span>
          </button>
        ))}
      </div>

      {/* Article list */}
      <div className="border border-[#1a2035] rounded-lg overflow-hidden bg-[#0a0d14] px-4">
        {articles.length === 0 ? (
          <p className="text-[#4a5568] text-sm py-6 text-center">No articles in this category.</p>
        ) : (
          articles.map((a, i) => <ArticleRow key={i} article={a} />)
        )}
      </div>
    </div>
  );
}
