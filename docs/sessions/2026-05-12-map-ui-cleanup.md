# Session — 2026-05-12

## What was worked on

Three small map UI cleanups in `MapHero.jsx`.

### Change 1 — Removed story selector from website map

The story selector panel (up to 6 truncated headline buttons that fly the map to each story) was removed from `MapHero.jsx`. It belongs to the broadcast/operator workflow and was creating confusion on the public site. A `TODO.md` was created at the project root noting that the feature should be properly implemented in `BroadcastStage.jsx` for preview-mode use.

### Change 2 — "Hide Map" button now matches "Show Map"

The `▲` icon button that was part of the zoom controls column was removed. "Hide Map ▲" is now a text button in the status strip, placed to the right of the clock, matching the style and position of the "Show Map ▼" button that appears in the collapsed-map bar.

### Change 3 — Mobile status strip no longer overcrowds

When both editions are posted, the status strip previously showed the active edition in two places simultaneously: as a text label on the left side, and as the highlighted button in the right-side edition switcher. On mobile (`<640px`) this caused overlap.

**Fix:** The left-side edition label is now wrapped in a `hero-edition-tag` class. When `availableEditions.length > 1`, the class is applied and the element is hidden at the mobile breakpoint. Single-edition days are unaffected (class not applied, label visible on mobile).

## Key decisions made

- `hero-edition-tag` is only applied when `availableEditions.length > 1` — preserves the label on single-edition days.
- Desktop layout unchanged across all three changes.
- `BroadcastStage.jsx` already has a story selector gated on `!broadcastMode`; deferred for later refinement rather than changed now.

## Files modified

- `src/components/MapHero.jsx`
- `src/index.css`
- `TODO.md` (created)

## Context for next session

- Status strip left side: `The Meridian [· Edition (desktop or single-edition mobile)] [· Date]`
- Status strip right side: `[Morning][Evening] (when both posted)  clock  Hide Map ▲`
- Mobile with both editions: left = `The Meridian · Date`, right = `[Morning][Evening]  Hide Map ▲`
- `TODO.md` at project root tracks the story selector work for `BroadcastStage.jsx`.

## Open items / next steps

- Refine story selector in `BroadcastStage.jsx` for broadcast preview mode (see `TODO.md`).
- Verify mobile layout live on a day when both editions are posted.
