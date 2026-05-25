# TODO

## Map — Story Selector Buttons

The story selector buttons (panel showing up to 6 story headlines that fly the map to each story) were removed from `MapHero.jsx` (the public website map) as they are more appropriate for operator/broadcast use.

**Task:** Add a proper story selector to `BroadcastStage.jsx` for use in preview mode (`broadcastMode=false`), allowing broadcast operators to manually cycle through stories before the shotlist takes over in `broadcastMode=true`.

**Reference:** `src/components/MapHero.jsx` had the original implementation. `BroadcastStage.jsx` already has a partial story selector (lines ~312–335) that is gated on `!broadcastMode` but may need refinement for the operator workflow.
