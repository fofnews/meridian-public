# Redesign: fixes before merging `redesign-desktop`

Branch: `redesign-desktop` (phases 0–8, f4a3042db). Work on that branch. Same rules as the redesign plan: ask before every commit and push, don't touch `reports/`, `articles/`, `topics/`, `timelines/`, CSS custom properties only.

Review results: 318 tests pass, the build passes, no data files changed, and the branch merges cleanly into current `main`. Map pinning, map-follows-story, one-open-at-a-time and clicked-row-stays-in-place all work. Fix the items below, then push the branch for a Vercel preview.

## Fix 1 (must): extra multi-source stories in a group disappear

`OpenStory.jsx` line ~262 builds threads from the lead story plus `singles` (members with ≤1 outlet). A group member with 2+ outlets that isn't the lead appears nowhere. It's not in a thread, and `App.jsx` `topRenderedIds` keeps it out of the top list and In Brief too. In recent editions 19 of 210 groups have this problem (e.g. Comey 14 + 3 outlets, Alaska 8 / 2 / 2, Swalwell 8 / 2). The eyebrow still counts them ("4 reports"), so the counts don't match what's shown.

- Make one "compared" thread per multi-source member, ordered by outlet count with the lead first. Title each thread with that story's title and use the meta line "N outlets · facts, headlines and disagreements". Keep the single-outlet thread last. This is the layout in the French-protests reference (`Threads` board): several compared threads plus one singles thread.
- The coverage panel, tabs and footer show the active thread's story.
- Fix the subtitle line in the same place. "N outlets compared" is the active thread's count; "N single-outlet reports" stays.
- Test: a group with lead (8 outlets) + member (3 outlets) + member (1 outlet) renders 3 threads, and every `storyId` in the group is reachable.

## Fix 2 (must): duplicate storyIds in a group

Reports can list the same id twice in `storyGroups[].storyIds` (Oct 26 evening, Chris Brown, `story-group-14`). This inflates "N reports" and duplicates React keys. In `buildGroupedItems`, dedupe: `[...new Set(group.storyIds)]`. Add a test.

## Fix 3 (should): headline shown twice in the open story

When an item is open, `StoryCard` still renders the closed header (eyebrow, title, subtitle, sources line), and `OpenStory` then renders the location line, the title again (with a Minus icon), and the subtitle again as the lede. When expanded, collapse the `StoryCard` header to the eyebrow, the read check and the close chevron, so the title appears once (in `OpenStory`). Keep it a single button with `aria-expanded` so the j/k/Enter shortcuts still work. Also drop the read-dimmed title color while the item is open: right now the open story's title turns grey the moment you open it, which reads as disabled.

## Fix 4 (should): small items

- View tabs (Facts/Headlines/…) and the thread buttons still use `--accent` and a hardcoded `rgba(232,197,71,0.06)`. Use `--gold-text` and a token.
- Closed-row outlet names have no separators and aren't sorted by lean. Sort left → center → right using `leanOf(leans, …)` and separate them with a middle dot or extra gap.
- Section heading "Covered by more than one outlet" is 20px. The reference uses 30px.
- Theme flash on load: `ThemeContext` sets `data-theme` in an effect. Add a tiny inline script in `index.html` that reads `meridian-theme` (try/catch) and sets `data-theme` before first paint.
- Settings unreachable when `MapHero` isn't rendered (an edition with no multi-source stories). Put a gear in the page header/footer fallback in that case.
- Footer time: "Analysis run at" uses `fetchedAt`. For an edition where stories were filled later (`analysisAddedAt`), keep `fetchedAt` (the main run) and don't show the later time. Just confirm this is the behavior and note it in a comment.
- The sticky map container is transparent. When tiles are slow or fail, the list text scrolls visibly behind the map. Give it `background: var(--bg-secondary)`. This is old behavior, not from the redesign, but it's a one-line fix.

## Verify

`npx vitest run`, `npm run build`. Then re-run the behavior list at the end of `2026-10-30-desktop-redesign.md`, plus: open the Comey group from Oct 2x (the one with 14 + 3) and confirm both compared threads show. Then ask Dan before pushing for a preview.
