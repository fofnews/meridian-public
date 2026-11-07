# Phone: switching tabs while the tab row is pinned drops the reader past the story

Branch: `tab-switch-fix` from `main`. Same rules: ask before every commit and push, never commit on `main`.

## What the Nov 7 check found (production build of `main` at 2c364fe3e, 375×812)

The mount fix (ee33cf37f) works: opening story B while A is open now lands B's header 12px under the strip. All the open/close checks pass.

The tighter "is it pinned" test broke the case this effect exists for:
1. Open a story and scroll about 1,200px into Facts. The tab row is pinned at 166px, right under the strip.
2. Tap Disagreements.
3. Result: the tab row ends up at −575 and the Disagreements panel at −990, both above the screen. The reader is looking at the stories below.

## Cause

The effect decides "pinned" *after* React has swapped the tab content. Disagreements is much shorter than Facts, so the story gets shorter, the page's scroll position is now past its end, and the tab row is no longer sticky by the time the effect measures it. `Math.abs(rowRect.top - stickyH) > 20` is true, so it skips the scroll. The old test (`rowRect.top > stickyH + 20`) would have scrolled, but to a position measured from the unpinned row, so it was wrong too, just less obviously.

## Change

Decide at the tap, scroll after the update:

1. In the tab button's click handler (and in the arrow-key handler), *before* `setTab`, measure the tab row. If `Math.abs(tabRow.top - stickyH) <= 20`, set `pendingTabScroll.current = true`.
2. Replace the current effect with a `useLayoutEffect` on `[tab]`. If `pendingTabScroll.current` is set, clear it and scroll so the panel starts just under the pinned tab row:
   `target = scrollY + panel.getBoundingClientRect().top - (stickyH + tabRow.offsetHeight)`
   Use the row's *height*, not its current `bottom`, because the row may be unpinned at this point. Use `behavior: 'instant'` so the reader never sees the page below the story.
3. Remove the `didMountTab` ref. Mount never sets `pendingTabScroll`, so the mount problem can't come back.
4. Same for thread buttons: if the tab row is pinned when a thread is picked, keep the new thread's content in view in the same way.

Note: in `npm run dev`, React StrictMode runs effects twice on mount, so test the scroll behavior with `npm run build && npx vite preview`, not the dev server.

## Check (production build, 375×812 and 390×844)

- Scroll 1,200px into Facts, tap Disagreements: the panel starts right under the pinned tab row, and the tab row is still pinned. Then tap Headlines, then Facts: same.
- Tap a tab while the tab row is not pinned: no scroll.
- A open, tap B further down: B's header is 12px under the strip (the ee33cf37f fix still holds).
- All Nov 5 open/close checks still pass.
- Run `npx vitest run` and `npm run build`. Ask Dan before pushing.
