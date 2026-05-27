import { useState, useEffect, useRef } from 'react';

export default function BroadcastPanel({ currentEdition = '', adminSecret = '' }) {
  const [edition, setEdition] = useState(currentEdition);
  const [log, setLog] = useState('');
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const logRef = useRef(null);

  useEffect(() => {
    if (status === 'idle') setEdition(currentEdition);
  }, [currentEdition]);

  async function generate() {
    if (status === 'running' || !edition.trim()) return;
    setStatus('running');
    setLog('');
    try {
      const res = await fetch('/api/broadcast/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ edition: edition.trim() }),
      });
      if (!res.ok) {
        setLog(`Error ${res.status}: ${await res.text()}`);
        setStatus('error');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setLog(prev => {
          const next = prev + decoder.decode(value, { stream: true });
          if (logRef.current) setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 0);
          return next;
        });
      }
      setStatus('done');
    } catch (err) {
      setLog(prev => prev + `\n[client error: ${err.message}]`);
      setStatus('error');
    }
  }

  function reset() {
    setStatus('idle');
    setLog('');
  }

  const isRunning = status === 'running';
  const btnLabel = isRunning ? 'Running...' : status === 'done' ? 'Done ✓' : status === 'error' ? 'Failed' : 'Generate';
  const btnBg = status === 'done' ? 'var(--bg-agree)' : status === 'error' ? 'rgba(232,117,71,0.15)' : 'var(--accent)';
  const btnColor = status === 'done' ? 'var(--section-agree-accent)' : status === 'error' ? '#e87547' : 'var(--accent-text)';
  const btnBorder = status === 'done' ? '1px solid var(--border-agree)' : status === 'error' ? '1px solid #e87547' : 'none';

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <h2 className="font-display font-bold shrink-0" style={{ color: 'var(--text-primary)', fontSize: 20, letterSpacing: '0.5px' }}>
          Broadcast
        </h2>
        <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
        <div className="px-5 py-4">
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Generate a broadcast video from a report edition. Runs the full pipeline: shotlist → narration → Remotion render → finalize.
          </p>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={edition}
              onChange={e => setEdition(e.target.value)}
              placeholder="e.g. 2026-05-25-evening"
              disabled={isRunning}
              className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-secondary)',
                fontFamily: 'monospace',
                opacity: isRunning ? 0.5 : 1,
              }}
            />
            <button
              onClick={generate}
              disabled={!edition.trim() || isRunning}
              className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest shrink-0"
              style={{
                background: btnBg,
                color: btnColor,
                border: btnBorder,
                letterSpacing: '2px',
                cursor: !edition.trim() || isRunning ? 'default' : 'pointer',
                opacity: !edition.trim() || isRunning ? 0.5 : 1,
              }}
            >
              {btnLabel}
            </button>
            {(status === 'done' || status === 'error') && (
              <button
                onClick={reset}
                className="px-3 py-2 rounded-lg text-xs"
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)', color: 'var(--text-faint)', cursor: 'pointer' }}
              >
                Reset
              </button>
            )}
          </div>

          {log && (
            <pre
              ref={logRef}
              style={{
                background: '#080808',
                border: '1px solid var(--border-primary)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#9a9a9a',
                maxHeight: 400,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                marginTop: 4,
              }}
            >
              {log}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
