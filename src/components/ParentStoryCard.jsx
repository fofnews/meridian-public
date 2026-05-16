import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import StoryCard from './StoryCard';
import SourceBadge from './SourceBadge';
import { decodeText } from '../utils';

export default function ParentStoryCard({ parent, subThreads }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedSub, setExpandedSub] = useState(null);

  const allSources = [...new Set(subThreads.flatMap(s => (s.articles ?? []).map(a => a.source)))];
  const totalArticles = subThreads.reduce((sum, s) => sum + (s.articles?.length ?? 0), 0);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-card)',
        borderLeft: '3px solid var(--accent)',
        boxShadow: '-2px 0 12px rgba(232,197,71,0.12)',
      }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 cursor-pointer group"
      >
        <div className="flex-1 min-w-0">
          <h3
            className="font-display text-xl font-bold leading-snug transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
          >
            {decodeText(parent.headline)}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {subThreads.length} sub-thread{subThreads.length !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'var(--border-dim)' }}>·</span>
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {totalArticles} articles
            </span>
            <span style={{ color: 'var(--border-dim)' }}>·</span>
            <div className="flex flex-wrap gap-1">
              {allSources.slice(0, 6).map(s => <SourceBadge key={s} source={s} />)}
              {allSources.length > 6 && (
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>+{allSources.length - 6} more</span>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 mt-1" style={{ color: 'var(--text-faint)' }}>
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-primary)' }} className="px-4 py-4 space-y-3">
          {subThreads.map(story => (
            <StoryCard
              key={story.id}
              story={story}
              expanded={expandedSub === story.id}
              onToggle={() => setExpandedSub(expandedSub === story.id ? null : story.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
