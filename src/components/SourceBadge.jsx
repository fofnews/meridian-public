// lean prop: 'left' | 'center' | 'right' | null
// An outlet missing from the report's lean map (lean null) gets the neutral
// muted text color, not a lean color.

const LEAN_STYLES = {
  left:   { color: 'var(--lean-left)' },
  center: { color: 'var(--lean-center)' },
  right:  { color: 'var(--lean-right)' },
};
const NEUTRAL_STYLE = { color: 'var(--text-muted)' };

export function leanColor(lean) {
  return (LEAN_STYLES[lean] ?? NEUTRAL_STYLE).color;
}

export default function SourceBadge({ source, lean = null }) {
  const color = leanColor(lean);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{
        background: 'var(--source-center-bg)',
        border: '1px solid var(--source-center-border)',
        color,
      }}
    >
      {source}
    </span>
  );
}
