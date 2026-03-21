import { useState } from 'react';
import { CheckCircle2, AlertTriangle, Lightbulb, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import SourceBadge from './SourceBadge';

export default function AnalysisView({ analysis }) {
  const [open, setOpen] = useState({ agreements: false, disagreements: false, uniqueAngles: false, facts: false });
  const toggle = key => setOpen(prev => ({ ...prev, [key]: !prev[key] }));
  const [openDisagreements, setOpenDisagreements] = useState({});
  const toggleDisagreement = i => setOpenDisagreements(prev => ({ ...prev, [i]: !prev[i] }));

  if (!analysis) {
    return <p className="text-sm text-[#4a5568] italic">Analysis unavailable.</p>;
  }

  return (
    <div className="space-y-2.5">
      {/* Summary */}
      <div className="bg-[#0d1220] rounded-lg p-4 border border-[#1a2540]">
        <p className="text-sm text-[#c8c0b0] leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Agreements */}
      {analysis.agreements?.length > 0 && (
        <div className="border border-[#1a3530] rounded-lg overflow-hidden">
          <button
            onClick={() => toggle('agreements')}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[#0d2520] text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-300">Where Sources Agree</span>
              <span className="text-xs text-emerald-600">({analysis.agreements.length})</span>
            </div>
            {open.agreements
              ? <ChevronUp className="w-4 h-4 text-emerald-600" />
              : <ChevronDown className="w-4 h-4 text-emerald-600" />}
          </button>
          {open.agreements && (
            <ul className="p-3 space-y-2">
              {analysis.agreements.map((point, i) => (
                <li key={i} className="bg-[#0d2520] border border-[#1a3530] rounded-lg px-4 py-3 text-sm text-emerald-200">
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Unique Angles */}
      {analysis.uniqueAngles?.length > 0 && (
        <div className="border border-[#1a2a40] rounded-lg overflow-hidden">
          <button
            onClick={() => toggle('uniqueAngles')}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[#0d1830] text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-semibold text-sky-300">Unique Angles</span>
              <span className="text-xs text-sky-600">({analysis.uniqueAngles.length})</span>
            </div>
            {open.uniqueAngles
              ? <ChevronUp className="w-4 h-4 text-sky-600" />
              : <ChevronDown className="w-4 h-4 text-sky-600" />}
          </button>
          {open.uniqueAngles && (
            <div className="p-3 space-y-2">
              {analysis.uniqueAngles.map((u, i) => (
                <div key={i} className="bg-[#0d1830] border border-[#1a2a40] rounded-lg px-4 py-3 flex items-start gap-3">
                  <SourceBadge source={u.source} />
                  <p className="text-sm text-[#c8c0b0] flex-1">{u.angle}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disagreements */}
      {analysis.disagreements?.length > 0 && (
        <div className="border border-[#3a2800] rounded-lg overflow-hidden">
          <button
            onClick={() => toggle('disagreements')}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[#1e1600] text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-300">Where Sources Disagree</span>
              <span className="text-xs text-amber-600">({analysis.disagreements.length})</span>
            </div>
            {open.disagreements
              ? <ChevronUp className="w-4 h-4 text-amber-600" />
              : <ChevronDown className="w-4 h-4 text-amber-600" />}
          </button>
          {open.disagreements && (
            <div className="p-3 space-y-3">
              {analysis.disagreements.map((d, i) => (
                <div key={i} className="bg-[#1e1600] border border-[#3a2800] rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleDisagreement(i)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
                  >
                    <p className="text-sm font-semibold text-amber-200">{d.topic}</p>
                    {openDisagreements[i]
                      ? <ChevronUp className="w-4 h-4 text-amber-600 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-amber-600 shrink-0" />}
                  </button>
                  {openDisagreements[i] && (
                    <div className="px-4 pb-3 space-y-2">
                      {d.positions?.map((p, j) => (
                        <div key={j} className="flex items-start gap-3">
                          <SourceBadge source={p.source} />
                          <p className="text-sm text-[#c8c0b0] flex-1">{p.position}</p>
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
        <div className="border border-[#2a3040] rounded-lg overflow-hidden">
          <button
            onClick={() => toggle('facts')}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[#141824] text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#8899bb]" />
              <span className="text-sm font-semibold text-[#a0b0cc]">Confirmed Facts</span>
              <span className="text-xs text-[#4a5568]">({analysis.facts.length})</span>
            </div>
            {open.facts
              ? <ChevronUp className="w-4 h-4 text-[#4a5568]" />
              : <ChevronDown className="w-4 h-4 text-[#4a5568]" />}
          </button>
          {open.facts && (
            <ul className="p-3 space-y-2">
              {analysis.facts.map((fact, i) => (
                <li key={i} className="bg-[#141824] border border-[#2a3040] rounded-lg px-4 py-3 text-sm text-[#c8c0b0]">
                  {fact}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {analysis.disagreements?.length === 0 && !analysis.facts?.length && (
        <div className="flex items-center gap-2 text-sm text-[#4a5568] italic">
          <CheckCircle2 className="w-4 h-4" />
          No significant disagreements found between sources.
        </div>
      )}
    </div>
  );
}
