import { Component } from 'react';

/**
 * Catches render-time exceptions in its subtree and shows a fallback UI
 * instead of taking the whole app down. If a `resetKey` prop is provided,
 * the boundary clears its error state whenever that key changes — useful
 * for letting the user recover by switching dates, editions, or tabs.
 *
 * Usage:
 *   <ErrorBoundary label="report" resetKey={`${date}-${edition}`}>
 *     <StoryCard ... />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={null}>  // silent: render nothing on error
 *     <MapHero ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  state = { error: null, prevResetKey: undefined };

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    // Reset error state whenever resetKey changes (new date/edition/etc).
    if (state.prevResetKey !== props.resetKey) {
      return { error: null, prevResetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.label ?? 'subtree', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    // Explicit opt-in to silent failure (e.g. the hero can just disappear).
    if (this.props.fallback !== undefined) return this.props.fallback;

    const { label } = this.props;
    return (
      <div
        role="alert"
        style={{
          padding: '2rem 1rem',
          margin: '1rem 0',
          textAlign: 'center',
          border: '1px solid var(--border-primary)',
          borderRadius: 8,
          background: 'var(--bg-secondary)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: 10,
            fontWeight: 600,
          }}
        >
          Something went wrong
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
          {label ? `Failed to render ${label}.` : 'Failed to render this section.'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Try switching dates or refreshing the page.
        </div>
      </div>
    );
  }
}
