# Phone scroll fixes (follow-up to 2026-11-03 Part 2)

> **Status: Implemented and merged 2026-11-06.** Commit `463a5f09b` on `meridian-public` main. Manual check on a real iPhone still pending.

Branch: new branch `phone-scroll-fixes` from `main`. Same rules: ask before every commit and push, CSS custom properties only, don't touch data folders, never commit on `main`.

## What a check on the live site found (Nov 5, 375×812, Wed Nov 4 edition)

| Check | Result |
|---|---|
| Open a story mid-list | Pass: header stays visible (row at 449px, map bottom at 166px) |
| Close it by tapping the title | Pass: row 99px below the map |
| Close with "Collapse story" after scrolling deep | Pass: row 120px below the map |
| **Story A open, then open story B further down** | **Fail: B's header ends up 2,245px above the screen** |
| **Close with the map strip's close button after scrolling into the story** | **Fail: the page doesn't scroll; the closed row stays 449px above the screen** |
| **In Brief rows** | **Not handled: they shrink and grow the map but get no scroll fix** |
| Page width at 375 | Pass: 375 |
| `npx vitest run`, `npm run build` | Pass: 328 tests |

## Fix 1: scroll after React has updated the page, not before

`scrollRowBelowMap` runs in the same tick as `setExpandedStory`, so it measures the page *before* React re-renders it.

When story A sits above story B, opening B closes A in the same render, so B moves up by the whole height of A's open body. The target was computed against the old position, which is why B lands thousands of pixels off.

- Replace the direct calls with a pending request: `pendingPhoneScroll.current = { id, openBefore, openAfter }`.
  - Set it in `openTopItem`, in the map strip's `onCloseStory`, and in the In Brief `onToggle` (Fix 3).
- Add a `useLayoutEffect` that runs after `expandedStory` changes. If a request is pending:
  - find the row by `data-story-id`
  - compute the target from the page as it is now
  - scroll, then clear the request
- In `scrollRowBelowMap`, compute the part of the pinned area that isn't the map from the map height *before* the change: `stickyH - phoneMapHeight(openBefore, vh)`. It currently uses `phoneMapHeight(!openAfter)`. That's wrong when one story replaces another, where the map is 120px both before and after.
- **Map strip close:** the scroll request is made, but the page never moves. Most likely the smooth scroll is cancelled when the strip's close button unmounts or the page re-renders. Running the scroll from the layout effect should fix it. If smooth scrolling still gets cancelled, use `behavior: 'instant'` for that path.

## Fix 2: keep the visible-row shortcut, but measure only the header

The "already fully visible, don't scroll" test uses the whole card, and an open card's body is usually taller than the screen. Use the header button (`[data-story-open-header]`, or the row's `button[aria-expanded]`) for the visibility test, then scroll the card.

## Fix 3: In Brief rows on phones

On phones, In Brief rows also shrink the map when opened (`storyOpen` is `expandedStory !== null`) and grow it when closed. They still use the desktop `scrollAnchor` path, so closing one that sits just below the strip lets the map cover it. The Nov 3 handoff missed these rows.

On phones, route them through the same pending-scroll request as top stories. Desktop keeps `scrollAnchor`.

## Fix 4: map height shouldn't change while scrolling on a real phone

`MapHero` now sizes the closed map from `window.innerHeight`, which it updates on every `resize`. On iPhone Safari and Android Chrome the address bar collapses while you scroll, which fires resize events and changes `innerHeight`. So the closed map grows and shrinks by about 20px mid-scroll and resizes the map each time. The old CSS `28vh` didn't do this.

- Update `vh` only when the *width* changes (rotation), not when only the height does. Alternatively, measure a hidden probe element styled `height: 100lvh` and use its height.

## Check (phone, 375×812 and 390×844; then on a real phone)

- Story A open, open B two rows further down: B's header sits about 12px below the 120px map strip.
- Do the same with B above A: same result.
- Open a story, scroll 900px into it, close with the map strip's close button: the row sits about 12px below the full-size map.
- Scroll so an In Brief row sits right under the strip, open it, close it: the row is never covered.
- Every earlier check from 2026-11-03 Part 2 still passes.
- On a real iPhone: scroll the closed list slowly. The map height stays fixed while the address bar hides and shows.
- Desktop 1440: opening, closing and switching behave as before.
- Run `npx vitest run` and `npm run build`. Add a unit test for the before/after height math, including A→B with both open. Ask Dan before pushing.
