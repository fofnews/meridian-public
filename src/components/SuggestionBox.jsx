import { useState, useEffect } from 'react';

export default function SuggestionBox() {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [votedIds, setVotedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('meridian_voted') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    if (open) fetchSuggestions();
  }, [open]);

  async function fetchSuggestions() {
    try {
      const res = await fetch('/api/suggestions');
      setSuggestions(await res.json());
    } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        setText('');
        fetchSuggestions();
      } else {
        setSubmitError('Failed to submit. Please try again.');
      }
    } catch {
      setSubmitError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(id) {
    if (votedIds.has(id)) return;
    const res = await fetch(`/api/suggestions/${id}/vote`, { method: 'POST' });
    if (res.ok) {
      const updated = await res.json();
      setSuggestions(prev =>
        prev.map(s => s.id === id ? updated : s).sort((a, b) => b.votes - a.votes)
      );
      const next = new Set(votedIds);
      next.add(id);
      setVotedIds(next);
      localStorage.setItem('meridian_voted', JSON.stringify([...next]));
    }
  }

  return (
    <div className="mb-6 rounded-xl overflow-hidden" style={{ border: '1px solid #1a2035' }}>
      {/* Collapsible tab header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
        style={{ background: '#0a0d14' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#e8c547', letterSpacing: '3px' }}>
            Suggestions
          </span>
          {suggestions.length > 0 && !open && (
            <span className="text-xs" style={{ color: '#4a5568' }}>{suggestions.length} submitted</span>
          )}
        </div>
        <span style={{ color: '#4a5568', fontSize: 12, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ background: '#0a0d14', borderTop: '1px solid #1a2035' }}>
          {/* Submit form */}
          <form onSubmit={handleSubmit} className="px-5 py-4 flex gap-3">
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Submit a suggestion..."
              maxLength={280}
              className="flex-1 rounded-lg px-4 py-2 text-sm outline-none"
              style={{
                background: '#060810',
                border: '1px solid #1a2035',
                color: '#c8c0b0',
                caretColor: '#e8c547',
              }}
            />
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-opacity"
              style={{
                background: '#e8c547',
                color: '#060810',
                letterSpacing: '2px',
                opacity: !text.trim() || submitting ? 0.4 : 1,
                cursor: !text.trim() || submitting ? 'default' : 'pointer',
              }}
            >
              Submit
            </button>
          </form>

          {submitError && (
            <p className="px-5 pb-3 text-xs" style={{ color: '#e87547' }}>{submitError}</p>
          )}

          {/* Suggestions list */}
          {suggestions.length > 0 && (
            <div className="px-5 pb-4 space-y-2">
              <div style={{ height: 1, background: '#1a2035', marginBottom: 12 }} />
              {suggestions.map(s => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-4 py-2"
                  style={{ borderBottom: '1px solid #1a2035' }}
                >
                  <p className="text-sm flex-1" style={{ color: '#c8c0b0', lineHeight: 1.5 }}>{s.text}</p>
                  <button
                    onClick={() => handleVote(s.id)}
                    disabled={votedIds.has(s.id)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs shrink-0 transition-opacity"
                    style={{
                      background: votedIds.has(s.id) ? '#1a2035' : '#111827',
                      border: `1px solid ${votedIds.has(s.id) ? '#e8c547' : '#1a2035'}`,
                      color: votedIds.has(s.id) ? '#e8c547' : '#6b7a9a',
                      cursor: votedIds.has(s.id) ? 'default' : 'pointer',
                    }}
                  >
                    ▲ {s.votes}
                  </button>
                </div>
              ))}
            </div>
          )}

          {suggestions.length === 0 && (
            <p className="px-5 pb-4 text-xs" style={{ color: '#4a5568' }}>No suggestions yet. Be the first!</p>
          )}
        </div>
      )}
    </div>
  );
}
