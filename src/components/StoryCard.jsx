import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import SourceBadge from './SourceBadge';
import AnalysisView from './AnalysisView';
import { decodeText } from '../utils';

export default function StoryCard({ story, brief = false, expanded, onToggle }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const cardRef = useRef(null);
  const sources = [...new Set(story.articles.map(a => a.source))];

  // Brief variant — compact list row for single-source "In Brief" section
  if (brief) {
    return (
      <div ref={cardRef} style={{ borderBottom: '1px solid var(--border-primary)' }} className="last:border-0">
        <button
          onClick={() => onToggle(cardRef.current)}
          className="w-full text-left py-4 flex items-start justify-between gap-4 cursor-pointer group"
        >
          <div className="flex-1 min-w-0">
            <p
              className="text-sm leading-snug line-clamp-2 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              {decodeText(story.headline)}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {sources.slice(0, 3).map(s => <SourceBadge key={s} source={s} />)}
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-faint)' }}
          />
        </button>
        {expanded && (
          <div className="pb-4 space-y-3">
            <AnalysisView analysis={story.analysis} />
            {story.articles[0]?.link && (
              <a
                href={story.articles[0].link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <SourceBadge source={story.articles[0].source} />
                <span className="line-clamp-1 flex-1">{story.articles[0].title}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full card — for multi-source top stories
  const agreementCount = story.analysis?.agreements?.length ?? 0;
  const disagreementCount = story.analysis?.disagreements?.length ?? 0;

  return (
    <div
      ref={cardRef}
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderLeft: '3px solid var(--accent)',
      }}
    >
      <button
        onClick={() => onToggle(cardRef.current)}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 cursor-pointer group"
      >
        <div className="flex-1 min-w-0">
          <h3
            className="font-display text-xl font-bold leading-snug transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
          >
            {decodeText(story.headline)}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'var(--border-dim)' }}>·</span>
            <div className="flex flex-wrap gap-1">
              {sources.map(s => <SourceBadge key={s} source={s} />)}
            </div>
            {agreementCount > 0 && (
              <>
                <span style={{ color: 'var(--border-dim)' }}>·</span>
                <span className="text-xs text-emerald-600">{agreementCount} agreements</span>
              </>
            )}
            {disagreementCount > 0 && (
              <>
                <span style={{ color: 'var(--border-dim)' }}>·</span>
                <span className="text-xs text-amber-600">{disagreementCount} disagreement{disagreementCount !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 mt-1" style={{ color: 'var(--text-faint)' }}>
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-primary)' }} className="px-6 py-5 space-y-4">
          <AnalysisView analysis={story.analysis} />

          {/* Source articles */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
            <button
              onClick={() => setSourcesOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
              style={{ background: 'var(--bg-card)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Source Articles</span>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>({story.articles.length})</span>
                {sourcesOpen
                  ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-faint)' }} />
                  : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-faint)' }} />}
              </div>
            </button>
            {sourcesOpen && (
              <div className="p-2 space-y-1">
                {story.articles.map((article, i) => (
                  <a
                    key={i}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded-lg transition-colors group"
                    style={{ color: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <SourceBadge source={article.source} />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        {decodeText(article.title)}
                      </p>
                      {article.description && (
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-faint)' }}>{article.description}</p>
                      )}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--border-dim)' }} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
