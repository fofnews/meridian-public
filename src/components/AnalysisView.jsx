import { useState } from 'react';
import { CheckCircle2, AlertTriangle, Lightbulb, ChevronDown, ChevronUp, FileText, Sparkles } from 'lucide-react';
import SourceBadge from './SourceBadge';

export default function AnalysisView({ analysis }) {
  const hasClaims = Array.isArray(analysis?.claims);
  const [open, setOpen] = useState({
    claims: hasClaims,
    agreements: false,
    disagreements: hasClaims,
    uniqueAngles: false,
    facts: false,
    context: false,
  });
  const toggle = key => setOpen(prev => ({ ...prev, [key]: !prev[key] }));
  const [openDisagreements, setOpenDisagreements] = useState({});
  const toggleDisagreement = i => setOpenDisagreements(prev => ({ ...prev, [i]: !prev[i] }));

  if (!analysis) {
    return <p className="text-sm italic" style={{ color: 'var(--text-faint)' }}>Analysis unavailable.</p>;
  }

  // Defensive client-side sort: claims by source count desc, then statement length asc.
  const claims = hasClaims
    ? analysis.claims.slice().sort((a, b) => {
        const diff = (b.sources?.length ?? 0) - (a.sources?.length ?? 0);
        if (diff !== 0) return diff;
        return (a.statement?.length ?? 0) - (b.statement?.length ?? 0);
      })
    : null;

  return (
    <div className="space-y-2.5">
      {/* Summary */}
      <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{analysis.summary}</p>
      </div>

      {/* Claims (new shape) — ranked attributed factual statements */}
      {hasClaims && claims.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-agree)' }}>
          <button
            onClick={() => toggle('claims')}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
            style={{ background: 'var(--bg-agree)' }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--section-agree-accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--section-agree-title)' }}>Sourced Claims</span>
              <span className="text-xs" style={{ color: 'var(--section-agree-accent)' }}>({claims.length})</span>
            </div>
            {open.claims
              ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--section-agree-accent)' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: 'var(--section-agree-accent)' }} />}
          </button>
          {open.claims && (
            <ul className="px-4 py-3 space-y-3">
              {claims.map((c, i) => {
                const sourceCount = c.sources?.length ?? 0;
                const isLast = i === claims.length - 1;
                return (
                  <li
                    key={i}
                    className="pb-3"
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid var(--border-agree)',
                      paddingBottom: isLast ? 0 : '12px',
                    }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--section-agree-text)' }}>
                      {c.statement}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                        {sourceCount} source{sourceCount !== 1 ? 's' : ''}
                      </span>
                      {(c.sources ?? []).map(s => <SourceBadge key={s} source={s} />)}
                    </div>
                    {Array.isArray(c.contested) && c.contested.length > 0 && (
                      <div
                        className="mt-2 pl-3 py-1"
                        style={{ borderLeft: '2px solid var(--border-disagree)' }}
                      >
                        <span
                          className="text-xs font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--section-disagree-accent)' }}
                        >
                          Contested
                        </span>
                        {c.contested.map((x, j) => (
                          <div key={j} className="flex items-start gap-2 mt-1.5">
                            <SourceBadge source={x.source} />
                            <p className="text-sm flex-1 leading-relaxed" style={{ color: 'var(--section-disagree-text)' }}>
                              {x.alternative}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Legacy Agreements — only when the new claims shape is absent */}
      {!hasClaims && analysis.agreements?.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-agree)' }}>
          <button
            onClick={() => toggle('agreements')}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
            style={{ background: 'var(--bg-agree)' }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--section-agree-accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--section-agree-title)' }}>Where Sources Agree</span>
              <span className="text-xs" style={{ color: 'var(--section-agree-accent)' }}>({analysis.agreements.length})</span>
            </div>
            {open.agreements
              ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--section-agree-accent)' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: 'var(--section-agree-accent)' }} />}
          </button>
          {open.agreements && (
            <ul className="px-4 py-3 space-y-2">
              {analysis.agreements.map((point, i) => (
                <li key={i} className="text-sm py-1.5 leading-relaxed" style={{ color: 'var(--section-agree-text)', borderBottom: i < analysis.agreements.length - 1 ? '1px solid var(--border-agree)' : 'none', paddingBottom: i < analysis.agreements.length - 1 ? '10px' : undefined }}>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Legacy Unique Angles — only when the new claims shape is absent */}
      {!hasClaims && analysis.uniqueAngles?.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-unique)' }}>
          <button
            onClick={() => toggle('uniqueAngles')}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
            style={{ background: 'var(--bg-unique)' }}
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4" style={{ color: 'var(--section-unique-accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--section-unique-title)' }}>Unique Angles</span>
              <span className="text-xs" style={{ color: 'var(--section-unique-accent)' }}>({analysis.uniqueAngles.length})</span>
            </div>
            {open.uniqueAngles
              ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--section-unique-accent)' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: 'var(--section-unique-accent)' }} />}
          </button>
          {open.uniqueAngles && (
            <div className="px-4 py-3 space-y-3">
              {analysis.uniqueAngles.map((u, i) => (
                <div key={i} className="flex items-start gap-3" style={{ borderBottom: i < analysis.uniqueAngles.length - 1 ? '1px solid var(--border-unique)' : 'none', paddingBottom: i < analysis.uniqueAngles.length - 1 ? '12px' : undefined }}>
                  <SourceBadge source={u.source} />
                  <p className="text-sm flex-1 leading-relaxed" style={{ color: 'var(--section-unique-title)' }}>{u.angle ?? u.position}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disagreements */}
      {analysis.disagreements?.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-disagree)' }}>
          <button
            onClick={() => toggle('disagreements')}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
            style={{ background: 'var(--bg-disagree)' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--section-disagree-accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--section-disagree-title)' }}>Where Sources Disagree</span>
              <span className="text-xs" style={{ color: 'var(--section-disagree-accent)' }}>({analysis.disagreements.length})</span>
            </div>
            {open.disagreements
              ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--section-disagree-accent)' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: 'var(--section-disagree-accent)' }} />}
          </button>
          {open.disagreements && (
            <div className="p-3 space-y-3">
              {analysis.disagreements.map((d, i) => (
                <div key={i} className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-disagree)', border: '1px solid var(--border-disagree)' }}>
                  <button
                    onClick={() => toggleDisagreement(i)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
                  >
                    <p className="text-sm font-semibold" style={{ color: 'var(--section-disagree-title)' }}>{d.topic}</p>
                    {openDisagreements[i]
                      ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: 'var(--section-disagree-accent)' }} />
                      : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--section-disagree-accent)' }} />}
                  </button>
                  {openDisagreements[i] && (
                    <div className="px-4 pb-3 space-y-2">
                      {d.positions?.map((p, j) => (
                        <div key={j} className="flex items-start gap-3">
                          <SourceBadge source={p.source} />
                          <p className="text-sm flex-1" style={{ color: 'var(--section-disagree-text)' }}>{p.position}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Facts (single-source stories) */}
      {analysis.facts?.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-facts)' }}>
          <button
            onClick={() => toggle('facts')}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
            style={{ background: 'var(--bg-facts)' }}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: 'var(--section-facts-accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--section-facts-title)' }}>Reported Facts</span>
              <span className="text-xs" style={{ color: 'var(--section-facts-accent)' }}>({analysis.facts.length})</span>
            </div>
            {open.facts
              ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--section-facts-accent)' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: 'var(--section-facts-accent)' }} />}
          </button>
          {open.facts && (
            <ul className="px-4 py-3 space-y-2">
              {analysis.facts.map((fact, i) => (
                <li key={i} className="text-sm py-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)', borderBottom: i < analysis.facts.length - 1 ? '1px solid var(--border-facts)' : 'none', paddingBottom: i < analysis.facts.length - 1 ? '10px' : undefined }}>
                  {fact}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Why It Matters — editorial context, AI analysis */}
      {analysis.context && (analysis.context.significance || analysis.context.outlook?.length > 0) && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-dim)' }}>
          <button
            onClick={() => toggle('context')}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
            style={{ background: 'var(--bg-card)' }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Why It Matters</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-faint)', border: '1px solid var(--border-dim)' }}
              >
                AI Analysis
              </span>
            </div>
            {open.context
              ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-faint)' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-faint)' }} />}
          </button>
          {open.context && (
            <div className="px-4 py-4 space-y-4" style={{ borderTop: '1px solid var(--border-dim)' }}>
              {analysis.context.significance && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {analysis.context.significance}
                </p>
              )}
              {Array.isArray(analysis.context.outlook) && analysis.context.outlook.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>
                    What to watch
                  </p>
                  <ul className="space-y-1.5">
                    {analysis.context.outlook.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--text-faint)' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!hasClaims && analysis.disagreements?.length === 0 && !analysis.facts?.length && (
        <div className="flex items-center gap-2 text-sm italic" style={{ color: 'var(--text-faint)' }}>
          <CheckCircle2 className="w-4 h-4" />
          No significant disagreements found between sources.
        </div>
      )}
    </div>
  );
}
