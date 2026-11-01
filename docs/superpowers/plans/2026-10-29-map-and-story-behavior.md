# Map and story behavior before the redesign migration

Read this whole file, then propose a short plan before changing code. Work the tasks in order. One commit per task, and ask before each commit. Verify each task in the browser (`npm run dev`, site on :5174) before moving on. Follow CLAUDE.md conventions (CSS custom properties, no hardcoded colors). Don't touch `reports/`, `articles/`, `topics/` or `timelines/`.

## Behavior that must hold now and after the redesign

1. The map stays pinned at the top while the story list scrolls (`MapHero` is `position: sticky; top: 0`).
2. Opening a story moves the map to that story.
3. Opening a story closes the one that was open, and the story you clicked stays where it was on screen (`expandedStory` + `scrollAnchor` in `App.jsx`).
4. Nothing else moves the map: scrolling, tabs, read state and settings must not.

## Task 1 (first): stop the map re-flying on unrelated re-renders

Problem: in `src/App.jsx`, `multiSource` and `singleSource` are rebuilt with `filter().sort()` on every render of `App`, so `MapHero` receives a new `stories` array every time. `MapHero`'s fly effect depends on `[selectedIdx, stories]`, so every `App` re-render counts as a new selection: it resets `activeLocIdx` to 0, flies to the first location, redraws the source arcs and requests the boundary polygon again.

One trigger today: scrolling past 400px flips `showScrollTop`, which re-renders `App`. A reader who clicked a story's second location button sees the map snap back to the first. The redesign adds more `App`-level state (read checkmarks, settings, group threads), so this would happen constantly.

Fix:
- Memoize the derived lists (`allStories`, `multiSource`, `singleSource`, `allStoriesById`, `topItems`, `briefItems`) on `report` with `useMemo`.
- In `MapHero`, key the fly effect on the selected story's id, not on the array reference.

Verify:
- Open a story with two or more locations, click the second location button, then scroll past 400px and back. The map must not move.
- Add a temporary `console.count` inside the fly effect, confirm it fires once per story selection and never on scroll, then remove it.

## Task 2: select the map's story by id, not by list position

Problem: the map picks its story with `selectedIdx`, an index into `multiSource`. Stories that aren't in `multiSource` can't be shown. Inside a story group, `onToggle` only moves the map when `multiSource.indexOf(story) >= 0`, so opening a single-outlet story in a group leaves the map where it was. In the redesign, a group opens as one item with threads, and the map needs to follow that.

Fix:
- Replace `featuredIdx` with `featuredStoryId`. Pass `MapHero` the featured story object (look it up in `allStoriesById`) instead of `stories` + `selectedIdx`. Keep the default: the first multi-source story when nothing is open.
- Opening any story in the top section moves the map to it if its analysis has locations, including single-outlet stories inside a group. Leave In brief stories as they are (they don't move the map).
- If a story has no usable locations, keep the existing headline geocoding fallback.
- Update the `ErrorBoundary` `resetKey` to use the story id.
- `onSelect` is passed to `MapHero` but not used inside it; remove it unless you find a use.

Verify: open a single-outlet story inside a group (the Oct 28 morning "Israel Election Results" group has 12); the map moves to it. Open a multi-source story; the map moves. Open an In brief story; the map doesn't move.

## Task 3: leave room for the pinned map when scrolling to a story

Anything that scrolls to a story programmatically (future deep links like `/2026-10-28/morning/story-48`, j/k keyboard shortcuts, "Developing. Previously..." links) must land the story's header below the pinned map, not under it.

Fix:
- Have `MapHero` publish its current pinned height (map plus status strip, or just the 36px bar when the map is hidden) as a CSS custom property, e.g. `--map-sticky-height` on `document.documentElement`, updated with a `ResizeObserver`. The height is a `clamp()` and changes with hide/show and the landscape media query, so measure it rather than hardcoding.
- Give story cards `scroll-margin-top: calc(var(--map-sticky-height) + 12px)`.
- The existing click `scrollAnchor` behavior must not change.

Verify: in the console, `document.querySelector('[data-story-id]').scrollIntoView()` (add a `data-story-id` attribute to cards if there isn't one) lands the card's header just below the map, with the map shown and hidden.

## Task 4: don't load the map for readers who hid it

The map has two switches today: `mapVisible` (Hide Map / Show Map; the map stays loaded) and `mapEnabled` (`localStorage 'meridian-map'`; the map never loads, no UI control). The redesign's settings panel will have one "Show the map" toggle mapped to `mapVisible`.

Fix: if the page loads with `mapVisible` false, don't create the map until the reader shows it for the first time. Gate `useMeridianMap`'s init on `mapEnabled && hasBeenShown`, where `hasBeenShown` starts as `mapVisible` and becomes true the first time the map is shown. Never destroy and re-create the map on later hide/show; each creation is a billed map load.

Verify: set Hide Map, reload, and confirm in the Network tab that no Mapbox style or tile requests go out. Click Show Map; the map loads once. Hide and show again; no new map load.

## Task 5: requirements for the redesign migration (write down, don't build)

Add these as a "Redesign behavior requirements" section in `TODO.md` so they're checked when the new layout is built:

- A story group opens as one item. `expandedStory` holds the group's id. The active thread and active tab are separate state, reset to thread 1 and Facts each time a group or story opens. Switching threads or tabs never triggers `scrollAnchor` and never closes the item.
- Group ids (`group-0`) and story ids (`story-group-0`) are different namespaces; never compare across them.
- The map follows the open item's lead (multi-source) story. The "Single-outlet reports" thread keeps the lead story's location.
- Settings panel: a fixed slide-over above everything, including the fullscreen map (the map uses z-index 30 pinned and 50 fullscreen, so the panel needs 60 or more). Lock page scroll while it's open. Escape closes it (the fullscreen map also listens for Escape; the panel takes precedence when open). The gear must appear both in the map's status strip and in the Show Map bar, or settings can't be reached with the map hidden.
- Read checkmarks, settings and thread state must not cause map moves (covered by Task 1; re-test after the migration).

## Task 6 (last, no code): phone behavior

Phone layout will be its own redesign. Only add a note in `TODO.md`: the pinned map takes 45% of the screen height, which leaves a phone about half the screen for an open story with tabs. Options to decide later: shrink the map while a story is open, or let the map scroll away on narrow screens.

## Report back

After each task: what changed (files and a one-line summary) and how you verified it.
