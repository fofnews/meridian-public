// lean prop: 'left' | 'center' | 'right' | null
// CSS variables --lean-left, --lean-center, --lean-right defined in Phase 1 tokens.
// Fallbacks here are the dark-theme values from the Phase 1 spec so the badge
// renders correctly until Phase 1 is committed.

const LEAN_STYLES = {
  left:   { color: 'var(--lean-left,   #5b9fd4)' },
  center: { color: 'var(--lean-center, #b8b0a0)' },
  right:  { color: 'var(--lean-right,  #e06a6a)' },
};

export default function SourceBadge({ source, lean = null }) {
  const { color } = LEAN_STYLES[lean] ?? LEAN_STYLES.center;
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
