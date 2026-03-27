import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import BroadcastHero from './components/BroadcastHero';
import DateNav from './components/DateNav';
import StoryCard from './components/StoryCard';
import SuggestionBox from './components/SuggestionBox';
import ArticlesView from './components/ArticlesView';

export default function App() {
  const [report, setReport] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEdition, setSelectedEdition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedStory, setExpandedStory] = useState(null);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [view, setView] = useState('analysis'); // 'analysis' | 'articles'
  const scrollAnchor = useRef(null);

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
          : editions.includes('morning') ? 'morning' : 'manual';
        loadReport(date, edition);
      })
      .catch(() => setLoading(false));
  }, [loadReport]);

  const sourceCount = s => new Set(s.articles.map(a => a.source)).size;
  const multiSource = (report?.stories?.filter(s => sourceCount(s) >= 2) ?? [])
    .sort((a, b) => sourceCount(b) - sourceCount(a));
  const singleSource = report?.stories?.filter(s => sourceCount(s) < 2) ?? [];

  return (
    <div className="min-h-screen" style={{ background: '#060810' }}>

      {/* Broadcast hero — only shown when we have data */}
      {!loading && report && multiSource.length > 0 && (
        <BroadcastHero
          stories={multiSource}
          selectedIdx={featuredIdx}
          onSelect={setFeaturedIdx}
          edition={selectedEdition}
          availableEditions={availableDates.find(d => d.date === selectedDate)?.editions ?? []}
          onEditionSelect={edition => loadReport(selectedDate, edition)}
        />
      )}

      {/* Loading hero placeholder */}
      {loading && (
        <div
          className="w-full flex items-center justify-center"
          style={{ aspectRatio: '16/9', maxHeight: '75vh', minHeight: 280, background: '#0a0d14' }}
        >
          <div style={{ color: '#4a5568', letterSpacing: '3px', fontSize: 13 }}>
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
      <div className="border-b border-[#1a2035]">
        <div className="max-w-5xl mx-auto px-4 flex gap-6">
          {['analysis', 'articles'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="py-3 text-xs font-semibold uppercase tracking-widest cursor-pointer transition-colors border-b-2"
              style={{
                color: view === v ? '#e8c547' : '#4a5568',
                borderColor: view === v ? '#e8c547' : 'transparent',
                letterSpacing: '2px',
              }}
            >
              {v === 'analysis' ? 'Analysis' : 'Articles'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {view === 'articles' && selectedDate && (
          <ArticlesView selectedDate={selectedDate} />
        )}

        {view === 'analysis' && loading && (
          <div className="flex items-center justify-center py-20" style={{ color: '#4a5568', letterSpacing: 2, fontSize: 12 }}>
            LOADING REPORT...
          </div>
        )}

        {view === 'analysis' && !loading && error && (
          <div className="text-center py-20" style={{ color: '#6b7a9a' }}>
            {error}
          </div>
        )}

        {view === 'analysis' && !loading && report && (
          <>
            <SuggestionBox />

            {/* Top Stories */}
            {multiSource.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-4 mb-6">
                  <h2
                    className="text-xs font-semibold uppercase tracking-widest shrink-0"
                    style={{ color: '#e8c547', letterSpacing: '3px' }}
                  >
                    Top Stories
                  </h2>
                  <div style={{ flex: 1, height: 1, background: '#1a2035' }} />
                  <span className="text-xs shrink-0" style={{ color: '#4a5568' }}>
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
                    className="text-xs font-semibold uppercase tracking-widest shrink-0"
                    style={{ color: '#6b7a9a', letterSpacing: '3px' }}
                  >
                    In Brief
                  </h2>
                  <div style={{ flex: 1, height: 1, background: '#1a2035' }} />
                  <span className="text-xs shrink-0" style={{ color: '#4a5568' }}>
                    {singleSource.length} items
                  </span>
                </div>

                <div
                  className="rounded-xl overflow-hidden px-5"
                  style={{ background: '#0a0d14', border: '1px solid #1a2035' }}
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
          </>
        )}

        {view === 'analysis' && !loading && !error && !report && (
          <div className="text-center py-24" style={{ color: '#4a5568' }}>
            No reports available.
          </div>
        )}
      </main>

      <footer className="mt-16 py-8" style={{ borderTop: '1px solid #1a2035' }}>
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p style={{ color: '#4a5568', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase' }}>
            The Meridian  ·  Multi-source news analysis
            {report && `  ·  ${report.articleCount} articles from ${report.sourceCount} sources`}
          </p>
        </div>
      </footer>
    </div>
  );
}
