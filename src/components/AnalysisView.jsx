import { useState } from 'react';
import { CheckCircle2, AlertTriangle, Lightbulb, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import SourceBadge from './SourceBadge';

export default function AnalysisView({ analysis }) {
  const [open, setOpen] = useState({ agreements: false, disagreements: false, uniqueAngles: false, facts: false });
  const toggle = key => setOpen(prev => ({ ...prev, [key]: !prev[key] }));
  const [openDisagreements, setOpenDisagreements] = useState({});
  const toggleDisagreement = i => setOpenDisagreements(prev => ({ ...prev, [i]: !prev[i] }));

  if (!analysis) {
    return <p className="text-sm italic" style={{ color: 'var(--text-faint)' }}>Analysis unavailable.</p>;
  }

  return (
    <div className="space-y-2.5">
      {/* Summary */}
      <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{analysis.summary}</p>
      </div>

      {/* Agreements */}
      {analysis.agreements?.length > 0 && (
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
            <ul className="p-3 space-y-2">
              {analysis.agreements.map((point, i) => (
                <li key={i} className="rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--bg-agree)', border: '1px solid var(--border-agree)', color: 'var(--section-agree-text)' }}>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Unique Angles */}
      {analysis.uniqueAngles?.length > 0 && (
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
            <div className="p-3 space-y-2">
              {analysis.uniqueAngles.map((u, i) => (
                <div key={i} className="rounded-lg px-4 py-3 flex items-start gap-3" style={{ background: 'var(--bg-unique)', border: '1px solid var(--border-unique)' }}>
                  <SourceBadge source={u.source} />
                  <p className="text-sm flex-1" style={{ color: 'var(--section-unique-title)' }}>{u.angle}</p>
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
              <span className="text-sm font-semibold" style={{ color: 'var(--section-facts-title)' }}>Confirmed Facts</span>
              <span className="text-xs" style={{ color: 'var(--section-facts-accent)' }}>({analysis.facts.length})</span>
            </div>
            {open.facts
              ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--section-facts-accent)' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: 'var(--section-facts-accent)' }} />}
          </button>
          {open.facts && (
            <ul className="p-3 space-y-2">
              {analysis.facts.map((fact, i) => (
                <li key={i} className="rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--bg-facts)', border: '1px solid var(--border-facts)', color: 'var(--text-secondary)' }}>
                  {fact}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {analysis.disagreements?.length === 0 && !analysis.facts?.length && (
        <div className="flex items-center gap-2 text-sm italic" style={{ color: 'var(--text-faint)' }}>
          <CheckCircle2 className="w-4 h-4" />
          No significant disagreements found between sources.
        </div>
      )}
    </div>
  );
}
