// Shared phone layout helpers. Keep in sync with MapHero.jsx's phoneHeight calc.

export function phoneMapHeight(storyOpen, viewportHeight) {
  if (storyOpen) return 120;
  return Math.min(240, Math.max(180, 0.28 * viewportHeight));
}

// Scroll rowEl so it sits 12px below the sticky map strip after the map
// finishes animating to its new height. Call from a useLayoutEffect that
// fires after expandedStory changes so the DOM reflects the new layout.
//
// openBefore/openAfter must be passed separately: when switching A→B both
// are true and the old code's !openAfter shortcut would compute the wrong
// nonMapH (it would assume the map was closed before).
export function scrollRowBelowMap(rowEl, openBefore, openAfter, { instant = false } = {}) {
  if (!rowEl) return;
  const vh = window.innerHeight;
  // The full sticky area height (map + strip) is published by MapHero's ResizeObserver.
  const stickyH = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--map-sticky-height')
  ) || 0;
  // Non-map portion (strip + any other chrome) stays constant; use openBefore
  // to get the correct map height that was in effect before this change.
  const nonMapH = stickyH - phoneMapHeight(openBefore, vh);
  const finalH = nonMapH + phoneMapHeight(openAfter, vh);

  // Use only the story header for the visibility test, not the whole open card
  // (an open card body is usually taller than the screen, which defeats the check).
  const headerEl = rowEl.querySelector('[data-story-open-header]') ?? rowEl.querySelector('button[aria-expanded]');
  const testRect = (headerEl ?? rowEl).getBoundingClientRect();
  if (testRect.top >= finalH + 12 && testRect.bottom <= vh) return;

  const rowRect = rowEl.getBoundingClientRect();
  const target = rowRect.top + window.scrollY - finalH - 12;
  window.scrollTo({ top: Math.max(0, target), behavior: instant ? 'instant' : 'smooth' });
}
