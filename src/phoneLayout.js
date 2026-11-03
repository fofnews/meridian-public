// Shared phone layout helpers. Keep in sync with MapHero.jsx's phoneHeight calc.

export function phoneMapHeight(storyOpen, viewportHeight) {
  if (storyOpen) return 120;
  return Math.min(240, Math.max(180, 0.28 * viewportHeight));
}

// Scroll rowEl so it sits 12px below the sticky map strip after the map
// finishes animating to its new height (determined by storyOpenAfter).
// Call in the same tick as the React state change so the CSS transition
// and the scroll animation start together.
export function scrollRowBelowMap(rowEl, storyOpenAfter) {
  if (!rowEl) return;
  const vh = window.innerHeight;
  // The full sticky area height (map + strip) is published by MapHero's ResizeObserver.
  const stickyH = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--map-sticky-height')
  ) || 0;
  // Non-map portion (strip + any other chrome) stays constant.
  const nonMapH = stickyH - phoneMapHeight(!storyOpenAfter, vh);
  const finalH = nonMapH + phoneMapHeight(storyOpenAfter, vh);

  const rowRect = rowEl.getBoundingClientRect();
  // If the row is already fully visible below the final pinned height, do nothing.
  if (rowRect.top >= finalH + 12 && rowRect.bottom <= vh) return;

  const target = rowRect.top + window.scrollY - finalH - 12;
  window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
}
