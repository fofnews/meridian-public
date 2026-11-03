import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { ArrowUp, Settings } from 'lucide-react';
import MapHero from './components/MapHero';
import DateNav from './components/DateNav';
import StoryCard from './components/StoryCard';
import SuggestionBox from './components/SuggestionBox';
import BroadcastPanel from './components/BroadcastPanel';
import ArticlesView from './components/ArticlesView';
import TimelineView from './components/TimelineView';
import ErrorBoundary from './components/ErrorBoundary';
import SettingsPanel from './components/SettingsPanel';
import { leansFor } from './shared/source-leans.js';
import { getReadIds, markRead, markAllRead, clearRead } from './readState.js';
import { useSettings } from './SettingsContext.jsx';
import { loadMapVisible, saveMapVisible } from './settings.js';
import { shouldIgnoreKey, nextRowIndex } from './shortcuts.js';
import { buildGroupedItems } from './openStory.js';

const BRIEF_LIMIT = 10;

function outletCount(item) {
  return item.type === 'group'
    ? item.sources.length
    : new Set((item.story.articles ?? []).map(a => a?.source).filter(Boolean)).size;
}

const EDITION_WINDOWS = {
  morning: { name: 'Morning', window: '5:00 PM and 7:00 AM' },
  evening: { name: 'Evening', window: '7:00 AM and 5:00 PM' },
};

function editionStatsLine(report, date, edition) {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const w = EDITION_WINDOWS[edition];
  const head = w ? `${w.name} edition, ${day}` : day;
  const counts = `${report.articleCount} articles from ${report.sourceCount} outlets`;
  return w ? `${head}: ${counts}, collected between ${w.window}.` : `${head}: ${counts}.`;
}

export default function App() {
  const [report, setReport] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEdition, setSelectedEdition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedStory, setExpandedStory] = useState(null);
  const [featuredStoryId, setFeaturedStoryId] = useState(null);
  const [view, setView] = useState('analysis'); // 'analysis' | 'articles' | 'timeline' | 'suggestions' | 'broadcast'
  const adminSecret = new URLSearchParams(window.location.search).get('admin') ?? '';
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollAnchor = useRef(null);
  const [readIds, setReadIds] = useState(() => new Set());
  const [showAllBrief, setShowAllBrief] = useState(false);
  const { markOpened } = useSettings();
  const [mapVisible, setMapVisible] = useState(loadMapVisible);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('display');
  const openSettings = useCallback((tab = 'display') => { setSettingsTab(tab); setSettingsOpen(true); }, []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  useEffect(() => { saveMapVisible(mapVisible); }, [mapVisible]);

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

  const editionKey = selectedDate && selectedEdition ? `${selectedDate}-${selectedEdition}` : null;

  useEffect(() => {
    setReadIds(editionKey ? getReadIds(editionKey) : new Set());
  }, [editionKey]);

  const openTopItem = (el, itemId, leadId) => {
    scrollAnchor.current = { element: el, top: el.getBoundingClientRect().top };
    const next = expandedStory === itemId ? null : itemId;
    setExpandedStory(next);
    if (next) {
      setFeaturedStoryId(leadId);
      if (editionKey && markOpened) {
        markRead(editionKey, itemId);
        setReadIds(prev => (prev.has(itemId) ? prev : new Set(prev).add(itemId)));
      }
    }
  };

  const loadReport = useCallback(async (date, edition) => {
    setLoading(true);
    setError(null);
    setExpandedStory(null);
    setFeaturedStoryId(null);
    setShowAllBrief(false);
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

  const sourceCount = s => {
    const articles = Array.isArray(s?.articles) ? s.articles : [];
    return new Set(articles.map(a => a?.source).filter(Boolean)).size;
  };

  const { allStories, multiSource, singleSource, allStoriesById, storyGroups, topItems, briefItems, briefGroups, briefSingles } = useMemo(() => {
    const allStories = report?.stories ?? [];
    // !s.isParent and !s.parentId: backward-compat guards for old reports still
    // in the repo that contain empty parent containers and sub-thread stories.
    const multiSource = allStories
      .filter(s => !s.isParent && !s.parentId && sourceCount(s) >= 2)
      .sort((a, b) => sourceCount(b) - sourceCount(a));
    const singleSource = allStories
      .filter(s => !s.isParent && !s.parentId && sourceCount(s) < 2);
    const storyGroups = report?.storyGroups ?? [];
    const allStoriesById = new Map(allStories.map(s => [s.id, s]));
    const topItems = buildGroupedItems(multiSource, storyGroups, allStoriesById)
      .sort((a, b) => outletCount(b) - outletCount(a));
    const topRenderedIds = new Set(topItems.flatMap(item =>
      item.type === 'group' ? item.stories.map(s => s.id) : [item.story.id]
    ));
    const briefItems = buildGroupedItems(
      singleSource.filter(s => !topRenderedIds.has(s.id)),
      storyGroups,
      allStoriesById
    );
    const briefGroups = briefItems.filter(i => i.type === 'group');
    const briefSingles = briefItems.filter(i => i.type === 'story');
    return { allStories, multiSource, singleSource, allStoriesById, storyGroups, topItems, briefItems, briefGroups, briefSingles };
  }, [report]); // eslint-disable-line react-hooks/exhaustive-deps

  const leans = leansFor(report);
  const visibleBrief = showAllBrief ? briefSingles : briefSingles.slice(0, BRIEF_LIMIT);

  const renderBriefRow = story => (
    <StoryCard
      key={story.id}
      story={story}
      leans={leans}
      brief
      expanded={expandedStory === story.id}
      onToggle={el => {
        scrollAnchor.current = { element: el, top: el.getBoundingClientRect().top };
        setExpandedStory(expandedStory === story.id ? null : story.id);
      }}
    />
  );

  // Keyboard shortcuts. Enter needs no handler: rows are real buttons, so Enter
  // on a focused row already toggles it.
  useEffect(() => {
    if (view !== 'analysis') return;
    const onKey = e => {
      if (shouldIgnoreKey(e, settingsOpen)) return;
      if (e.key === '?') {
        e.preventDefault();
        openSettings('stories');
        return;
      }
      if (e.shiftKey) return;
      if (e.key === 'j' || e.key === 'k') {
        const rows = [...document.querySelectorAll('[data-story-id]')];
        const current = rows.findIndex(r => r.contains(document.activeElement));
        const i = nextRowIndex(current, rows.length, e.key === 'j' ? 1 : -1);
        if (i < 0) return;
        e.preventDefault();
        const row = rows[i];
        row.querySelector('button[aria-expanded]')?.focus({ preventScroll: true });
        row.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (/^[1-4]$/.test(e.key)) {
        const open = document.querySelector('[data-story-id] [role="tablist"]');
        const tab = open?.querySelectorAll('[role="tab"]')[Number(e.key) - 1];
        if (!tab) return;
        e.preventDefault();
        tab.click();
        tab.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, settingsOpen, openSettings]);

  const latestDate = availableDates[0];
  const latestEdition = latestDate
    ? (latestDate.editions.includes('evening') ? 'evening' : latestDate.editions.includes('morning') ? 'morning' : null)
    : null;
  const isLatestEdition = !!latestDate && selectedDate === latestDate.date && selectedEdition === latestEdition;

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

      {/* Map hero — silent failure so a bad story doesn't block the page */}
      {!loading && report && multiSource.length > 0 && (
        <ErrorBoundary
          label="map hero"
          fallback={null}
          resetKey={`${selectedDate}-${selectedEdition}-${featuredStoryId ?? multiSource[0]?.id ?? ''}`}
        >
          <MapHero
            featuredStory={featuredStoryId ? (allStoriesById.get(featuredStoryId) ?? multiSource[0]) : multiSource[0]}
            edition={selectedEdition}
            selectedDate={selectedDate}
            availableEditions={availableDates.find(d => d.date === selectedDate)?.editions ?? []}
            onEditionSelect={edition => loadReport(selectedDate, edition)}
            fetchedAt={report.fetchedAt}
            isLatest={isLatestEdition}
            mapVisible={mapVisible}
            onMapVisibleChange={setMapVisible}
            onOpenSettings={() => openSettings()}
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
          {[['analysis', 'Analysis'], ['articles', 'Articles'], ['timeline', 'Timeline'], ['suggestions', 'Suggestions'], ...(adminSecret ? [['broadcast', 'Broadcast']] : [])].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="py-3 px-6 text-xs font-semibold uppercase tracking-widest cursor-pointer transition-colors border-b-2"
              style={{
                background: view === v ? 'var(--gold-wash)' : 'transparent',
                color: view === v ? 'var(--gold-text)' : 'var(--text-muted)',
                borderColor: view === v ? 'var(--gold-text)' : 'transparent',
                letterSpacing: '2px',
              }}
              onMouseEnter={e => { if (view !== v) e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { if (view !== v) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {label}
            </button>
          ))}
          {!loading && !(report && multiSource.length > 0) && (
            <button
              onClick={() => openSettings()}
              aria-label="Settings"
              title="Settings"
              className="cursor-pointer flex items-center justify-center shrink-0 ml-auto"
              style={{ width: 44, height: 44, color: 'var(--text-muted)', background: 'none', border: 'none' }}
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {view === 'timeline' && (
          <ErrorBoundary label="the timeline">
            <TimelineView />
          </ErrorBoundary>
        )}

        {view === 'suggestions' && (
          <ErrorBoundary label="suggestions">
            <SuggestionBox />
          </ErrorBoundary>
        )}

        {view === 'broadcast' && adminSecret && (
          <BroadcastPanel
            currentEdition={selectedDate && selectedEdition && selectedEdition !== 'articles-only' ? `${selectedDate}-${selectedEdition}` : ''}
            adminSecret={adminSecret}
          />
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
            {/* Top Stories */}
            {multiSource.length > 0 && (
              <section className="mb-12">
                <div className="flex items-baseline gap-3 mb-6 flex-wrap">
                  <h2
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 6vw, 30px)', fontWeight: 600 }}
                  >
                    Covered by more than one outlet
                  </h2>
                  <span className="w-full sm:w-auto" style={{ color: 'var(--label)', fontFamily: 'var(--font-label)', fontSize: 12 }}>
                    · {topItems.length} {topItems.length === 1 ? 'story' : 'stories'}, most outlets first
                  </span>
                </div>

                <div>
                  {topItems.map(item => item.type === 'group' ? (
                    <StoryCard
                      key={item.group.id}
                      story={item.lead}
                      leans={leans}
                      group={{ id: item.group.id, label: item.group.label, stories: item.stories, sources: item.sources }}
                      read={markOpened && readIds.has(item.group.id)}
                      fetchedAt={report.fetchedAt}
                      expanded={expandedStory === item.group.id}
                      onToggle={el => openTopItem(el, item.group.id, item.lead.id)}
                    />
                  ) : (
                    <StoryCard
                      key={item.story.id}
                      story={item.story}
                      leans={leans}
                      read={markOpened && readIds.has(item.story.id)}
                      fetchedAt={report.fetchedAt}
                      expanded={expandedStory === item.story.id}
                      onToggle={el => openTopItem(el, item.story.id, item.story.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* In brief */}
            {briefItems.length > 0 && (
              <section style={{ marginTop: 56 }}>
                <h2
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, borderBottom: '1px solid var(--border-dim)', paddingBottom: 8 }}
                >
                  In brief <span style={{ color: 'var(--label)', fontFamily: 'var(--font-label)', fontSize: 13, fontWeight: 400 }}>· reported by one outlet</span>
                </h2>

                {briefGroups.map(item => (
                  <div key={item.group.id} style={{ padding: '16px 0 6px', borderBottom: '1px solid var(--border-primary)' }}>
                    <div className="flex flex-wrap items-baseline" style={{ gap: '6px 10px' }}>
                      <span className="uppercase font-bold" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '0.1em' }}>
                        {item.group.label}
                      </span>
                      <span style={{ color: 'var(--label)', fontFamily: 'var(--font-label)', fontSize: 12 }}>
                        · {item.stories.length} {item.stories.length === 1 ? 'report' : 'reports'} from {item.sources.length} {item.sources.length === 1 ? 'outlet' : 'outlets'}
                      </span>
                    </div>
                    {item.stories.map(story => renderBriefRow(story))}
                  </div>
                ))}

                {visibleBrief.map(item => renderBriefRow(item.story))}

                {briefSingles.length > BRIEF_LIMIT && (
                  <p style={{ margin: '16px 0 0', fontFamily: 'var(--font-label)', fontSize: 14 }}>
                    <button
                      onClick={() => setShowAllBrief(v => !v)}
                      aria-expanded={showAllBrief}
                      className="cursor-pointer"
                      style={{ color: 'var(--gold-text)', background: 'none', border: 'none', minHeight: 44, padding: 0, font: 'inherit' }}
                    >
                      {showAllBrief ? 'Show fewer' : `Show all ${briefSingles.length} single-outlet reports`}
                    </button>
                  </p>
                )}
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
          </p>
          {report && selectedDate && (
            <p style={{ color: 'var(--label)', fontFamily: 'var(--font-label)', fontSize: 12 }}>
              {editionStatsLine(report, selectedDate, selectedEdition)}
            </p>
          )}
        </div>
      </footer>

      <SettingsPanel
        open={settingsOpen}
        tab={settingsTab}
        onTabChange={setSettingsTab}
        onClose={closeSettings}
        mapVisible={mapVisible}
        onMapVisibleChange={setMapVisible}
        onMarkAllRead={() => {
          if (!editionKey) return;
          markAllRead(editionKey, topItems.map(item => (item.type === 'group' ? item.group.id : item.story.id)));
          setReadIds(getReadIds(editionKey));
        }}
        onClearRead={() => { clearRead(); setReadIds(new Set()); }}
      />

      {/* Scroll to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Back to top"
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
          opacity: showScrollTop ? 1 : 0,
          transform: showScrollTop ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          pointerEvents: showScrollTop ? 'auto' : 'none',
        }}
      >
        <ArrowUp size={16} />
      </button>
    </div>
    </ErrorBoundary>
  );
}
