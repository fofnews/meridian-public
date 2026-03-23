import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import SourceBadge from './SourceBadge';
import AnalysisView from './AnalysisView';

export default function StoryCard({ story, brief = false, expanded, onToggle }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const sources = [...new Set(story.articles.map(a => a.source))];

  // Brief variant — compact list row for single-source "In Brief" section
  if (brief) {
    return (
      <div className="border-b border-[#1a2035] last:border-0">
        <button
          onClick={onToggle}
          className="w-full text-left py-4 flex items-start justify-between gap-4 cursor-pointer group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[#c8c0b0] text-sm leading-snug group-hover:text-[#f0ebe0] transition-colors line-clamp-2">
              {story.headline}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {sources.slice(0, 3).map(s => <SourceBadge key={s} source={s} />)}
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#4a5568] shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded && (
          <div className="pb-4 space-y-3">
            <AnalysisView analysis={story.analysis} />
            {story.articles[0]?.link && (
              <a
                href={story.articles[0].link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-[#6b7a9a] hover:text-[#e8c547] transition-colors"
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
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: '#0a0d14',
        border: '1px solid #1a2035',
        borderLeft: '3px solid #e8c547',
      }}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 cursor-pointer group"
      >
        <div className="flex-1 min-w-0">
          <h3
            className="font-display text-xl font-bold leading-snug group-hover:text-[#e8c547] transition-colors"
            style={{ color: '#f0ebe0' }}
          >
            {story.headline}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs text-[#4a5568]">{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
            <span className="text-[#2a3040]">·</span>
            <div className="flex flex-wrap gap-1">
              {sources.map(s => <SourceBadge key={s} source={s} />)}
            </div>
            {agreementCount > 0 && (
              <>
                <span className="text-[#2a3040]">·</span>
                <span className="text-xs text-emerald-600">{agreementCount} agreements</span>
              </>
            )}
            {disagreementCount > 0 && (
              <>
                <span className="text-[#2a3040]">·</span>
                <span className="text-xs text-amber-600">{disagreementCount} disagreement{disagreementCount !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 mt-1 text-[#4a5568]">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#1a2035] px-6 py-5 space-y-4">
          <AnalysisView analysis={story.analysis} />

          {/* Source articles */}
          <div className="border border-[#1a2035] rounded-lg overflow-hidden">
            <button
              onClick={() => setSourcesOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[#0d1220] text-left cursor-pointer"
            >
              <span className="text-sm font-semibold text-[#6b7a9a]">Source Articles</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#4a5568]">({story.articles.length})</span>
                {sourcesOpen
                  ? <ChevronUp className="w-4 h-4 text-[#4a5568]" />
                  : <ChevronDown className="w-4 h-4 text-[#4a5568]" />}
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
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#0d1220] transition-colors group"
                  >
                    <SourceBadge source={article.source} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#c8c0b0] group-hover:text-[#e8c547] transition-colors">
                        {article.title}
                      </p>
                      {article.description && (
                        <p className="text-xs text-[#4a5568] mt-0.5 line-clamp-2">{article.description}</p>
                      )}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#2a3040] shrink-0 mt-0.5" />
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
