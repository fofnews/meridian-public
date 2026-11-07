# Phone: opening a story further down lands on its Facts, not its header

Branch: `tab-scroll-fix` from `main`. Same rules: ask before every commit and push, CSS custom properties only, never commit on `main`.

## What a check on Nov 7 found

The Nov 5 fixes work: closing by tapping the title, by "Collapse story", from the map strip, and In Brief rows. One case still fails: **with story A open, tap story B further down the list.** B's header ends up about 890px above the screen, and the reader lands partway into B's Facts.

Trace (Playwright, 375×812, Nov 7 morning edition, local build of `main`):
- `scrollRowBelowMap` correctly scrolls to 1026, which puts B's header just under the map strip.
- Then a second `window.scrollTo` sends the page to 1924. It comes from the tab-row effect in `OpenStory.jsx` (around line 311).

## Cause

That effect is meant to run when the reader switches tabs while the tab row is pinned. It also runs once when `OpenStory` first mounts, with deps `[tab, isPhone]`.

When B opens, A closes in the same render. B's content jumps up by A's height, so for that moment B's tab row is far above the screen. The "is it pinned" test only checks `rowRect.top > stickyH + 20`, so anything above the strip counts as pinned. The effect then scrolls to B's tab panel and overrides the correct scroll.

## Change

1. Skip the effect on mount. Keep a `didMount` ref: the first run sets it and returns, so only real tab changes scroll.
2. Tighten the pinned test: the row counts as pinned only when `Math.abs(rowRect.top - stickyH) <= 20`, not anywhere above the strip.

## Check (375×812 and 390×844)

- A open, tap B two rows further down: B's header sits about 12px below the 120px strip. Also check with B above A.
- Inside an open story, scroll until the tab row pins, then switch Facts → Disagreements: the content starts right under the tab row, as before.
- Switching tabs when the tab row isn't pinned doesn't scroll.
- Every Nov 5 check still passes.
- Run `npx vitest run` and `npm run build`. Ask Dan before pushing.
