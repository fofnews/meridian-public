# Open story fixes: the title closes the story (Part 1), the map stops covering the row on phones (Part 2)

Branch: `redesign-phone`, which isn't merged yet. Same rules: ask before every commit and push, CSS custom properties only, don't touch data folders.

## Part 1: the title closes the story

### Problem

A closed story opens from anywhere on its row. Once it's open, the only thing that closes it is the header `<button>` in `StoryCard.jsx`. For a single story that isn't read yet, that button has no text at all, just the chevron. For a group, it holds only the "Developing story" line.

The title the reader sees sits outside that button. It's the `<h3>` with the Minus icon at the top of `OpenStory.jsx`. So readers click the title to close the story and nothing happens.

The same split causes a phone bug: `MapHero` watches `[data-story-open-header]` (that same button) to decide when to put the story title in the map strip. The button is nearly empty, so it scrolls out of view while the real title is still on screen, and for a moment the title shows twice.

### Change

Move the header into the button so a single button holds everything at the top of an open story.

1. **`StoryCard.jsx`, when expanded:** the header button contains, in order:
   - the eyebrow row, as now: the read check, plus "Developing story · N reports" for groups
   - the location line, moved from `OpenStory` (gold, 13px, label font, `locations.join(' · ')`)
   - the title, moved from `OpenStory`. Use the same style: display font, 28px desktop and 24px phone, weight 600, line height 1.18, `var(--text-primary)`. Make it a `<span>` with `display: block`; an `<h3>` isn't allowed inside a `<button>`. Drop the Minus icon. The chevron already shows the open state.
   - on the right: the up chevron plus a "Close" label in the label font (13px, `var(--label)`) on desktop. Phones show just the chevron, at least 44×44.

   Remove the `aria-label` override on the expanded button; the visible title now names it. The button keeps `aria-expanded`, `data-story-open-header` and the existing `onToggle`.

2. **`OpenStory.jsx`:** delete the location line and the `<h3>` title. It now starts with the group meta line ("N outlets in all · …") and the thread buttons for groups, and with the summary for single stories. Keep the top spacing sensible; remove `mt-1` and similar leftovers.

3. **Hover and focus:** on desktop, hovering anywhere on the header button underlines nothing and dims nothing. The cursor becomes a pointer and the "Close" label turns `var(--gold-text)`. Keyboard focus shows the existing focus ring around the whole header.

4. **Don't change:**
   - the closed row
   - the "Close story" button at the bottom of `OpenStory` (`onCollapse`)
   - j/k/Enter shortcuts; Enter on the focused header button still toggles
   - the map strip swap on phones. It now works properly, because the observed element contains the title.

### Check

- **Desktop 1440:** open a single story and a group. Clicking the title, the location line, the eyebrow or the empty space beside them closes the story. The thread buttons, tabs, facts and the coverage panel don't close it.
- **Phone 390:**
  - Tapping the title closes the story.
  - Scroll an open story: the title appears in the map strip only once the title has scrolled under the strip. It never shows twice.
  - The tap target for the whole header is at least 44px tall.
- **Tests and build:** update any test that looks for the `<h3>` in `OpenStory`. Run `npx vitest run` and `npm run build`.
- Ask Dan before pushing.

## Part 2 (phones): closing a story lets the map cover the row

### Problem

On phones the map is 120px while a story is open and `clamp(180px, 28vh, 240px)` otherwise (`MapHero.jsx`, `phoneHeight`). Closing a story grows the pinned map back by about 60–120px. Nothing scrolls to make up for it, so the map now covers the row the reader just closed.

- `openTopItem` in `App.jsx` sets `scrollAnchor` only on desktop.
- The phone effect only runs when a story opens (`expandedStory` set), never on close.

Opening has a smaller version of the same fault. The phone effect calls `scrollIntoView` 50ms into a 200ms height animation. The card's `scroll-margin-top` reads `--map-sticky-height` while it's still changing, so where the header lands depends on timing.

### Change

Scroll against the height the pinned area *will* have, not the height it has mid-animation.

1. Add one shared helper, for example in `src/phoneLayout.js`: `phoneMapHeight(storyOpen, viewportHeight)`. It returns 120 when a story is open, otherwise `Math.min(240, Math.max(180, 0.28 * viewportHeight))`. `MapHero` uses it for its height, as px instead of the CSS clamp, so the two can never disagree. Recompute on resize.
2. Add a helper `scrollRowBelowMap(rowEl, storyOpenAfter)`:
   - final pinned height = the pinned area's current `offsetHeight`, minus the current map height, plus `phoneMapHeight(storyOpenAfter, innerHeight)`
   - target = the row's top on the page minus that final height minus 12
   - `window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })`
   - Call it in the same tick as the state change, so the scroll and the height animation run together.
3. **On phones, opening a story:** replace the 50ms `scrollIntoView` effect with `scrollRowBelowMap(card, true)`.
4. **On phones, closing a story:** call `scrollRowBelowMap(card, false)` for the row that closed. Every way of closing must go through this:
   - the header button (now including the title, from Part 1)
   - the "Close story" button at the bottom of `OpenStory`
   - the close button in the map strip
   - opening a different story, which closes the old one. In that case scroll for the *new* row with `storyOpenAfter = true`, as in step 3.
5. Desktop keeps the existing `scrollAnchor` behavior, unchanged.
6. If the reader has scrolled so the closed row is already fully visible below the final pinned height, don't scroll.

### Check (phone, 375×812 and 390×844)

- Open a story near the middle of the list, then close it by tapping its title. The row's title ends up fully visible just below the map, about 12px under it. It's never covered.
- Do the same, closing with the bottom "Close story" button after scrolling deep into Facts. The page scrolls back up so the closed row sits just below the map.
- Close with the map strip's close button. Same result.
- With story A open, open story B further down. B's header lands just below the 120px strip.
- Open and close the first story at the top of the page. Nothing scrolls above the top, and nothing jumps twice.
- Desktop 1440: opening and closing behave exactly as before.
- Run `npx vitest run` and `npm run build`, adding a unit test for `phoneMapHeight`. Ask Dan before pushing.
