// lean prop: 'left' | 'center' | 'right' | null
// CSS variables --lean-left, --lean-center, --lean-right defined in Phase 1 tokens.
// Fallbacks here are the dark-theme values from the Phase 1 spec so the badge
// renders correctly until Phase 1 is committed.
// TODO(Phase 1): remove the hex fallbacks once the color tokens exist.
// An outlet missing from the report's lean map (lean null) gets the neutral
// muted text color, not a lean color.

const LEAN_STYLES = {
  left:   { color: 'var(--lean-left,   #5b9fd4)' },
  center: { color: 'var(--lean-center, #b8b0a0)' },
  right:  { color: 'var(--lean-right,  #e06a6a)' },
};
const NEUTRAL_STYLE = { color: 'var(--text-muted)' };

export default function SourceBadge({ source, lean = null }) {
  const { color } = LEAN_STYLES[lean] ?? NEUTRAL_STYLE;
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
