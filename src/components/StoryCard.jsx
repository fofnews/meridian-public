import { useState, useRef } from 'react';
import { Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import SourceBadge, { leanColor } from './SourceBadge';
import AnalysisView from './AnalysisView';
import { decodeText } from '../utils';
import { leanOf } from '../shared/source-leans.js';

// group (optional): { id, label, stories, sources } — renders the row for a story group,
// using `story` as the group's lead (multi-source) story.
export default function StoryCard({ story, leans, brief = false, group = null, read = false, expanded, onToggle }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const cardRef = useRef(null);
  const sources = group?.sources ?? [...new Set(story.articles.map(a => a.source))];

  // Brief variant — compact list row for single-source "In Brief" section
  if (brief) {
    return (
      <div ref={cardRef} data-story-id={story.id} style={{ borderBottom: '1px solid var(--border-primary)', scrollMarginTop: 'calc(var(--map-sticky-height, 0px) + 12px)' }} className="last:border-0">
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
              {sources.slice(0, 3).map(s => <SourceBadge key={s} source={s} lean={leanOf(leans, s)} />)}
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-faint)' }}
          />
        </button>
        {expanded && (
          <div className="pb-4 space-y-3">
            <AnalysisView analysis={story.analysis} leans={leans} />
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
                <SourceBadge source={story.articles[0].source} lean={leanOf(leans, story.articles[0].source)} />
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
  const hasClaims = Array.isArray(story.analysis?.claims);
  const factsCount = hasClaims
    ? story.analysis.claims.length
    : (story.analysis?.agreements?.length ?? 0);
  const disagreementCount = story.analysis?.disagreements?.length ?? 0;

  const itemId = group ? group.id : story.id;
  const headlineColor = read ? 'var(--text-muted)' : 'var(--text-primary)';

  return (
    <div
      ref={cardRef}
      data-story-id={itemId}
      className="transition-all"
      style={{
        borderBottom: '1px solid var(--border-primary)',
        scrollMarginTop: 'calc(var(--map-sticky-height, 0px) + 12px)',
        ...(expanded ? { background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-card)', overflow: 'hidden' } : {}),
      }}
    >
      <button
        onClick={() => onToggle(cardRef.current)}
        aria-expanded={expanded}
        className="w-full text-left px-4 py-5 flex items-start justify-between gap-4 cursor-pointer group"
      >
        <div className="flex-1 min-w-0">
          {group && (
            <div
              className="uppercase font-semibold"
              style={{ color: 'var(--gold-text)', fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '1.5px', marginBottom: 6 }}
            >
              Developing story · {group.stories.length} reports
            </div>
          )}
          <h3
            className="flex items-start gap-2 leading-snug"
            style={{ color: headlineColor, fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}
          >
            {read && (
              <Check className="w-5 h-5 shrink-0" style={{ color: 'var(--tier-spectrum)', marginTop: 4 }} aria-label="Read" />
            )}
            <span>{group ? group.label : decodeText(story.headline)}</span>
          </h3>
          {group && (
            <p className="mt-1.5 text-base leading-snug" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
              {decodeText(story.headline)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-xs" style={{ fontFamily: 'var(--font-label)' }}>
            <span style={{ color: 'var(--label)' }}>
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'var(--border-dim)' }}>·</span>
            {sources.slice(0, 6).map(s => (
              <span key={s} style={{ color: leanColor(leanOf(leans, s)), fontWeight: 500 }}>{s}</span>
            ))}
            {sources.length > 6 && (
              <span style={{ color: 'var(--label)' }}>+{sources.length - 6} more</span>
            )}
            {factsCount > 0 && (
              <>
                <span style={{ color: 'var(--border-dim)' }}>·</span>
                <span style={{ color: 'var(--label)' }}>{factsCount} {factsCount === 1 ? 'fact' : 'facts'}</span>
              </>
            )}
            {disagreementCount > 0 && (
              <>
                <span style={{ color: 'var(--border-dim)' }}>·</span>
                <span style={{ color: 'var(--disagree-text)' }}>{disagreementCount} disagreement{disagreementCount !== 1 ? 's' : ''}</span>
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
          <AnalysisView analysis={story.analysis} leans={leans} />

          {/* Source articles */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
            <button
              onClick={() => setSourcesOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
              style={{ background: 'var(--bg-card)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Source Articles</span>
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
                    <SourceBadge source={article.source} lean={leanOf(leans, article.source)} />
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
