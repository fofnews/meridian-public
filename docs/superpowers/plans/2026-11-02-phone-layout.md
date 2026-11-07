# Phone layout (Option A: the map shrinks to a pinned strip)

Reference: the phone row on the Meridian Restyle canvas (boards `PhoneList`, `PhoneStoryOpen`, `PhoneA`, `PhoneDisagree`, `PhoneSettings`). Ignore the `PhoneB` board. That option was rejected.

"Phone" means viewport width below 640px (Tailwind `sm`). Desktop and tablet behavior must not change. For JS-driven behavior add a small `useIsPhone()` hook (`matchMedia('(max-width: 639px)')`, listens for changes). Use CSS for everything else.

Rules as before:
- Ask before every commit and push.
- Don't touch `reports/`, `articles/`, `topics/`, `timelines/`.
- Use CSS custom properties only.
- Never commit on `main`.

## Branches and order

- **Task 0** goes on `redesign-desktop`, before that branch merges. Without it the desktop merge ships a broken phone page.
- Stop after Task 0 and ask Dan to merge.
- Then branch `redesign-phone` from `main` for Tasks 1–8.

## Task 0: the page is wider than the phone

At 375px the page lays out at 452px. The phone zooms out to fit, so everything shrinks. The cause is the "Covered by more than one outlet" `<h2>` in `App.jsx`, which has `className="shrink-0"` at 30px, so it can't wrap.

- Remove `shrink-0`. Set the font size to `clamp(24px, 6vw, 30px)`.
- On phones, put the "· N stories, most outlets first" line on its own line.
- Look for any other element wider than the viewport. Run `document.documentElement.scrollWidth === innerWidth` at 375 and 390, with the list closed, with a story open, and with Settings open.
- Add a test or Playwright check for that comparison.

## Task 1: map height

`MapHero` currently uses `clamp(220px, 45vh, 560px)`. On phones:
- **No story open:** `clamp(180px, 28vh, 240px)`.
- **A story open:** 120px. Animate the height (about 200ms). The existing ResizeObserver already resizes the map and updates `--map-sticky-height`. Confirm the map re-fits to the story's location after the resize finishes, not before.
- **Full-screen map:** unchanged.

## Task 2: the map strip doesn't take touch gestures

At phone width the inline map is a picture that follows the story. Swiping on it must scroll the page, not pan the map.
- On phones, disable `dragPan`, `touchZoomRotate`, `scrollZoom` and `doubleClickZoom` on the inline map, and re-enable them when you leave phone width.
- Tapping the map opens full screen. Full screen keeps every gesture.
- Hide the +/− buttons on phones. Keep the full-screen button at 44×44.
- Location chips stay. Clicking a chip still moves the map.

## Task 3: the bar under the map

At phone width the status strip shows only:
- the wordmark "The Meridian" (Newsreader, 18px)
- an AM/PM segmented switch, if the date has both editions
- the gear (44×44)

Hide "Analysis run at…" and the date on phones. The date pills already show the date, and the run time is in the footers.

While a story is open, swap the strip's contents for the open story's title (one line, truncated with an ellipsis) and a close button (44×44). Show the swap only once the story's own header has scrolled up under the strip; use an IntersectionObserver on the header. Before that, keep the normal strip, so the title never shows twice on screen.

## Task 4: dates and view tabs

- **`DateNav` on phones:** one row of fixed-width pills (70×36) that scrolls sideways, with no wrapping and no `flex: 1 1 0`.
  - Labels are short weekday plus day ("Sat 31"), so nothing is cut off with "…".
  - Scroll the selected pill into view on load and on change.
- **View tabs (Analysis/Articles/Timeline/Suggestions):** reduce the horizontal padding so all four fit at 375px. Keep `overflow-x: auto` as a fallback.

## Task 5: closed story rows

- Title 21px; the lead headline 15px.
- Show at most 3 outlet names on the sources line, sorted by lean as now, then "+N". Desktop stays at 6.
- Keep the disagreement count and the read check.

## Task 6: open story

Match `PhoneStoryOpen` and `PhoneA`.

- **Edge to edge:** on phones the expanded `StoryCard` loses its rounded border and card background, and the inner `px-6` becomes `px-4`. No boxes inside boxes.
- **Scroll on open:** when a story opens on a phone, scroll so its header sits just below the sticky map strip. The desktop "clicked row stays in place" rule doesn't apply here, because the map shrinking moves everything anyway.
- **Threads:**
  - Two threads sit side by side as compact buttons: the title clamped to two lines (13px, semibold) plus the meta line (12px).
  - Three or more threads go in one row that scrolls sideways, each button up to 70% of the width.
- **Coverage panel:** goes below the summary at full width. On phones its left border becomes a top border. Keep the dot bar plus one Left/Center/Right row each.
- **Section tabs (Facts/Headlines/Disagreements/Context):** pinned with `position: sticky; top: var(--map-sticky-height)` and a solid `var(--bg-primary)` background.
  - The row scrolls sideways if it doesn't fit.
  - Note: the expanded `StoryCard` currently has `overflow: hidden`, which breaks sticky. Remove it, or move the clipping to an inner element.
- **Switching tabs:** if the tab row is pinned, scroll back so the new tab's content starts just under it.
- **Disagreements:** each outlet's name sits on its own line in its lean color, with the position text under it (16px). No side-by-side columns.

## Task 7: Settings as a bottom sheet

Below 640px, `SettingsPanel` becomes a sheet:
- Anchored to the bottom with `top: 56px`, full width, top corners rounded 14px.
- A drag handle drawn at the top. It's decoration only; it doesn't need to drag.
- Slides up when opening.
- The tabs stretch to equal widths.
- Same contents, scroll lock, focus trap, Escape and the dimmed background as now.
- Desktop keeps the 440px side panel.

## Task 8: check it

- Playwright at 375×812 and 390×844, in dark and light, at these points: the list, a story just opened, scrolled into Facts, the Disagreements tab, Settings open. In every one, `scrollWidth === innerWidth`.
- Desktop at 1440 and 1024 is unchanged; compare screenshots before and after.
- Run `npx vitest run` and `npm run build`.
- Then ask Dan before pushing for a Vercel preview, so he can check it on his own phone. Ask him in particular whether the 120px strip is still worth looking at at city zoom levels.
