import { useState, useEffect } from 'react';
import { Clock, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * Build a display-ready list of top-level timelines.
 * Parents get their children's entries flattened and sorted, with sub-thread labels.
 * Orphan leaves (no parent, no children) pass through as-is.
 */
function buildDisplayTimelines(allTimelines) {
  const parentIds = new Set(
    allTimelines.filter(t => t.parentId).map(t => t.parentId)
  );

  const topLevel = [];

  for (const topic of allTimelines) {
    if (topic.parentId) continue;

    if (parentIds.has(topic.id)) {
      const children = allTimelines.filter(t => t.parentId === topic.id);
      const allEntries = [];
      for (const child of children) {
        for (const entry of (child.entries || [])) {
          allEntries.push({ ...entry, subThread: child.title });
        }
      }
      const editionOrder = { morning: 0, evening: 1, manual: 2 };
      allEntries.sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        return (editionOrder[a.edition] ?? 3) - (editionOrder[b.edition] ?? 3);
      });

      topLevel.push({
        ...topic,
        firstSeen: children.reduce((min, c) => c.firstSeen < min ? c.firstSeen : min, children[0]?.firstSeen || topic.firstSeen),
        lastSeen: children.reduce((max, c) => c.lastSeen > max ? c.lastSeen : max, children[0]?.lastSeen || topic.lastSeen),
        active: children.some(c => c.active),
        entries: allEntries,
      });
    } else {
      const entries = (topic.entries || []).map(e => ({ ...e, subThread: null }));
      topLevel.push({ ...topic, entries });
    }
  }

  return topLevel;
}

function TimelineEntry({ entry, isLast }) {
  return (
    <div style={{ display: 'flex', gap: 16, paddingBottom: isLast ? 4 : 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
        <div style={{
          width: 9, height: 9, borderRadius: '50%',
          background: 'var(--accent)', flexShrink: 0, marginTop: 5,
        }} />
        {!isLast && (
          <div style={{ width: 1, flex: 1, background: 'var(--border-primary)', marginTop: 4 }} />
        )}
      </div>
      <div style={{ paddingBottom: 4, flex: 1 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: 'var(--text-faint)',
          letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
        }}>
          <span>
            {formatDate(entry.date)}
            {entry.edition && entry.edition !== 'manual' ? ` · ${entry.edition}` : ''}
          </span>
          {entry.subThread && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
              borderRadius: 3, padding: '1px 6px',
              letterSpacing: 0.5, textTransform: 'none',
            }}>
              {entry.subThread}
            </span>
          )}
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
          {entry.update}
        </p>
      </div>
    </div>
  );
}

function TopicCard({ timeline }) {
  const [expanded, setExpanded] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  const entries = sortAsc
    ? [...timeline.entries].reverse()
    : [...timeline.entries];

  return (
    <div style={{
      border: '1px solid var(--border-primary)',
      borderRadius: 12,
      background: 'var(--bg-card)',
      overflow: 'hidden',
      marginBottom: 10,
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', padding: '14px 20px',
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 16,
          background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{
              fontSize: 15, fontWeight: 600,
              color: 'var(--text-primary)',
              fontFamily: 'Playfair Display, serif',
            }}>
              {timeline.title}
            </span>
            {timeline.active && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                letterSpacing: 1, textTransform: 'uppercase',
                color: 'var(--accent)', border: '1px solid var(--accent)',
                borderRadius: 4, padding: '1px 5px', flexShrink: 0,
              }}>
                Active
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} />
            <span>
              Since {formatDate(timeline.firstSeen)}
              {' · '}{timeline.entries.length} update{timeline.entries.length !== 1 ? 's' : ''}
              {' · '}Last updated {formatDate(timeline.lastSeen)}
            </span>
          </div>
        </div>
        {expanded
          ? <ChevronUp size={16} style={{ color: 'var(--text-faint)', flexShrink: 0, marginTop: 3 }} />
          : <ChevronDown size={16} style={{ color: 'var(--text-faint)', flexShrink: 0, marginTop: 3 }} />
        }
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-primary)' }}>
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            padding: '8px 20px 0',
          }}>
            <button
              onClick={() => setSortAsc(s => !s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: 'var(--text-faint)',
                background: 'none', border: '1px solid var(--border-primary)',
                borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                letterSpacing: 0.5,
              }}
            >
              <ArrowUpDown size={11} />
              {sortAsc ? 'Oldest first' : 'Newest first'}
            </button>
          </div>
          <div style={{ padding: '12px 20px 16px' }}>
            {entries.map((entry, i) => (
              <TimelineEntry
                key={`${entry.date}-${entry.edition}-${i}`}
                entry={entry}
                isLast={i === entries.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TimelineView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetch('/api/timelines')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ color: 'var(--text-faint)', letterSpacing: 2, fontSize: 12, textAlign: 'center', padding: '80px 0' }}>
        LOADING...
      </div>
    );
  }

  const displayTimelines = buildDisplayTimelines(data?.timelines ?? []);
  const active = displayTimelines
    .filter(t => t.active)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  const inactive = displayTimelines
    .filter(t => !t.active)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

  if (!active.length && !inactive.length) {
    return (
      <div style={{ color: 'var(--text-faint)', fontSize: 14, textAlign: 'center', padding: '80px 0', lineHeight: 1.8 }}>
        No ongoing stories are being tracked yet.<br />
        Timelines are built automatically as reports are generated.
      </div>
    );
  }

  return (
    <div>
      {active.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <h2 style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: 3, color: 'var(--accent)', margin: 0, flexShrink: 0,
            }}>
              Ongoing Stories
            </h2>
            <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0 }}>
              {active.length} active
            </span>
          </div>
          {active.map(t => <TopicCard key={t.id} timeline={t} />)}
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <button
            onClick={() => setShowInactive(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              width: '100%', marginBottom: 16,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <h2 style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: 3, color: 'var(--text-muted)', margin: 0, flexShrink: 0,
            }}>
              Archived
            </h2>
            <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0 }}>
              {inactive.length} {showInactive ? '▲' : '▼'}
            </span>
          </button>
          {showInactive && inactive.map(t => <TopicCard key={t.id} timeline={t} />)}
        </section>
      )}
    </div>
  );
}
