import { Fragment, useRef } from 'react';
import { Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { leanColor } from './SourceBadge';
import OpenStory from './OpenStory';
import { decodeText } from '../utils';
import { leanOf } from '../shared/source-leans.js';
import { useIsPhone } from '../useIsPhone.js';

const LEAN_ORDER = { left: 0, center: 1, right: 2 };
const byLean = (sources, leans) =>
  [...sources].sort((a, b) => (LEAN_ORDER[leanOf(leans, a)] ?? 3) - (LEAN_ORDER[leanOf(leans, b)] ?? 3));

// group (optional): { id, label, stories, sources } — renders the row for a story group,
// using `story` as the group's lead (multi-source) story.
export default function StoryCard({ story, leans, brief = false, group = null, read = false, fetchedAt = null, expanded, onToggle }) {
  const cardRef = useRef(null);
  const sources = group?.sources ?? [...new Set(story.articles.map(a => a.source))];

  // Brief variant: compact row for single-outlet reports
  if (brief) {
    const article = story.articles[0];
    const outlet = article?.source ?? sources[0];
    return (
      <div ref={cardRef} data-story-id={story.id} style={{ borderBottom: '1px solid var(--border-primary)', scrollMarginTop: 'calc(var(--map-sticky-height, 0px) + 12px)' }}>
        <button
          onClick={() => onToggle(cardRef.current)}
          aria-expanded={expanded}
          className="w-full text-left grid gap-4 cursor-pointer"
          style={{ gridTemplateColumns: 'minmax(0, 1fr) 24px', padding: '12px 0', minHeight: 44 }}
        >
          <span className="block min-w-0">
            <span className="block" style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
              {decodeText(story.headline)}
            </span>
            <span className="block mt-0.5 font-medium" style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: leanColor(leanOf(leans, outlet)) }}>
              {outlet}
            </span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--label)', fontFamily: 'var(--font-label)' }}>{expanded ? '−' : '+'}</span>
        </button>
        {expanded && (
          <div className="pb-4">
            {story.analysis?.summary && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{story.analysis.summary}</p>
            )}
            {article?.link && (
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2"
                style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--gold-text)', minHeight: 44 }}
              >
                Read at {outlet} <ExternalLink className="w-3 h-3" />
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
  const isPhone = useIsPhone();
  const sourceLimit = isPhone ? 3 : 6;

  return (
    <div
      ref={cardRef}
      data-story-id={itemId}
      className="transition-all"
      style={{
        borderBottom: '1px solid var(--border-primary)',
        scrollMarginTop: 'calc(var(--map-sticky-height, 0px) + 12px)',
        ...(expanded ? (isPhone
          ? { background: 'var(--bg-primary)' }
          : { background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-card)', overflow: 'hidden' }
        ) : {}),
      }}
    >
      <button
        onClick={() => onToggle(cardRef.current)}
        aria-expanded={expanded}
        aria-label={expanded ? (group ? group.label : decodeText(story.headline)) : undefined}
        className={`w-full text-left px-4 ${expanded ? 'py-3' : 'py-5'} flex items-start justify-between gap-4 cursor-pointer group`}
        {...(expanded ? { 'data-story-open-header': '1' } : {})}
      >
        <div className="flex-1 min-w-0">
          {(group || (expanded && read)) && (
            <div
              className="flex items-center gap-2 uppercase font-semibold"
              style={{ color: 'var(--gold-text)', fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '1.5px', marginBottom: expanded ? 0 : 6 }}
            >
              {expanded && read && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--tier-spectrum)' }} aria-label="Read" />}
              {group && <span>Developing story · {group.stories.length} reports</span>}
            </div>
          )}
          {!expanded && (
          <>
          <h3
            className="flex items-start gap-2 leading-snug"
            style={{ color: headlineColor, fontFamily: 'var(--font-display)', fontSize: isPhone ? 21 : 24, fontWeight: 600 }}
          >
            {read && (
              <Check className="w-5 h-5 shrink-0" style={{ color: 'var(--tier-spectrum)', marginTop: 4 }} aria-label="Read" />
            )}
            <span>{group ? group.label : decodeText(story.headline)}</span>
          </h3>
          {group && (
            <p className="mt-1.5 leading-snug" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: isPhone ? 15 : 16 }}>
              {decodeText(story.headline)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-xs" style={{ fontFamily: 'var(--font-label)' }}>
            <span style={{ color: 'var(--label)' }}>
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'var(--border-dim)' }}>·</span>
            {byLean(sources, leans).slice(0, sourceLimit).map((s, i) => (
              <Fragment key={s}>
                {i > 0 && <span aria-hidden="true" style={{ color: 'var(--border-dim)' }}>·</span>}
                <span style={{ color: leanColor(leanOf(leans, s)), fontWeight: 500 }}>{s}</span>
              </Fragment>
            ))}
            {sources.length > sourceLimit && (
              <span style={{ color: 'var(--label)' }}>+{sources.length - sourceLimit} more</span>
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
          </>
          )}
        </div>
        <div className="shrink-0 mt-1" style={{ color: 'var(--text-faint)' }}>
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <OpenStory
          story={story}
          leans={leans}
          fetchedAt={fetchedAt}
          group={group}
          onCollapse={() => onToggle(cardRef.current)}
        />
      )}
    </div>
  );
}
