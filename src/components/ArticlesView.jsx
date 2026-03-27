import { useEffect, useState } from 'react';

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

function StoryGroup({ story, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 border border-[#1a2035] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#0f1320] hover:bg-[#111827] transition-colors cursor-pointer"
      >
        <span className="text-[#f0ebe0] text-sm font-semibold text-left leading-snug">{story.headline}</span>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <span className="text-[#e8c547] text-xs font-medium">{story.articles.length} sources</span>
          <span className="text-[#4a5568] text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 bg-[#0a0d14]">
          {story.articles.map((a, i) => <ArticleRow key={i} article={a} />)}
        </div>
      )}
    </div>
  );
}

export default function ArticlesView({ selectedDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    setError(null);
    fetch(`/api/articles/${selectedDate}`)
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error)))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e?.message || String(e) || 'Failed to load articles'); setLoading(false); });
  }, [selectedDate]);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-[#4a5568] text-sm">Loading articles...</div>
  );
  if (error) return (
    <div className="flex items-center justify-center py-20 text-[#4a5568] text-sm">{error}</div>
  );
  if (!data) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[#f0ebe0] text-lg font-bold tracking-wide uppercase" style={{ letterSpacing: '2px' }}>
          Articles
        </h2>
        <span className="text-[#4a5568] text-xs">{data.total} collected</span>
      </div>

      {data.stories.length > 0 && (
        <div className="mb-8">
          <p className="text-[#6b7a9a] text-xs uppercase tracking-widest mb-3">By Story</p>
          {data.stories.map((story, i) => (
            <StoryGroup key={i} story={story} defaultOpen={i === 0} />
          ))}
        </div>
      )}

      {data.unclassified.length > 0 && (
        <div>
          <p className="text-[#6b7a9a] text-xs uppercase tracking-widest mb-3">
            {data.stories.length > 0 ? 'Other Articles' : 'All Articles'}
          </p>
          <div className="border border-[#1a2035] rounded-lg overflow-hidden bg-[#0a0d14] px-4">
            {data.unclassified.map((a, i) => <ArticleRow key={i} article={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}
