import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Sun, Moon, ArrowUp } from 'lucide-react';
import MapHero from './components/MapHero';
import DateNav from './components/DateNav';
import StoryCard from './components/StoryCard';
import SuggestionBox from './components/SuggestionBox';
import ArticlesView from './components/ArticlesView';
import TimelineView from './components/TimelineView';
import ErrorBoundary from './components/ErrorBoundary';
import { useTheme } from './ThemeContext.jsx';

export default function App() {
  const { isDark, toggleTheme } = useTheme();
  const [report, setReport] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEdition, setSelectedEdition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedStory, setExpandedStory] = useState(null);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [view, setView] = useState('analysis'); // 'analysis' | 'articles' | 'timeline'
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollAnchor = useRef(null);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (!scrollAnchor.current) return;
    const { element, top } = scrollAnchor.current;
    const delta = element.getBoundingClientRect().top - top;
    if (delta !== 0) window.scrollBy({ top: delta, behavior: 'instant' });
    scrollAnchor.current = null;
  });

  const loadReport = useCallback(async (date, edition) => {
    setLoading(true);
    setError(null);
    setExpandedStory(null);
    setFeaturedIdx(0);
    if (edition === 'articles-only') {
      setReport(null);
      setSelectedDate(date);
      setSelectedEdition(edition);
      setLoading(false);
      return;
    }
    try {
      const params = edition && edition !== 'manual' ? `?edition=${edition}` : '';
      const res = await fetch(`/api/report/${date}${params}`);
      if (!res.ok) throw new Error('Report not found');
      const data = await res.json();
      setReport(data);
      setSelectedDate(date);
      setSelectedEdition(edition);
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/dates')
      .then(r => r.json())
      .then(dates => {
        setAvailableDates(dates);
        if (!dates.length) { setLoading(false); return; }
        const [{ date, editions }] = dates;
        const edition = editions.includes('evening') ? 'evening'
          : editions.includes('morning') ? 'morning'
          : editions.includes('articles-only') ? 'articles-only' : 'manual';
        loadReport(date, edition);
      })
      .catch(() => setLoading(false));
  }, [loadReport]);

  // Defensive: if a story's `articles` is missing or malformed, treat it as
  // zero sources rather than throwing during App render (which would escape
  // the per-section boundaries below).
  const sourceCount = s => {
    const articles = Array.isArray(s?.articles) ? s.articles : [];
    return new Set(articles.map(a => a?.source).filter(Boolean)).size;
  };
  const multiSource = (report?.stories?.filter(s => sourceCount(s) >= 2) ?? [])
    .sort((a, b) => sourceCount(b) - sourceCount(a));
  const singleSource = report?.stories?.filter(s => sourceCount(s) < 2) ?? [];

  // Last-resort fallback for errors that escape the per-section boundaries
  // below (e.g. a throw in App's own body). The per-section boundaries handle
  // the common cases; this is the safety net for everything else.
  const appLevelFallback = (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg-primary)' }}
      role="alert"
    >
      <div
        style={{
          maxWidth: 440,
          textAlign: 'center',
          padding: '2.5rem 2rem',
          border: '1px solid var(--border-primary)',
          borderRadius: 8,
          background: 'var(--bg-secondary)',
        }}
      >
        <div
          className="font-display font-black uppercase"
          style={{ color: 'var(--accent)', fontSize: 13, letterSpacing: '3px', marginBottom: 16 }}
        >
          The Meridian
        </div>
        <div style={{ color: 'var(--text-primary)', fontSize: 15, marginBottom: 8 }}>
          Something went wrong loading the page.
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Please refresh your browser to try again.
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary label="the app" fallback={appLevelFallback}>
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>

      {/* Broadcast hero — silent failure so a bad story doesn't block the page */}
      {!loading && report && multiSource.length > 0 && (
        <ErrorBoundary
          label="map hero"
          fallback={null}
          resetKey={`${selectedDate}-${selectedEdition}-${featuredIdx}`}
        >
          <MapHero
            stories={multiSource}
            selectedIdx={featuredIdx}
            onSelect={setFeaturedIdx}
            edition={selectedEdition}
            selectedDate={selectedDate}
            availableEditions={availableDates.find(d => d.date === selectedDate)?.editions ?? []}
            onEditionSelect={edition => loadReport(selectedDate, edition)}
          />
        </ErrorBoundary>
      )}

      {/* Loading hero placeholder */}
      {loading && (
        <div
          className="w-full flex items-center justify-center"
          style={{ aspectRatio: '16/9', maxHeight: '75vh', minHeight: 'min(280px, 56vw)', background: 'var(--bg-secondary)' }}
        >
          <div style={{ color: 'var(--text-faint)', letterSpacing: '3px', fontSize: 13 }}>
            THE MERIDIAN
          </div>
        </div>
      )}

      {/* Date navigation */}
      <DateNav
        availableDates={availableDates}
        selectedDate={selectedDate}
        selectedEdition={selectedEdition}
        onSelect={loadReport}
      />

      {/* View tabs */}
      <div style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tabbar)' }}>
        <div className="max-w-5xl mx-auto px-4 flex gap-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[['analysis', 'Analysis'], ['articles', 'Articles'], ['timeline', 'Timeline']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="py-3 px-6 text-xs font-semibold uppercase tracking-widest cursor-pointer transition-colors border-b-2"
              style={{
                background: view === v ? 'rgba(232,197,71,0.06)' : 'transparent',
                color: view === v ? 'var(--accent)' : 'var(--text-muted)',
                borderColor: view === v ? 'var(--accent)' : 'transparent',
                letterSpacing: '2px',
              }}
              onMouseEnter={e => { if (view !== v) e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { if (view !== v) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {view === 'timeline' && (
          <ErrorBoundary label="the timeline">
            <TimelineView />
          </ErrorBoundary>
        )}

        {view === 'articles' && selectedDate && (
          <ErrorBoundary label="articles" resetKey={selectedDate}>
            <ArticlesView selectedDate={selectedDate} />
          </ErrorBoundary>
        )}

        {view === 'analysis' && loading && (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-faint)', letterSpacing: 2, fontSize: 12 }}>
            LOADING REPORT...
          </div>
        )}

        {view === 'analysis' && !loading && error && (
          <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
            {error}
          </div>
        )}

        {view === 'analysis' && !loading && report && (
          <ErrorBoundary label="the report" resetKey={`${selectedDate}-${selectedEdition}`}>
            <SuggestionBox />

            {/* Top Stories */}
            {multiSource.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-4 mb-6">
                  <h2
                    className="font-display font-bold shrink-0"
                    style={{ color: 'var(--text-primary)', fontSize: 20, letterSpacing: '0.5px' }}
                  >
                    Top Stories
                  </h2>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
                  <span className="text-xs shrink-0 font-semibold uppercase" style={{ color: 'var(--accent)', letterSpacing: '2px' }}>
                    {multiSource.length} stories
                  </span>
                </div>

                <div className="space-y-4">
                  {multiSource.map((story, i) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      expanded={expandedStory === story.id}
                      onToggle={(el) => {
                        scrollAnchor.current = { element: el, top: el.getBoundingClientRect().top };
                        const next = expandedStory === story.id ? null : story.id;
                        setExpandedStory(next);
                        if (next) setFeaturedIdx(i);
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* In Brief */}
            {singleSource.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-4">
                  <h2
                    className="font-display font-bold shrink-0"
                    style={{ color: 'var(--text-secondary)', fontSize: 20, letterSpacing: '0.5px' }}
                  >
                    In Brief
                  </h2>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
                  <span className="text-xs shrink-0 font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '2px' }}>
                    {singleSource.length} items
                  </span>
                </div>

                <div
                  className="rounded-xl overflow-hidden px-5"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                >
                  {singleSource.map(story => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      brief
                      expanded={expandedStory === story.id}
                      onToggle={(el) => {
                        scrollAnchor.current = { element: el, top: el.getBoundingClientRect().top };
                        setExpandedStory(expandedStory === story.id ? null : story.id);
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
          </ErrorBoundary>
        )}

        {view === 'analysis' && !loading && !error && !report && (
          <div className="text-center py-24" style={{ color: 'var(--text-faint)' }}>
            {selectedEdition === 'articles-only'
              ? 'Analysis not yet available — check back after the morning report.'
              : 'No reports available.'}
          </div>
        )}
      </main>

      <footer className="mt-16 pt-8 pb-12" style={{ borderTop: '2px solid var(--border-primary)' }}>
        <div className="max-w-5xl mx-auto px-4 text-center space-y-3">
          <div
            className="font-display font-black uppercase"
            style={{ color: 'var(--text-faint)', fontSize: 18, letterSpacing: '6px' }}
          >
            The Meridian
          </div>
          <div style={{ width: 40, height: 1, background: 'var(--accent)', margin: '0 auto', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-faint)', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase' }}>
            Multi-source news analysis
            {report && `  ·  ${report.articleCount} articles from ${report.sourceCount} sources`}
          </p>
        </div>
      </footer>

      {/* Scroll to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Back to top"
        style={{
          position: 'fixed',
          bottom: 72,
          right: 24,
          zIndex: 50,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          color: 'var(--accent)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          opacity: showScrollTop ? 1 : 0,
          transform: showScrollTop ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          pointerEvents: showScrollTop ? 'auto' : 'none',
        }}
      >
        <ArrowUp size={16} />
      </button>

      {/* Floating theme toggle */}
      <button
        onClick={toggleTheme}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 50,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          color: 'var(--accent)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
    </ErrorBoundary>
  );
}
