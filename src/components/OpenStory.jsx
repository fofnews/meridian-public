import { useState, useRef } from 'react';
import { Minus } from 'lucide-react';
import { leanColor } from './SourceBadge';
import { decodeText, formatAnalysisTime } from '../utils';
import { leanOf, outletCount } from '../shared/source-leans.js';
import {
  LEAN_KEYS, LEAN_LABELS, coveringOutlets, normalizeClaims, groupClaimsByTier,
  coverageByLean, gapNote, headlinesByLean,
} from '../openStory.js';

const LABEL_FONT = { fontFamily: 'var(--font-label)' };
const TIERS = [
  { key: 'spectrum', title: 'Reported across the spectrum', color: 'var(--tier-spectrum)', size: 18, text: 'var(--text-primary)' },
  { key: 'multi', title: 'Reported by more than one outlet', color: 'var(--gold-text)', size: 16, text: 'var(--text-secondary)' },
  { key: 'single', title: 'Reported by one outlet, not confirmed elsewhere', color: 'var(--label)', size: 15, text: 'var(--text-muted)' },
];

function CoveragePanel({ leans, articles }) {
  const coverage = coverageByLean(leans, articles);
  const compared = coveringOutlets(articles).length;
  const note = gapNote(coverage);
  return (
    <aside className="md:pl-6" style={{ borderLeft: '1px solid var(--border-primary)' }} aria-label="Outlet coverage">
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--text-primary)' }}>
        Compared: <b style={{ color: 'var(--gold-text)' }}>{compared}</b> of {outletCount(leans)} outlets
      </div>
      <div className="flex flex-wrap mt-3" style={{ gap: 3, rowGap: 6 }} aria-hidden="true">
        {LEAN_KEYS.map(k => (
          <div key={k} className="flex" style={{ gap: 3, marginRight: 10 }}>
            {coverage[k].map(o => (
              <span
                key={o.name}
                title={`${o.name}${o.covered ? '' : ' (did not cover this)'}`}
                style={{
                  width: 8, height: 20, borderRadius: 1,
                  background: o.covered ? leanColor(k) : 'transparent',
                  border: `1px solid ${o.covered ? leanColor(k) : 'var(--border-dim)'}`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      {note && <div className="mt-2" style={{ ...LABEL_FONT, fontSize: 12, color: 'var(--gold-text)' }}>{note}</div>}
      <div className="mt-3 space-y-1" style={{ ...LABEL_FONT, fontSize: 12 }}>
        {LEAN_KEYS.map(k => {
          const names = coverage[k].filter(o => o.covered).map(o => o.name);
          return (
            <div key={k} className="flex gap-2">
              <span className="shrink-0 font-semibold" style={{ width: 56, color: leanColor(k) }}>{LEAN_LABELS[k]}</span>
              <span style={{ color: names.length ? 'var(--text-secondary)' : 'var(--label)' }}>{names.length ? names.join(', ') : 'none'}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function Pips({ sources, leans }) {
  return (
    <span className="inline-flex" style={{ gap: 3 }} aria-hidden="true">
      {sources.map(s => (
        <span key={s} title={s} style={{ width: 16, height: 6, borderRadius: 1, background: leanColor(leanOf(leans, s)) }} />
      ))}
    </span>
  );
}

function FactsTab({ analysis, articles, leans }) {
  const tiers = groupClaimsByTier(normalizeClaims(analysis, articles), leans);
  if (TIERS.every(t => tiers[t.key].length === 0)) {
    return <p style={{ ...LABEL_FONT, fontSize: 14, color: 'var(--label)' }}>No sourced facts were extracted for this story.</p>;
  }
  return (
    <div className="space-y-8">
      {TIERS.filter(t => tiers[t.key].length > 0).map(t => (
        <section key={t.key}>
          <h4 style={{ ...LABEL_FONT, fontSize: 14, fontWeight: 700, color: t.color }}>
            {t.title} <span style={{ fontWeight: 400 }}>({tiers[t.key].length})</span>
          </h4>
          <ul className="mt-3 space-y-4">
            {tiers[t.key].map((c, i) => (
              <li key={i}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: t.size, lineHeight: 1.5, color: t.text }}>{c.statement}</p>
                {c.contested.map((x, j) => (
                  <p key={j} className="mt-1" style={{ ...LABEL_FONT, fontSize: 12, color: 'var(--disagree-text)' }}>
                    Worded differently by {x.source}: {x.alternative}
                  </p>
                ))}
                {c.sources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                    <Pips sources={c.sources} leans={leans} />
                    <span style={{ ...LABEL_FONT, fontSize: 12, color: 'var(--label)' }}>{c.sources.join(', ')}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function HeadlinesTab({ articles, leans }) {
  const cols = headlinesByLean(articles, leans);
  return (
    <div>
      <div className="grid grid-cols-3 gap-6">
        {LEAN_KEYS.map(k => (
          <div key={k}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ width: 3, height: 36, background: leanColor(k) }} />
              <span className="font-semibold" style={{ ...LABEL_FONT, fontSize: 14, color: leanColor(k) }}>{LEAN_LABELS[k]}</span>
            </div>
            {cols[k].length === 0 ? (
              <p style={{ ...LABEL_FONT, fontSize: 13, color: 'var(--label)' }}>No outlet on this side covered it.</p>
            ) : (
              <ul className="space-y-4">
                {cols[k].map((a, i) => <HeadlineLink key={i} article={a} color={leanColor(k)} />)}
              </ul>
            )}
          </div>
        ))}
      </div>
      {cols.other.length > 0 && (
        <ul className="mt-6 space-y-4">
          {cols.other.map((a, i) => <HeadlineLink key={i} article={a} color={leanColor(null)} />)}
        </ul>
      )}
    </div>
  );
}

function HeadlineLink({ article, color }) {
  return (
    <li>
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block">
        <span className="font-semibold" style={{ ...LABEL_FONT, fontSize: 12, color }}>{article.source} ↗</span>
        <span className="block mt-0.5" style={{ fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.3, color: 'var(--text-primary)' }}>
          {decodeText(article.title)}
        </span>
      </a>
    </li>
  );
}

function DisagreementsTab({ analysis, leans, total }) {
  const items = analysis.disagreements ?? [];
  if (items.length === 0) {
    return <p style={{ ...LABEL_FONT, fontSize: 14, color: 'var(--label)' }}>No disagreements found among the {total} outlets.</p>;
  }
  return (
    <div className="space-y-8">
      {items.map((d, i) => (
        <section key={i}>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, color: 'var(--text-primary)' }}>{d.topic}</h4>
          <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {(d.positions ?? []).map((p, j) => {
              const c = leanColor(leanOf(leans, p.source));
              return (
                <div key={j} className="p-3" style={{ background: 'var(--bg-card)', borderTop: `3px solid ${c}`, borderRadius: 4 }}>
                  <div className="font-semibold" style={{ ...LABEL_FONT, fontSize: 13, color: c }}>{p.source}</div>
                  <p className="mt-1" style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{p.position}</p>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function ContextTab({ context }) {
  return (
    <div>
      <p style={{ ...LABEL_FONT, fontSize: 13, color: 'var(--label)' }}>
        Editorial analysis written by Meridian's analysis model. Not sourced fact.
      </p>
      {context?.significance && (
        <p className="mt-3" style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {context.significance}
        </p>
      )}
      {Array.isArray(context?.outlook) && context.outlook.length > 0 && (
        <>
          <h4 className="mt-6" style={{ ...LABEL_FONT, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Open questions</h4>
          <ol className="mt-2 list-decimal pl-5 space-y-1.5" style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--text-secondary)' }}>
            {context.outlook.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </>
      )}
    </div>
  );
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function SinglesThread({ singles, leans }) {
  return (
    <div className="mt-5">
      <p style={{ ...LABEL_FONT, fontSize: 13, color: 'var(--label)' }}>Each of these was reported by one outlet. Summarized, not compared.</p>
      {singles.map(s => {
        const a = s.articles[0];
        return (
          <div key={s.id} className="py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <a href={a?.link} target="_blank" rel="noopener noreferrer" className="block">
              <span className="block font-semibold" style={{ ...LABEL_FONT, fontSize: 13, color: leanColor(leanOf(leans, a?.source)) }}>{a?.source} ↗</span>
              <span className="block mt-1" style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.3, color: 'var(--text-primary)' }}>{decodeText(a?.title ?? s.headline)}</span>
            </a>
            {s.analysis?.summary && (
              <p className="mt-2" style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{s.analysis.summary}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ThreadButtons({ threads, thread, onPick }) {
  return (
    <div className="flex flex-wrap gap-2 mt-5">
      {threads.map((t, i) => {
        const sel = thread === i;
        return (
          <button
            key={t.title}
            aria-pressed={sel}
            onClick={() => onPick(i)}
            className="cursor-pointer text-left grid gap-2.5"
            style={{
              flex: '1 1 280px', gridTemplateColumns: '22px minmax(0, 1fr)', padding: '12px 14px', minHeight: 44, borderRadius: 6,
              background: sel ? 'var(--bg-card)' : 'transparent',
              border: `1px solid ${sel ? 'var(--gold-text)' : 'var(--border-primary)'}`,
              color: 'var(--text-primary)',
            }}
          >
            <span className="font-bold" style={{ ...LABEL_FONT, fontSize: 13, paddingTop: 3, color: sel ? 'var(--gold-text)' : 'var(--label)' }}>{i + 1}</span>
            <span className="block min-w-0">
              <span className="block font-semibold" style={{ fontFamily: 'var(--font-display)', fontSize: 18, lineHeight: 1.25 }}>{t.title}</span>
              <span className="block mt-1" style={{ ...LABEL_FONT, fontSize: 12, color: 'var(--label)' }}>{t.meta}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function OpenStory({ story, leans, fetchedAt, group = null, onCollapse }) {
  const [tab, setTab] = useState('facts');
  const [thread, setThread] = useState(0);
  const tabRefs = useRef({});
  const { analysis, articles } = story;
  const singles = group ? group.stories.filter(s => s.id !== story.id && coveringOutlets(s.articles).length <= 1) : [];
  const singleOutlets = coveringOutlets(singles.flatMap(s => s.articles));
  const showSingles = group && thread === 1;
  const pickThread = i => { setThread(i); setTab('facts'); };

  if (!analysis) {
    return (
      <div className="px-6 py-5" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <p style={{ ...LABEL_FONT, fontSize: 14, color: 'var(--label)' }}>Analysis isn't available for this story yet.</p>
      </div>
    );
  }

  const outlets = coveringOutlets(articles);
  const claimTotal = normalizeClaims(analysis, articles).length;
  const disagreementTotal = analysis.disagreements?.length ?? 0;
  const hasContext = !!(analysis.context?.significance || analysis.context?.outlook?.length);
  const tabs = [
    { id: 'facts', label: 'Facts', count: claimTotal },
    { id: 'headlines', label: 'Headlines', count: articles.length },
    { id: 'disagreements', label: 'Disagreements', count: disagreementTotal },
    ...(hasContext ? [{ id: 'context', label: 'Context' }] : []),
  ];
  const locations = (analysis.locations ?? []).map(l => l.name ?? l).filter(Boolean);
  const time = formatAnalysisTime(fetchedAt);

  const onTabKey = e => {
    const i = tabs.findIndex(t => t.id === tab);
    let next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    if (next) {
      e.preventDefault();
      setTab(next.id);
      tabRefs.current[next.id]?.focus();
    }
  };

  return (
    <div className="px-6 py-6" style={{ borderTop: '1px solid var(--border-primary)' }}>
      {locations.length > 0 && (
        <div className="font-semibold" style={{ ...LABEL_FONT, fontSize: 13, color: 'var(--gold-text)' }}>{locations.join(' · ')}</div>
      )}
      <h3 className="flex items-start gap-3 mt-1" style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, lineHeight: 1.18, color: 'var(--text-primary)' }}>
        <Minus className="w-5 h-5 shrink-0" style={{ color: 'var(--gold-text)', marginTop: 8 }} aria-hidden="true" />
        <span>{group ? group.label : decodeText(story.headline)}</span>
      </h3>
      {group && (
        <>
          <div className="mt-2" style={{ ...LABEL_FONT, fontSize: 13, color: 'var(--label)' }}>
            {plural(group.sources.length, 'outlet')} in all · {plural(outlets.length, 'outlet')} compared · {plural(singles.length, 'single-outlet report')}
          </div>
          {singles.length > 0 && (
            <ThreadButtons
              thread={thread}
              onPick={pickThread}
              threads={[
                { title: 'Compared coverage', meta: `${plural(outlets.length, 'outlet')} · facts, headlines and disagreements` },
                { title: 'Single-outlet reports', meta: `${plural(singles.length, 'report')} from ${plural(singleOutlets.length, 'outlet')} · summarized, not compared` },
              ]}
            />
          )}
        </>
      )}

      {showSingles ? <SinglesThread singles={singles} leans={leans} /> : (
      <>
      {group && (
        <p className="mt-5" style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.3, color: 'var(--text-primary)' }}>{decodeText(story.headline)}</p>
      )}
      <div className="grid gap-6 mt-5 md:grid-cols-[minmax(0,1fr)_320px]">
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 18, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{analysis.summary}</p>
        <CoveragePanel leans={leans} articles={articles} />
      </div>

      <div role="tablist" aria-label="Story sections" className="flex gap-6 mt-8" style={{ borderBottom: '1px solid var(--border-primary)' }} onKeyDown={onTabKey}>
        {tabs.map(t => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              ref={el => { tabRefs.current[t.id] = el; }}
              role="tab"
              id={`tab-${story.id}-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${story.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              className="cursor-pointer"
              style={{
                ...LABEL_FONT, fontSize: 14, fontWeight: 600, minHeight: 44, background: 'none', border: 'none',
                borderBottom: `2px solid ${selected ? 'var(--gold-text)' : 'transparent'}`,
                marginBottom: -1,
                color: selected ? 'var(--text-primary)' : 'var(--label)',
              }}
            >
              {t.label}
              {t.count !== undefined && <span style={{ fontWeight: 400 }}> ({t.count})</span>}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${story.id}`} aria-labelledby={`tab-${story.id}-${tab}`} className="pt-6">
        {tab === 'facts' && <FactsTab analysis={analysis} articles={articles} leans={leans} />}
        {tab === 'headlines' && <HeadlinesTab articles={articles} leans={leans} />}
        {tab === 'disagreements' && <DisagreementsTab analysis={analysis} leans={leans} total={outlets.length} />}
        {tab === 'context' && <ContextTab context={analysis.context} />}
      </div>
      </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <p style={{ ...LABEL_FONT, fontSize: 12, color: 'var(--label)' }}>
          {showSingles
            ? `AI-generated summaries of ${plural(singles.length, 'report')} from ${plural(singleOutlets.length, 'outlet')}`
            : `AI-generated analysis of ${plural(articles.length, 'article')} from ${plural(outlets.length, 'outlet')}`}
          {time && ` · Analysis run at ${time}`} · may contain errors
        </p>
        <button
          onClick={onCollapse}
          className="cursor-pointer"
          style={{ ...LABEL_FONT, fontSize: 14, fontWeight: 600, minHeight: 44, padding: '0 16px', background: 'none', color: 'var(--gold-text)', border: '1px solid var(--gold-text)', borderRadius: 4 }}
        >
          Collapse story
        </button>
      </div>
    </div>
  );
}
